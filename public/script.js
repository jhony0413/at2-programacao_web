const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

class Produto {
    constructor(codigo, nome, categoria, preco, estoque, imagem) {
        this.codigo = codigo;
        this.nome = nome;
        this.categoria = categoria;
        this.preco = Number(preco);
        this.estoque = Number(estoque);
        this.imagem = imagem;
    }

    disponivel() {
        return this.estoque > 0;
    }

    statusEstoque() {
        if (this.estoque === 0) return "Indisponível";
        if (this.estoque <= 3) return `Últimas ${this.estoque} unidades`;
        return `${this.estoque} unidades em estoque`;
    }
}

class Carrinho {
    constructor() {
        this.itens = [];
    }

    adicionar(produto) {
        const existente = this.itens.find(item => item.produto.codigo === produto.codigo);
        if (!produto.disponivel()) return { ok: false, mensagem: "Produto sem estoque." };
        if (existente) {
            if (existente.quantidade >= produto.estoque) return { ok: false, mensagem: "Quantidade máxima em estoque atingida." };
            existente.quantidade++;
        } else {
            this.itens.push({ produto: produto, quantidade: 1 });
        }
        return { ok: true, mensagem: "Produto adicionado ao carrinho." };
    }

    aumentar(codigo) {
        const item = this.itens.find(i => i.produto.codigo === codigo);
        if (!item) return false;
        if (item.quantidade < item.produto.estoque) {
            item.quantidade++;
            return true;
        }
        return false;
    }

    diminuir(codigo) {
        const item = this.itens.find(i => i.produto.codigo === codigo);
        if (!item) return false;
        if (item.quantidade > 1) item.quantidade--;
        else this.remover(codigo);
        return true;
    }

    remover(codigo) {
        this.itens = this.itens.filter(item => item.produto.codigo !== codigo);
    }

    quantidadeTotal() {
        let total = 0;
        for (let i = 0; i < this.itens.length; i++) total += this.itens[i].quantidade;
        return total;
    }

    subtotal() {
        let total = 0;
        for (let i = 0; i < this.itens.length; i++) total += this.itens[i].produto.preco * this.itens[i].quantidade;
        return total;
    }

    desconto() {
        const subtotal = this.subtotal();
        if (subtotal >= 300) return subtotal * 0.10;
        return 0;
    }

    total() {
        return this.subtotal() - this.desconto();
    }

    vazio() {
        return this.itens.length === 0;
    }

    sincronizarComCatalogo(listaProdutos) {
        this.itens = this.itens
            .map(item => {
                const atualizado = listaProdutos.find(p => p.codigo === item.produto.codigo);
                if (!atualizado || !atualizado.disponivel()) return null;
                item.produto = atualizado;
                item.quantidade = Math.min(item.quantidade, atualizado.estoque);
                return item;
            })
            .filter(Boolean);
    }
}

let produtos = [];
let categorias = ["Todos"];
let categoriasDisponiveis = [];
let produtosAdmin = [];
let usuarioAtual = null;
let modoAutenticacao = "login";
let aguardarRetomadaCompra = false;
let categoriaAtual = "Todos";

const carrinho = new Carrinho();
const produtosElemento = document.getElementById("gradeProdutos");
const categoriasElemento = document.getElementById("listaCategorias");
const entradaPesquisa = document.getElementById("campoPesquisa");
const sobreposicaoCarrinho = document.getElementById("fundoSobreposicaoCarrinho");
const itensCarrinhoElemento = document.getElementById("listaItensCarrinho");
const avisoElemento = document.getElementById("elementoNotificacao");

function normalizarCaminhoImagem(valor) {
    const limpo = String(valor || "").trim().replace(/^\/+/, "");
    if (!limpo) return "imagens/ilu1.png";
    if (limpo.toLowerCase().startsWith("imagens/")) return limpo;
    return `imagens/${limpo}`;
}

function extrairNomeArquivoImagem(caminho) {
    if (!caminho) return "";
    return String(caminho).replace(/^\/?imagens\//i, "");
}

function atualizarPrevisualizacao(inputId, imgId, legendaId) {
    const caminho = normalizarCaminhoImagem(document.getElementById(inputId).value);
    const img = document.getElementById(imgId);
    const legenda = document.getElementById(legendaId);
    img.src = caminho;
    legenda.textContent = `Caminho final: ${caminho}`;
}

function exibirNotificacao(mensagem) {
    avisoElemento.textContent = mensagem;
    avisoElemento.classList.add("exibir");
    clearTimeout(exibirNotificacao.temporizador);
    exibirNotificacao.temporizador = setTimeout(() => avisoElemento.classList.remove("exibir"), 2400);
}

async function requisitarAPI(url, opcoes = {}) {
    const config = {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(opcoes.headers || {})
        },
        ...opcoes
    };
    const resposta = await fetch(url, config);
    let dados = null;
    try {
        dados = await resposta.json();
    } catch (erro) {
        dados = null;
    }
    if (!resposta.ok) {
        const mensagem = (dados && (dados.erro || dados.mensagem)) || `Erro na requisição (${resposta.status}).`;
        const erroHttp = new Error(mensagem);
        erroHttp.status = resposta.status;
        throw erroHttp;
    }
    return dados;
}

async function carregarSessao() {
    try {
        const dados = await requisitarAPI("/api/auth/sessao");
        usuarioAtual = dados.usuario || null;
    } catch (erro) {
        usuarioAtual = null;
    }
    atualizarInterfaceUsuario();
}

async function carregarProdutos() {
    try {
        const lista = await requisitarAPI("/api/produtos");
        produtos = lista.map(p => new Produto(p.codigo, p.nome, p.categoria, p.preco, p.estoque, p.imagem));
        categorias = ["Todos", ...new Set(produtos.map(p => p.categoria))];
        if (!categorias.includes(categoriaAtual)) categoriaAtual = "Todos";
        carrinho.sincronizarComCatalogo(produtos);
        renderizarCategorias();
        renderizarProdutos();
        atualizarInterfaceCarrinho();
    } catch (erro) {
        produtosElemento.innerHTML =
            `<div class="resultados-vazios">
              <h3>Falha ao carregar produtos</h3>
              <p>${erro.message}</p>
            </div>`;
        exibirNotificacao("Não foi possível conectar ao servidor de produtos.");
    }
}

function formatarDataHora(valor) {
    return new Date(valor).toLocaleString("pt-BR");
}

function alternarVisaoPrincipal(visao) {
    document.querySelector(".secao-destaque").style.display = visao === "loja" ? "block" : "none";
    document.getElementById("catalogoProdutos").style.display = visao === "loja" ? "block" : "none";
    document.getElementById("secaoMeusPedidos").style.display = visao === "pedidos" ? "block" : "none";
    document.getElementById("secaoPainelAdmin").style.display = visao === "admin" ? "block" : "none";
}

function irParaCatalogo() {
    alternarVisaoPrincipal("loja");
    document.getElementById("catalogoProdutos").scrollIntoView({ behavior: "smooth" });
}

function atualizarInterfaceUsuario() {
    const spanUsuario = document.getElementById("identificacaoUsuario");
    const btnLogin = document.getElementById("botaoAbrirLogin");
    const btnCadastro = document.getElementById("botaoAbrirCadastro");
    const btnPedidos = document.getElementById("botaoAbrirMeusPedidos");
    const btnAdmin = document.getElementById("botaoAbrirPainelAdmin");
    const btnLogout = document.getElementById("botaoLogout");

    if (usuarioAtual) {
        spanUsuario.textContent = `${usuarioAtual.nome} (${usuarioAtual.perfil})`;
        btnLogin.style.display = "none";
        btnCadastro.style.display = "none";
        btnPedidos.style.display = "inline-flex";
        btnAdmin.style.display = usuarioAtual.perfil === "admin" ? "inline-flex" : "none";
        btnLogout.style.display = "inline-flex";
    } else {
        spanUsuario.textContent = "Visitante";
        btnLogin.style.display = "inline-flex";
        btnCadastro.style.display = "inline-flex";
        btnPedidos.style.display = "none";
        btnAdmin.style.display = "none";
        btnLogout.style.display = "none";
        alternarVisaoPrincipal("loja");
    }
}

function renderizarListaPedidos(pedidos, containerId, exibirCliente) {
    const container = document.getElementById(containerId);
    if (!pedidos || pedidos.length === 0) {
        container.innerHTML =
            `<div class="resultados-vazios">
              <h3>Nenhum pedido encontrado</h3>
              <p>Ainda não existem pedidos registrados.</p>
            </div>`;
        return;
    }

    container.innerHTML = pedidos.map(pedido => {
        const itensHtml = (pedido.itens || []).map(item =>
            `<div class="linha-confirmacao">
              <span>${item.produto_nome} (${item.produto_codigo}) ×${item.quantidade} — ${dinheiro.format(item.preco_unitario)} un.</span>
              <strong>${dinheiro.format(Number(item.preco_unitario) * Number(item.quantidade))}</strong>
            </div>`
        ).join("");

        const infoCliente = exibirCliente
            ? `<div><strong>Cliente:</strong> ${pedido.cliente_nome} (${pedido.cliente_email})</div>`
            : "";

        return `<article class="card-pedido">
          <div class="topo-pedido">
            <div>
              <strong>Pedido #${pedido.id}</strong> • <span>${formatarDataHora(pedido.data_pedido)}</span>
              ${infoCliente}
            </div>
            <span class="badge-status">${pedido.status}</span>
          </div>
          <div>${itensHtml}</div>
          <div class="linha-resumo" style="margin-top: 10px;"><span>Subtotal</span><strong>${dinheiro.format(pedido.subtotal)}</strong></div>
          <div class="linha-resumo desconto"><span>Desconto</span><strong>− ${dinheiro.format(pedido.desconto)}</strong></div>
          <div class="linha-resumo total"><span>Valor total</span><strong>${dinheiro.format(pedido.valor_total)}</strong></div>
        </article>`;
    }).join("");
}

async function abrirMeusPedidos() {
    try {
        const pedidos = await requisitarAPI("/api/pedidos");
        alternarVisaoPrincipal("pedidos");
        renderizarListaPedidos(pedidos, "listaMeusPedidos", false);
    } catch (erro) {
        exibirNotificacao(erro.message);
    }
}

async function abrirPainelAdmin() {
    try {
        alternarVisaoPrincipal("admin");
        await Promise.all([
            carregarIndicadoresAdmin(),
            carregarCategoriasAdmin(),
            carregarProdutosAdmin(),
            carregarMovimentacoesAdmin(),
            carregarPedidosAdmin()
        ]);
        atualizarPrevisualizacao("novoProdImagem", "previewNovoProduto", "legendaPreviewNovo");
    } catch (erro) {
        exibirNotificacao(erro.message);
    }
}

async function carregarIndicadoresAdmin() {
    const dados = await requisitarAPI("/api/admin/indicadores");
    document.getElementById("gradeIndicadoresAdmin").innerHTML =
        `<div class="card-indicador"><span>Total de produtos</span><strong>${dados.totalProdutos}</strong></div>
         <div class="card-indicador"><span>Estoque baixo (≤ ${dados.criterioEstoqueBaixo})</span><strong>${dados.estoqueBaixo}</strong></div>
         <div class="card-indicador"><span>Produtos esgotados</span><strong>${dados.esgotados}</strong></div>
         <div class="card-indicador"><span>Pedidos registrados</span><strong>${dados.totalPedidos}</strong></div>
         <div class="card-indicador"><span>Faturamento total</span><strong>${dinheiro.format(dados.faturamentoTotal)}</strong></div>`;
}

async function carregarCategoriasAdmin() {
    categoriasDisponiveis = await requisitarAPI("/api/categorias");
    const opcoes = categoriasDisponiveis.map(c => `<option value="${c.id}">${c.nome}</option>`).join("");
    document.getElementById("novoProdCategoria").innerHTML = opcoes;
    document.getElementById("editProdCategoria").innerHTML = opcoes;
}

async function carregarProdutosAdmin() {
    produtosAdmin = await requisitarAPI("/api/produtos?todos=true");
    document.getElementById("movProdCodigo").innerHTML = produtosAdmin
        .map(p => `<option value="${p.codigo}">${p.codigo} - ${p.nome} (Saldo: ${p.estoque})</option>`)
        .join("");

    const linhas = produtosAdmin.map(p =>
        `<tr>
          <td>${p.codigo}</td>
          <td>${p.nome}</td>
          <td>${p.categoria}</td>
          <td>${dinheiro.format(p.preco)}</td>
          <td>${p.estoque}</td>
          <td>${p.ativo ? "Ativo" : "Inativo"}</td>
          <td>
            <button type="button" data-editar-produto="${p.codigo}">Editar</button>
            <button type="button" data-alternar-status="${p.codigo}" data-ativo="${p.ativo ? "1" : "0"}">
              ${p.ativo ? "Desativar" : "Reativar"}
            </button>
          </td>
        </tr>`
    ).join("");

    document.getElementById("tabelaProdutosAdmin").innerHTML =
        `<table class="tabela-admin">
          <thead>
            <tr>
              <th>Código</th><th>Nome</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>`;

    document.querySelectorAll("[data-editar-produto]").forEach(btn => {
        btn.addEventListener("click", () => {
            const prod = produtosAdmin.find(item => item.codigo === btn.dataset.editarProduto);
            if (!prod) return;
            document.getElementById("editProdCodigo").value = prod.codigo;
            document.getElementById("editProdNome").value = prod.nome;
            document.getElementById("editProdCategoria").value = prod.categoria_id;
            document.getElementById("editProdPreco").value = prod.preco;
            document.getElementById("editProdImagem").value = extrairNomeArquivoImagem(prod.imagem);
            atualizarPrevisualizacao("editProdImagem", "previewEditarProduto", "legendaPreviewEditar");
            document.getElementById("moduloEditarProduto").classList.add("aberta");
        });
    });

    document.querySelectorAll("[data-alternar-status]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const codigo = btn.dataset.alternarStatus;
            const novoStatus = btn.dataset.ativo !== "1";
            try {
                const resp = await requisitarAPI(`/api/admin/produtos/${codigo}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({ ativo: novoStatus })
                });
                exibirNotificacao(resp.mensagem);
                await carregarProdutosAdmin();
                await carregarIndicadoresAdmin();
                await carregarProdutos();
            } catch (erro) {
                exibirNotificacao(erro.message);
            }
        });
    });
}

async function carregarMovimentacoesAdmin() {
    const movs = await requisitarAPI("/api/admin/estoque/movimentacoes");
    const linhas = movs.map(m =>
        `<tr>
          <td>${formatarDataHora(m.data_movimentacao)}</td>
          <td>${m.produto_nome} (${m.produto_codigo})</td>
          <td>${m.tipo.toUpperCase()}</td>
          <td>${m.quantidade}</td>
          <td>${m.saldo_resultante}</td>
          <td>${m.motivo}</td>
          <td>${m.usuario_nome}</td>
        </tr>`
    ).join("");

    document.getElementById("tabelaMovimentacoesAdmin").innerHTML =
        `<table class="tabela-admin">
          <thead>
            <tr>
              <th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd</th><th>Saldo</th><th>Motivo</th><th>Responsável</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>`;
}

async function carregarPedidosAdmin() {
    const pedidos = await requisitarAPI("/api/pedidos");
    renderizarListaPedidos(pedidos, "listaPedidosAdmin", true);
}

function abrirModuloAuth(modo) {
    modoAutenticacao = modo;
    const ehCadastro = modo === "cadastro";
    document.getElementById("tituloModuloAuth").textContent = ehCadastro ? "Criar conta" : "Entrar";
    document.getElementById("campoNomeCadastro").style.display = ehCadastro ? "block" : "none";
    document.getElementById("campoConfirmacaoCadastro").style.display = ehCadastro ? "block" : "none";
    document.getElementById("formularioAutenticacao").reset();
    document.getElementById("moduloAutenticacao").classList.add("aberta");
}

function fecharModuloAuth() {
    document.getElementById("moduloAutenticacao").classList.remove("aberta");
    aguardarRetomadaCompra = false;
}

async function enviarAutenticacao(evento) {
    evento.preventDefault();
    const nome = document.getElementById("inputNome").value.trim();
    const email = document.getElementById("inputEmail").value.trim();
    const senha = document.getElementById("inputSenha").value;
    const confirmacaoSenha = document.getElementById("inputConfirmacaoSenha").value;

    if (modoAutenticacao === "cadastro") {
        if (!nome || !email || !senha || !confirmacaoSenha) {
            exibirNotificacao("Preencha todos os campos obrigatórios.");
            return;
        }
        if (senha !== confirmacaoSenha) {
            exibirNotificacao("A senha e a confirmação de senha não coincidem.");
            return;
        }
    } else if (!email || !senha) {
        exibirNotificacao("Informe e-mail e senha.");
        return;
    }

    try {
        const endpoint = modoAutenticacao === "cadastro" ? "/api/auth/cadastro" : "/api/auth/login";
        const corpo = modoAutenticacao === "cadastro"
            ? { nome, email, senha, confirmacaoSenha }
            : { email, senha };
        const dados = await requisitarAPI(endpoint, {
            method: "POST",
            body: JSON.stringify(corpo)
        });
        usuarioAtual = dados.usuario;
        atualizarInterfaceUsuario();
        const deveRetomar = aguardarRetomadaCompra;
        fecharModuloAuth();
        exibirNotificacao(modoAutenticacao === "cadastro" ? "Cadastro realizado com sucesso!" : "Login efetuado com sucesso!");
        if (deveRetomar && !carrinho.vazio()) {
            processarFinalizacaoCompra();
        }
    } catch (erro) {
        exibirNotificacao(erro.message);
    }
}

async function fazerLogout() {
    try {
        await requisitarAPI("/api/auth/logout", { method: "POST" });
    } catch (erro) {
        exibirNotificacao(erro.message);
    }
    usuarioAtual = null;
    atualizarInterfaceUsuario();
    exibirNotificacao("Sessão encerrada.");
}

function renderizarCategorias() {
    categoriasElemento.innerHTML = "";
    categorias.forEach(categoria => {
        const botao = document.createElement("button");
        botao.className = "categoria" + (categoria === categoriaAtual ? " ativa" : "");
        botao.textContent = categoria;
        botao.addEventListener("click", () => {
            categoriaAtual = categoria;
            renderizarCategorias();
            renderizarProdutos();
        });
        categoriasElemento.appendChild(botao);
    });
}

function renderizarProdutos() {
    const busca = entradaPesquisa.value.trim().toLowerCase();
    const filtrados = produtos.filter(produto => {
        const correspondeCategoria = categoriaAtual === "Todos" || produto.categoria === categoriaAtual;
        const correspondeBusca = produto.nome.toLowerCase().includes(busca);
        return correspondeCategoria && correspondeBusca;
    });
    produtosElemento.innerHTML = "";
    if (filtrados.length === 0) {
        produtosElemento.innerHTML =
            `<div class="resultados-vazios">
              <div style="font-size:2rem">🔎</div>
              <h3>Nenhum produto encontrado</h3>
              <p>Tente pesquisar outro nome ou selecionar outra categoria.</p>
            </div>`;
        return;
    }

    for (let i = 0; i < filtrados.length; i++) {
        const produto = filtrados[i];
        const cartao = document.createElement("article");
        cartao.className = "cartao";
        const classeEstoque = produto.estoque === 0 ? "esgotado" : produto.estoque <= 3 ? "baixo" : "normal";
        cartao.innerHTML =
            `<div class="imagem-produto">
              <img src="${produto.imagem}" alt="${produto.nome}">
            </div>
            <div class="corpo-cartao">
              <span class="rotulo-categoria">${produto.categoria}</span>
              <h3>${produto.nome}</h3>
              <div class="preco">${dinheiro.format(produto.preco)}</div>
              <div class="estoque ${classeEstoque}">${produto.statusEstoque()}</div>
              <button class="botao-adicionar" data-codigo-produto="${produto.codigo}" ${produto.estoque === 0 ? "disabled" : ""}>
                ${produto.estoque === 0 ? "Indisponível" : "Adicionar ao carrinho"}
              </button>
            </div>`;
        produtosElemento.appendChild(cartao);
    }

    document.querySelectorAll(".botao-adicionar").forEach(botao => {
        botao.addEventListener("click", () => {
            const resultado = carrinho.adicionar(produtos.find(produto => produto.codigo === botao.dataset.codigoProduto));
            exibirNotificacao(resultado.mensagem);
            if (resultado.ok) atualizarInterfaceCarrinho();
        });
    });
}

function atualizarInterfaceCarrinho() {
    const quantidade = carrinho.quantidadeTotal();
    document.getElementById("contadorCarrinho").textContent = quantidade;
    document.getElementById("subtituloCarrinho").textContent = `${quantidade} ${quantidade === 1 ? "item" : "itens"}`;
    document.getElementById("quantidadeTotalItens").textContent = quantidade;
    document.getElementById("valorSubtotal").textContent = dinheiro.format(carrinho.subtotal());
    document.getElementById("valorDesconto").textContent = carrinho.desconto() > 0 ? "− " + dinheiro.format(carrinho.desconto()) : dinheiro.format(0);
    document.getElementById("valorTotalFinal").textContent = dinheiro.format(carrinho.total());
    document.getElementById("botaoFinalizarCompra").disabled = carrinho.vazio();

    if (carrinho.vazio()) {
        itensCarrinhoElemento.innerHTML =
            `<div class="carrinho-vazio">
              <div style="font-size: 2.5rem; text-align: center;">🛒</div>
              <h3 style="text-align: center">Seu carrinho está vazio</h3>
              <p style="text-align: center">Adicione produtos para continuar.</p>
            </div>`;
        return;
    }

    itensCarrinhoElemento.innerHTML = "";
    for (let i = 0; i < carrinho.itens.length; i++) {
        const item = carrinho.itens[i];
        const linhaElemento = document.createElement("div");
        linhaElemento.className = "item-carrinho";
        linhaElemento.innerHTML =
            `<div class="miniatura">
              <img src="${item.produto.imagem}" alt="${item.produto.nome}">
            </div>
            <div>
              <div class="nome-item">${item.produto.nome}</div>
              <div class="preco-unitario">${dinheiro.format(item.produto.preco)} cada</div>
              <div class="controles">
                <button class="botao-quantidade" data-acao-quantidade="diminuir" data-codigo-produto="${item.produto.codigo}">−</button>
                <span class="quantidade">${item.quantidade}</span>
                <button class="botao-quantidade" data-acao-quantidade="aumentar" data-codigo-produto="${item.produto.codigo}">+</button>
                <button class="botao-remover" data-acao-quantidade="remover" data-codigo-produto="${item.produto.codigo}">Remover</button>
              </div>
            </div>
            <div class="subtotal">${dinheiro.format(item.produto.preco * item.quantidade)}</div>`;
        itensCarrinhoElemento.appendChild(linhaElemento);
    }

    document.querySelectorAll("[data-acao-quantidade]").forEach(botao => {
        botao.addEventListener("click", () => {
            const codigo = botao.dataset.codigoProduto;
            const acao = botao.dataset.acaoQuantidade;
            if (acao === "aumentar") {
                if (!carrinho.aumentar(codigo)) exibirNotificacao("A quantidade máxima disponível foi atingida.");
            } else if (acao === "diminuir") {
                carrinho.diminuir(codigo);
            } else if (acao === "remover") {
                carrinho.remover(codigo);
                exibirNotificacao("Produto removido do carrinho.");
            }
            atualizarInterfaceCarrinho();
        });
    });
}

function abrirCarrinhoDeCompras() {
    atualizarInterfaceCarrinho();
    sobreposicaoCarrinho.classList.add("aberta");
    document.body.style.overflow = "hidden";
}

function fecharCarrinhoDeCompras() {
    sobreposicaoCarrinho.classList.remove("aberta");
    document.body.style.overflow = "";
}

function processarFinalizacaoCompra() {
    if (carrinho.vazio()) {
        exibirNotificacao("Não é possível finalizar com o carrinho vazio.");
        return;
    }

    if (!usuarioAtual) {
        aguardarRetomadaCompra = true;
        exibirNotificacao("Faça login para concluir a compra. Seu carrinho será mantido.");
        abrirModuloAuth("login");
        return;
    }

    let linhas = "";
    let indice = 0;
    while (indice < carrinho.itens.length) {
        const item = carrinho.itens[indice];
        linhas +=
            `<div class="linha-confirmacao">
              <span>${item.produto.nome} ×${item.quantidade}</span>
              <strong>${dinheiro.format(item.produto.preco * item.quantidade)}</strong>
            </div>`;
        indice++;
    }

    document.getElementById("conteudoModuloFinalizacao").innerHTML =
        `<div class="lista-confirmacao">${linhas}</div>
         <div class="linha-resumo"><span>Subtotal</span><strong>${dinheiro.format(carrinho.subtotal())}</strong></div>
         <div class="linha-resumo desconto"><span>Desconto</span><strong>${carrinho.desconto() ? "− " + dinheiro.format(carrinho.desconto()) : dinheiro.format(0)}</strong></div>
         <div class="linha-resumo total"><span>Valor final</span><strong>${dinheiro.format(carrinho.total())}</strong></div>
         <button class="botao-finalizar" id="botaoConfirmarCompra">Confirmar compra</button>`;
    document.getElementById("moduloFinalizacaoCompra").classList.add("aberta");

    document.getElementById("botaoConfirmarCompra").addEventListener("click", confirmarPedidoNoBackend);
}

async function confirmarPedidoNoBackend() {
    const botaoConfirmar = document.getElementById("botaoConfirmarCompra");
    if (botaoConfirmar) botaoConfirmar.disabled = true;

    const payload = {
        itens: carrinho.itens.map(item => ({
            codigo: item.produto.codigo,
            quantidade: item.quantidade
        }))
    };

    try {
        const pedidoCriado = await requisitarAPI("/api/pedidos", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        const numeroPedido = pedidoCriado.pedidoId || pedidoCriado.id;
        const totalFinal = Number(pedidoCriado.valorTotal ?? pedidoCriado.valor_total ?? carrinho.total());

        document.getElementById("conteudoModuloFinalizacao").innerHTML =
            `<div class="mensagem-sucesso">
              <div class="icone-sucesso">✓</div>
              <h2>Compra concluída com sucesso!</h2>
              <p>Pedido <strong>#${numeroPedido}</strong> registrado com total de <strong>${dinheiro.format(totalFinal)}</strong>.</p>
              <button class="botao-finalizar" id="botaoVoltarLoja">Voltar à loja</button>
            </div>`;

        carrinho.itens = [];
        atualizarInterfaceCarrinho();
        await carregarProdutos();

        document.getElementById("botaoVoltarLoja").addEventListener("click", () => {
            document.getElementById("moduloFinalizacaoCompra").classList.remove("aberta");
            fecharCarrinhoDeCompras();
            exibirNotificacao("Compra finalizada.");
        });
    } catch (erro) {
        if (botaoConfirmar) botaoConfirmar.disabled = false;
        if (erro.status === 401) {
            usuarioAtual = null;
            atualizarInterfaceUsuario();
            aguardarRetomadaCompra = true;
            document.getElementById("moduloFinalizacaoCompra").classList.remove("aberta");
            abrirModuloAuth("login");
        }
        await carregarProdutos();
        exibirNotificacao(erro.message);
    }
}

document.getElementById("linkLogoCatalogo").addEventListener("click", evento => {
    evento.preventDefault();
    irParaCatalogo();
});
document.getElementById("botaoAbrirCarrinho").addEventListener("click", abrirCarrinhoDeCompras);
document.getElementById("botaoCarrinhoDestaque").addEventListener("click", abrirCarrinhoDeCompras);
document.getElementById("botaoFecharCarrinho").addEventListener("click", fecharCarrinhoDeCompras);
document.getElementById("botaoFinalizarCompra").addEventListener("click", processarFinalizacaoCompra);
document.getElementById("botaoFecharModulo").addEventListener("click", () => document.getElementById("moduloFinalizacaoCompra").classList.remove("aberta"));
document.getElementById("botaoVerProdutos").addEventListener("click", irParaCatalogo);
document.getElementById("botaoAbrirLogin").addEventListener("click", () => abrirModuloAuth("login"));
document.getElementById("botaoAbrirCadastro").addEventListener("click", () => abrirModuloAuth("cadastro"));
document.getElementById("botaoFecharAuth").addEventListener("click", fecharModuloAuth);
document.getElementById("formularioAutenticacao").addEventListener("submit", enviarAutenticacao);
document.getElementById("botaoLogout").addEventListener("click", fazerLogout);
document.getElementById("botaoAbrirMeusPedidos").addEventListener("click", abrirMeusPedidos);
document.getElementById("botaoFecharMeusPedidos").addEventListener("click", () => alternarVisaoPrincipal("loja"));
document.getElementById("botaoAbrirPainelAdmin").addEventListener("click", abrirPainelAdmin);
document.getElementById("botaoFecharPainelAdmin").addEventListener("click", () => alternarVisaoPrincipal("loja"));
document.getElementById("botaoFecharEditarProduto").addEventListener("click", () => {
    document.getElementById("moduloEditarProduto").classList.remove("aberta");
});

document.getElementById("novoProdImagem").addEventListener("input", () => {
    atualizarPrevisualizacao("novoProdImagem", "previewNovoProduto", "legendaPreviewNovo");
});
document.getElementById("editProdImagem").addEventListener("input", () => {
    atualizarPrevisualizacao("editProdImagem", "previewEditarProduto", "legendaPreviewEditar");
});

document.querySelectorAll("[data-aba-admin]").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll("[data-aba-admin]").forEach(b => b.classList.remove("ativa"));
        btn.classList.add("ativa");
        const aba = btn.dataset.abaAdmin;
        document.getElementById("painelAbaProdutos").style.display = aba === "produtos" ? "block" : "none";
        document.getElementById("painelAbaEstoque").style.display = aba === "estoque" ? "block" : "none";
        document.getElementById("painelAbaPedidos").style.display = aba === "pedidos" ? "block" : "none";
    });
});

document.getElementById("formNovoProduto").addEventListener("submit", async evento => {
    evento.preventDefault();
    try {
        const resp = await requisitarAPI("/api/admin/produtos", {
            method: "POST",
            body: JSON.stringify({
                nome: document.getElementById("novoProdNome").value,
                categoria_id: document.getElementById("novoProdCategoria").value,
                preco: document.getElementById("novoProdPreco").value,
                estoque: document.getElementById("novoProdEstoque").value,
                imagem: normalizarCaminhoImagem(document.getElementById("novoProdImagem").value)
            })
        });
        evento.target.reset();
        atualizarPrevisualizacao("novoProdImagem", "previewNovoProduto", "legendaPreviewNovo");
        exibirNotificacao(resp.mensagem);
        await carregarProdutosAdmin();
        await carregarMovimentacoesAdmin();
        await carregarIndicadoresAdmin();
        await carregarProdutos();
    } catch (erro) {
        exibirNotificacao(erro.message);
    }
});

document.getElementById("formEditarProduto").addEventListener("submit", async evento => {
    evento.preventDefault();
    const codigo = document.getElementById("editProdCodigo").value;
    const prodAtual = produtosAdmin.find(p => p.codigo === codigo);
    try {
        const resp = await requisitarAPI(`/api/admin/produtos/${codigo}`, {
            method: "PUT",
            body: JSON.stringify({
                nome: document.getElementById("editProdNome").value,
                categoria_id: document.getElementById("editProdCategoria").value,
                preco: document.getElementById("editProdPreco").value,
                imagem: normalizarCaminhoImagem(document.getElementById("editProdImagem").value),
                ativo: prodAtual ? Boolean(prodAtual.ativo) : true
            })
        });
        document.getElementById("moduloEditarProduto").classList.remove("aberta");
        exibirNotificacao(resp.mensagem);
        await carregarProdutosAdmin();
        await carregarProdutos();
    } catch (erro) {
        exibirNotificacao(erro.message);
    }
});

document.getElementById("formMovimentacaoEstoque").addEventListener("submit", async evento => {
    evento.preventDefault();
    try {
        const resp = await requisitarAPI("/api/admin/estoque/movimentacoes", {
            method: "POST",
            body: JSON.stringify({
                produto_codigo: document.getElementById("movProdCodigo").value,
                tipo: document.getElementById("movTipo").value,
                quantidade: document.getElementById("movQuantidade").value,
                motivo: document.getElementById("movMotivo").value
            })
        });
        evento.target.reset();
        exibirNotificacao(resp.mensagem);
        await carregarProdutosAdmin();
        await carregarMovimentacoesAdmin();
        await carregarIndicadoresAdmin();
        await carregarProdutos();
    } catch (erro) {
        exibirNotificacao(erro.message);
    }
});

entradaPesquisa.addEventListener("input", renderizarProdutos);
sobreposicaoCarrinho.addEventListener("click", evento => { if (evento.target === sobreposicaoCarrinho) fecharCarrinhoDeCompras(); });
document.getElementById("moduloFinalizacaoCompra").addEventListener("click", evento => {
    if (evento.target.id === "moduloFinalizacaoCompra") document.getElementById("moduloFinalizacaoCompra").classList.remove("aberta");
});

carregarSessao();
carregarProdutos();