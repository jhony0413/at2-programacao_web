require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'rubigamer_db',
    waitForConnections: true,
    connectionLimit: 10
});

app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'chave_desenvolvimento_rubigamer',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 4
    }
}));
app.use(express.static(path.join(__dirname)));

function exigirAutenticacao(req, res, next) {
    if (!req.session || !req.session.usuario) {
        return res.status(401).json({ erro: 'Autenticação necessária para realizar esta operação.' });
    }
    next();
}

function exigirAdmin(req, res, next) {
    if (!req.session || !req.session.usuario) {
        return res.status(401).json({ erro: 'Autenticação necessária.' });
    }
    if (req.session.usuario.perfil !== 'admin') {
        return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
    }
    next();
}

app.get('/api/auth/sessao', (req, res) => {
    res.json({ usuario: req.session.usuario || null });
});

app.post('/api/auth/cadastro', async(req, res) => {
    const { nome, email, senha, confirmacaoSenha } = req.body;

    if (!nome || !email || !senha || !confirmacaoSenha) {
        return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
    }
    if (typeof nome !== 'string' || nome.trim().length < 3) {
        return res.status(400).json({ erro: 'Informe um nome completo válido.' });
    }
    if (typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ erro: 'Informe um e-mail válido.' });
    }
    if (typeof senha !== 'string' || senha.length < 6) {
        return res.status(400).json({ erro: 'A senha deve ter no mínimo 6 caracteres.' });
    }
    if (senha !== confirmacaoSenha) {
        return res.status(400).json({ erro: 'A senha e a confirmação de senha não coincidem.' });
    }

    try {
        const emailNormalizado = email.trim().toLowerCase();
        const [existentes] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [emailNormalizado]);

        if (existentes.length > 0) {
            return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
        }

        const senhaHash = await bcrypt.hash(senha, 10);
        const [resultado] = await pool.query(
            'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)', [nome.trim(), emailNormalizado, senhaHash, 'cliente']
        );

        const usuarioSessao = {
            id: resultado.insertId,
            nome: nome.trim(),
            email: emailNormalizado,
            perfil: 'cliente'
        };
        req.session.usuario = usuarioSessao;

        res.status(201).json({ usuario: usuarioSessao });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro interno ao cadastrar usuário.' });
    }
});

app.post('/api/auth/login', async(req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
    }

    try {
        const emailNormalizado = email.trim().toLowerCase();
        const [usuarios] = await pool.query(
            'SELECT id, nome, email, senha_hash, perfil FROM usuarios WHERE email = ?', [emailNormalizado]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
        }

        const usuario = usuarios[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

        if (!senhaValida) {
            return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
        }

        const usuarioSessao = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil
        };
        req.session.usuario = usuarioSessao;

        res.json({ usuario: usuarioSessao });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro interno ao autenticar usuário.' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ mensagem: 'Sessão encerrada com sucesso.' });
    });
});

app.get('/api/categorias', async(req, res) => {
    try {
        const [categorias] = await pool.query('SELECT id, nome FROM categorias ORDER BY nome ASC');
        res.json(categorias);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao consultar categorias.' });
    }
});

app.get('/api/produtos', async(req, res) => {
    try {
        const incluirInativos = req.query.todos === 'true' && req.session?.usuario?.perfil === 'admin';
        const filtro = incluirInativos ? '' : 'WHERE P.ativo = TRUE';
        const query = `
            SELECT P.codigo, P.nome, P.categoria_id, C.nome AS categoria, P.preco, P.estoque, P.imagem, P.ativo
            FROM produtos P
            JOIN categorias C ON P.categoria_id = C.id
            ${filtro}
            ORDER BY P.codigo ASC
        `;
        const [results] = await pool.query(query);
        res.json(results);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao buscar produtos.' });
    }
});

app.post('/api/pedidos', exigirAutenticacao, async(req, res) => {
    const { itens } = req.body;

    if (!Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ erro: 'O carrinho não pode estar vazio para finalizar o pedido.' });
    }

    const itensAgrupados = new Map();
    for (const item of itens) {
        const qtd = Number(item.quantidade);
        if (!item.codigo || !Number.isInteger(qtd) || qtd <= 0) {
            return res.status(400).json({ erro: 'Itens ou quantidades inválidas no pedido.' });
        }
        itensAgrupados.set(item.codigo, (itensAgrupados.get(item.codigo) || 0) + qtd);
    }

    const conexao = await pool.getConnection();
    try {
        await conexao.beginTransaction();

        let subtotal = 0;
        const itensValidados = [];

        for (const [codigo, quantidade] of itensAgrupados.entries()) {
            const [rows] = await conexao.query(
                'SELECT codigo, nome, preco, estoque, ativo FROM produtos WHERE codigo = ? FOR UPDATE', [codigo]
            );

            if (rows.length === 0 || !rows[0].ativo) {
                await conexao.rollback();
                return res.status(404).json({ erro: `O produto ${codigo} não existe ou está indisponível.` });
            }

            const produtoDb = rows[0];
            if (produtoDb.estoque < quantidade) {
                await conexao.rollback();
                return res.status(409).json({
                    erro: `Estoque insuficiente para "${produtoDb.nome}". Disponível: ${produtoDb.estoque}.`
                });
            }

            const precoUnitario = Number(produtoDb.preco);
            subtotal += precoUnitario * quantidade;

            itensValidados.push({
                codigo: produtoDb.codigo,
                quantidade,
                precoUnitario,
                novoSaldo: produtoDb.estoque - quantidade
            });
        }

        const desconto = subtotal >= 300 ? Number((subtotal * 0.10).toFixed(2)) : 0;
        const valorTotal = Number((subtotal - desconto).toFixed(2));
        subtotal = Number(subtotal.toFixed(2));
        const usuarioId = req.session.usuario.id;

        const [resPedido] = await conexao.query(
            'INSERT INTO pedidos (usuario_id, subtotal, desconto, valor_total, status) VALUES (?, ?, ?, ?, ?)', [usuarioId, subtotal, desconto, valorTotal, 'Concluído']
        );
        const pedidoId = resPedido.insertId;

        for (const item of itensValidados) {
            await conexao.query(
                'INSERT INTO itens_pedido (pedido_id, produto_codigo, quantidade, preco_unitario) VALUES (?, ?, ?, ?)', [pedidoId, item.codigo, item.quantidade, item.precoUnitario]
            );

            await conexao.query(
                'UPDATE produtos SET estoque = ? WHERE codigo = ?', [item.novoSaldo, item.codigo]
            );

            await conexao.query(
                'INSERT INTO movimentacoes_estoque (produto_codigo, usuario_id, tipo, quantidade, saldo_resultante, motivo) VALUES (?, ?, ?, ?, ?, ?)', [item.codigo, usuarioId, 'saida', item.quantidade, item.novoSaldo, `Venda - Pedido #${pedidoId}`]
            );
        }

        await conexao.commit();

        res.status(201).json({
            pedidoId,
            subtotal,
            desconto,
            valorTotal,
            status: 'Concluído'
        });
    } catch (erro) {
        await conexao.rollback();
        res.status(500).json({ erro: 'Falha ao processar o pedido no banco de dados.' });
    } finally {
        conexao.release();
    }
});

app.get('/api/pedidos', exigirAutenticacao, async(req, res) => {
    try {
        const ehAdmin = req.session.usuario.perfil === 'admin';
        const filtro = ehAdmin ? '' : 'WHERE P.usuario_id = ?';
        const params = ehAdmin ? [] : [req.session.usuario.id];

        const [pedidos] = await pool.query(
            `SELECT P.id, P.usuario_id, U.nome AS cliente_nome, U.email AS cliente_email,
                    P.data_pedido, P.subtotal, P.desconto, P.valor_total, P.status
             FROM pedidos P
             JOIN usuarios U ON P.usuario_id = U.id
             ${filtro}
             ORDER BY P.data_pedido DESC, P.id DESC`,
            params
        );

        if (pedidos.length === 0) {
            return res.json([]);
        }

        const ids = pedidos.map(p => p.id);
        const [itens] = await pool.query(
            `SELECT IP.pedido_id, IP.produto_codigo, PR.nome AS produto_nome,
                    IP.quantidade, IP.preco_unitario
             FROM itens_pedido IP
             JOIN produtos PR ON IP.produto_codigo = PR.codigo
             WHERE IP.pedido_id IN (?)`, [ids]
        );

        const mapaItens = new Map();
        for (const item of itens) {
            if (!mapaItens.has(item.pedido_id)) mapaItens.set(item.pedido_id, []);
            mapaItens.get(item.pedido_id).push(item);
        }

        const resposta = pedidos.map(pedido => ({
            ...pedido,
            itens: mapaItens.get(pedido.id) || []
        }));

        res.json(resposta);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao consultar pedidos.' });
    }
});

app.get('/api/pedidos/:id', exigirAutenticacao, async(req, res) => {
    const pedidoId = Number(req.params.id);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
        return res.status(400).json({ erro: 'Identificador de pedido inválido.' });
    }

    try {
        const [pedidos] = await pool.query(
            `SELECT P.id, P.usuario_id, U.nome AS cliente_nome, P.data_pedido,
                    P.subtotal, P.desconto, P.valor_total, P.status
             FROM pedidos P
             JOIN usuarios U ON P.usuario_id = U.id
             WHERE P.id = ?`, [pedidoId]
        );

        if (pedidos.length === 0) {
            return res.status(404).json({ erro: 'Pedido não encontrado.' });
        }

        const pedido = pedidos[0];
        if (req.session.usuario.perfil !== 'admin' && pedido.usuario_id !== req.session.usuario.id) {
            return res.status(403).json({ erro: 'Você não tem permissão para consultar este pedido.' });
        }

        const [itens] = await pool.query(
            `SELECT IP.produto_codigo, PR.nome AS produto_nome, IP.quantidade, IP.preco_unitario
             FROM itens_pedido IP
             JOIN produtos PR ON IP.produto_codigo = PR.codigo
             WHERE IP.pedido_id = ?`, [pedidoId]
        );

        res.json({...pedido, itens });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao buscar detalhes do pedido.' });
    }
});

app.get('/api/admin/indicadores', exigirAdmin, async(req, res) => {
    const limiteEstoqueBaixo = 3;
    try {
        const [
            [totaisProdutos]
        ] = await pool.query(
            `SELECT
                COUNT(*) AS total_produtos,
                SUM(CASE WHEN ativo = TRUE AND estoque = 0 THEN 1 ELSE 0 END) AS esgotados,
                SUM(CASE WHEN ativo = TRUE AND estoque > 0 AND estoque <= ? THEN 1 ELSE 0 END) AS estoque_baixo
             FROM produtos`, [limiteEstoqueBaixo]
        );
        const [
            [totaisPedidos]
        ] = await pool.query(
            'SELECT COUNT(*) AS total_pedidos, COALESCE(SUM(valor_total), 0) AS faturamento_total FROM pedidos'
        );

        res.json({
            criterioEstoqueBaixo: limiteEstoqueBaixo,
            totalProdutos: Number(totaisProdutos.total_produtos || 0),
            esgotados: Number(totaisProdutos.esgotados || 0),
            estoqueBaixo: Number(totaisProdutos.estoque_baixo || 0),
            totalPedidos: Number(totaisPedidos.total_pedidos || 0),
            faturamentoTotal: Number(totaisPedidos.faturamento_total || 0)
        });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao carregar indicadores administrativos.' });
    }
});

app.post('/api/admin/produtos', exigirAdmin, async (req, res) => {
    const { nome, categoria_id, preco, estoque, imagem } = req.body;
    const precoNum = Number(preco);
    const estoqueNum = Number(estoque ?? 0);
    const categoriaIdNum = Number(categoria_id);

    if (!nome || !Number.isInteger(categoriaIdNum) || categoriaIdNum <= 0) {
        return res.status(400).json({ erro: 'Nome e categoria são obrigatórios.' });
    }
    if (Number.isNaN(precoNum) || precoNum < 0 || !Number.isInteger(estoqueNum) || estoqueNum < 0) {
        return res.status(400).json({ erro: 'Preço e estoque devem ser valores válidos e não negativos.' });
    }

    const imagemLimpa = String(imagem || '').trim().replace(/^\/+/, '');
    const imagemFinal = imagemLimpa
    ? (imagemLimpa.toLowerCase().startsWith('imagens/') ? imagemLimpa : `imagens/${imagemLimpa}`)
    : 'imagens/ilu1.png';

    const conexao = await pool.getConnection();
    try {
        await conexao.beginTransaction();

        const [codigosExistentes] = await conexao.query(
            "SELECT codigo FROM produtos WHERE codigo LIKE 'PROD%' FOR UPDATE"
        );
        let maiorNumero = 0;
        for (const row of codigosExistentes) {
            const match = /^PROD(\d+)$/i.exec(String(row.codigo).trim());
            if (match) {
                const num = Number(match[1]);
                if (num > maiorNumero) maiorNumero = num;
            }
        }
        const proximoCodigo = `PROD${String(maiorNumero + 1).padStart(3, '0')}`;

        await conexao.query(
            'INSERT INTO produtos (codigo, nome, categoria_id, preco, estoque, imagem, ativo) VALUES (?, ?, ?, ?, ?, ?, TRUE)',
            [proximoCodigo, String(nome).trim(), categoriaIdNum, precoNum, estoqueNum, imagemFinal]
        );

        if (estoqueNum > 0) {
            await conexao.query(
                'INSERT INTO movimentacoes_estoque (produto_codigo, usuario_id, tipo, quantidade, saldo_resultante, motivo) VALUES (?, ?, ?, ?, ?, ?)',
                [proximoCodigo, req.session.usuario.id, 'entrada', estoqueNum, estoqueNum, 'Estoque inicial no cadastro do produto']
            );
        }

        await conexao.commit();
        res.status(201).json({ mensagem: `Produto ${proximoCodigo} cadastrado com sucesso.`, codigo: proximoCodigo });
    } catch (erro) {
        await conexao.rollback();
        res.status(500).json({ erro: 'Erro ao cadastrar produto.' });
    } finally {
        conexao.release();
    }
});

app.put('/api/admin/produtos/:codigo', exigirAdmin, async(req, res) => {
    const codigo = String(req.params.codigo).trim();
    const { nome, categoria_id, preco, imagem, ativo } = req.body;
    const precoNum = Number(preco);
    const categoriaIdNum = Number(categoria_id);

    if (!nome || !Number.isInteger(categoriaIdNum) || categoriaIdNum <= 0 || Number.isNaN(precoNum) || precoNum < 0) {
        return res.status(400).json({ erro: 'Dados inválidos para atualização do produto.' });
    }

    try {
        const ativoBool = ativo === undefined ? true : Boolean(ativo);
        const [resultado] = await pool.query(
            'UPDATE produtos SET nome = ?, categoria_id = ?, preco = ?, imagem = ?, ativo = ? WHERE codigo = ?', [String(nome).trim(), categoriaIdNum, precoNum, imagem ? String(imagem).trim() : null, ativoBool, codigo]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ erro: 'Produto não encontrado.' });
        }

        res.json({ mensagem: 'Produto atualizado com sucesso.' });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao atualizar produto.' });
    }
});

app.patch('/api/admin/produtos/:codigo/status', exigirAdmin, async(req, res) => {
    const codigo = String(req.params.codigo).trim();
    const { ativo } = req.body;

    if (typeof ativo !== 'boolean') {
        return res.status(400).json({ erro: 'Informe o status ativo como verdadeiro ou falso.' });
    }

    try {
        const [resultado] = await pool.query('UPDATE produtos SET ativo = ? WHERE codigo = ?', [ativo, codigo]);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ erro: 'Produto não encontrado.' });
        }
        res.json({ mensagem: ativo ? 'Produto reativado com sucesso.' : 'Produto desativado com sucesso.' });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao alterar status do produto.' });
    }
});

app.post('/api/admin/estoque/movimentacoes', exigirAdmin, async(req, res) => {
    const { produto_codigo, tipo, quantidade, motivo } = req.body;
    const tiposPermitidos = ['entrada', 'saida', 'ajuste'];
    const qtdNum = Number(quantidade);

    if (!produto_codigo || !tiposPermitidos.includes(tipo)) {
        return res.status(400).json({ erro: 'Produto e tipo de movimentação (entrada, saida ou ajuste) são obrigatórios.' });
    }
    if (!Number.isInteger(qtdNum) || qtdNum < 0 || (tipo !== 'ajuste' && qtdNum === 0)) {
        return res.status(400).json({ erro: 'Quantidade inválida para o tipo de movimentação selecionado.' });
    }
    if (!motivo || String(motivo).trim().length < 3) {
        return res.status(400).json({ erro: 'Informe um motivo válido para a movimentação.' });
    }

    const conexao = await pool.getConnection();
    try {
        await conexao.beginTransaction();

        const [rows] = await conexao.query(
            'SELECT codigo, nome, estoque FROM produtos WHERE codigo = ? FOR UPDATE', [String(produto_codigo).trim()]
        );

        if (rows.length === 0) {
            await conexao.rollback();
            return res.status(404).json({ erro: 'Produto não encontrado.' });
        }

        const estoqueAtual = Number(rows[0].estoque);
        let novoSaldo = estoqueAtual;
        let quantidadeRegistrada = qtdNum;

        if (tipo === 'entrada') {
            novoSaldo = estoqueAtual + qtdNum;
        } else if (tipo === 'saida') {
            if (qtdNum > estoqueAtual) {
                await conexao.rollback();
                return res.status(409).json({ erro: `Saída maior que o saldo disponível (${estoqueAtual}).` });
            }
            novoSaldo = estoqueAtual - qtdNum;
        } else if (tipo === 'ajuste') {
            novoSaldo = qtdNum;
            quantidadeRegistrada = Math.abs(qtdNum - estoqueAtual);
        }

        await conexao.query('UPDATE produtos SET estoque = ? WHERE codigo = ?', [novoSaldo, rows[0].codigo]);
        await conexao.query(
            'INSERT INTO movimentacoes_estoque (produto_codigo, usuario_id, tipo, quantidade, saldo_resultante, motivo) VALUES (?, ?, ?, ?, ?, ?)', [rows[0].codigo, req.session.usuario.id, tipo, quantidadeRegistrada, novoSaldo, String(motivo).trim()]
        );

        await conexao.commit();
        res.status(201).json({
            mensagem: 'Movimentação de estoque registrada com sucesso.',
            saldoAnterior: estoqueAtual,
            saldoResultante: novoSaldo
        });
    } catch (erro) {
        await conexao.rollback();
        res.status(500).json({ erro: 'Erro ao registrar movimentação de estoque.' });
    } finally {
        conexao.release();
    }
});

app.get('/api/admin/estoque/movimentacoes', exigirAdmin, async(req, res) => {
    try {
        const [movimentacoes] = await pool.query(
            `SELECT M.id, M.produto_codigo, P.nome AS produto_nome, M.tipo,
                    M.quantidade, M.saldo_resultante, M.motivo, M.data_movimentacao,
                    U.nome AS usuario_nome
             FROM movimentacoes_estoque M
             JOIN produtos P ON M.produto_codigo = P.codigo
             JOIN usuarios U ON M.usuario_id = U.id
             ORDER BY M.data_movimentacao DESC, M.id DESC`
        );
        res.json(movimentacoes);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao consultar histórico de movimentações.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor em execução na porta ${port}`);
});