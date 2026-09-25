const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
class Produto {
    constructor(codigo, nome, categoria, preco, estoque, imagem) {
        this.codigo = codigo;
        this.nome = nome;
        this.categoria = categoria;
        this.preco = preco;
        this.estoque = estoque;
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
        else return 0;
    }

    total() {
        return this.subtotal() - this.desconto();
    }

    vazio() {
        return this.itens.length === 0;
    }

}

const produtos = [
    new Produto("PROD001", "Notebook Novabook", "Informática", 3299.90, 5, "imagens/ilu1.png"),
    new Produto("PROD002", "Teclado Mecânico RGB", "Acessórios", 349.90, 8, "imagens/ilu2.png"),
    new Produto("PROD003", "Mouse Gamer Pulse", "Gamer", 189.90, 12, "imagens/ilu3.png"),
    new Produto("PROD004", "Headset SoundMax", "Gamer", 429.90, 3, "imagens/ilu4.png"),
    new Produto("PROD005", "Monitor UltraView 27\"", "Informática", 1399.90, 2, "imagens/ilu5.png"),
    new Produto("PROD006", "Webcam Vision HD", "Acessórios", 249.90, 0, "imagens/ilu6.png"),
    new Produto("PROD007", "Controle GamePad X", "Gamer", 299.90, 6, "imagens/ilu7.png"),
    new Produto("PROD008", "SSD Flash 1TB", "Informática", 499.90, 7, "imagens/ilu8.png")
];
const carrinho = new Carrinho();
const produtosElemento = document.getElementById("gradeProdutos");
const categoriasElemento = document.getElementById("listaCategorias");
const entradaPesquisa = document.getElementById("campoPesquisa");
const sobreposicaoCarrinho = document.getElementById("fundoSobreposicaoCarrinho");
const itensCarrinhoElemento = document.getElementById("listaItensCarrinho");
const avisoElemento = document.getElementById("elementoNotificacao");
let categoriaAtual = "Todos";
var lojaAtiva = true;
const categorias = ["Todos", ...new Set(produtos.map(produto => produto.categoria))];

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
          <div style="font-size:2rem">
            🔎
          </div>
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
          <div class="preco">
            ${dinheiro.format(produto.preco)}

          </div>
          <div class="estoque ${classeEstoque}">
            ${produto.statusEstoque()}

          </div>
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
          <div style = "font-size: 2.5rem; text-align: center;">
            🛒
          </div>
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
        linhaElemento.innerHTML = `
        <div class="miniatura">
          <img src="${item.produto.imagem}" alt="${item.produto.nome}">
        </div>
        <div>
          <div class="nome-item">
            ${item.produto.nome}

          </div>
          <div class="preco-unitario">
            ${dinheiro.format(item.produto.preco)} cada
          </div>
          <div class="controles">
            <button class="botao-quantidade" data-acao-quantidade="diminuir" data-codigo-produto="${item.produto.codigo}">−</button>
            <span class="quantidade">${item.quantidade}</span>
            <button class="botao-quantidade" data-acao-quantidade="aumentar" data-codigo-produto="${item.produto.codigo}">+</button>
            <button class="botao-remover" data-acao-quantidade="remover" data-codigo-produto="${item.produto.codigo}">Remover</button>
          </div>
        </div>
        <div class="subtotal">
          ${dinheiro.format(item.produto.preco * item.quantidade)}

        </div>`;
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

function exibirNotificacao(mensagem) {
    avisoElemento.textContent = mensagem;
    avisoElemento.classList.add("exibir");
    clearTimeout(exibirNotificacao.temporizador);
    exibirNotificacao.temporizador = setTimeout(() => avisoElemento.classList.remove("exibir"), 2400);
}

function processarFinalizacaoCompra() {
    if (carrinho.vazio()) {
        exibirNotificacao("Não é possível finalizar com o carrinho vazio.");
        return;
    }

    let linhas = "";
    let indice = 0;
    while (indice < carrinho.itens.length) {
        const item = carrinho.itens[indice];
        linhas +=
            `<div class="linha-confirmacao">
          <span>${item.produto.nome} ×${item.quantidade} </span><strong>${dinheiro.format(item.produto.preco * item.quantidade)}</strong>
        </div>`;
        indice++;
    }

    document.getElementById("conteudoModuloFinalizacao").innerHTML =
        `<div class="lista-confirmacao">
        ${linhas}

      </div>
      <div class="linha-resumo">
        <span>Subtotal</span><strong>${dinheiro.format(carrinho.subtotal())}</strong>
      </div>
      <div class="linha-resumo desconto">
        <span>Desconto</span><strong>${carrinho.desconto() ? "− " + dinheiro.format(carrinho.desconto()) : dinheiro.format(0)}</strong>
      </div>
      <div class="linha-resumo total">
        <span>Valor final</span><strong>${dinheiro.format(carrinho.total())}</strong>
      </div>
      <button class="botao-finalizar" id="botaoConfirmarCompra">Confirmar compra</button>`;
    document.getElementById("moduloFinalizacaoCompra").classList.add("aberta");
    document.getElementById("botaoConfirmarCompra").addEventListener("click", () => {
        document.getElementById("conteudoModuloFinalizacao").innerHTML =
            `<div class="mensagem-sucesso">
          <div class="icone-sucesso">✓</div>
         <h2>Compra concluída com sucesso!</h2>
          <p style="color: rgb(105, 115, 125); margin-top: 8px">Esta é uma finalização simulada. Obrigado por comprar na TechNova Store.</p>
          <button class="botao-finalizar" id="botaoVoltarLoja">Voltar à loja</button>
        </div>`;
        document.getElementById("botaoVoltarLoja").addEventListener("click", () => {
            document.getElementById("moduloFinalizacaoCompra").classList.remove("aberta");
            fecharCarrinhoDeCompras();
            carrinho.itens = [];
            atualizarInterfaceCarrinho();
            exibirNotificacao("Compra finalizada.");
        });
    });
}

document.getElementById("botaoAbrirCarrinho").addEventListener("click", abrirCarrinhoDeCompras);
document.getElementById("botaoCarrinhoDestaque").addEventListener("click", abrirCarrinhoDeCompras);
document.getElementById("botaoFecharCarrinho").addEventListener("click", fecharCarrinhoDeCompras);
document.getElementById("botaoFinalizarCompra").addEventListener("click", processarFinalizacaoCompra);
document.getElementById("botaoFecharModulo").addEventListener("click", () => document.getElementById("moduloFinalizacaoCompra").classList.remove("aberta"));
document.getElementById("botaoVerProdutos").addEventListener("click", () => document.getElementById("catalogoProdutos").scrollIntoView({ behavior: "smooth" }));
entradaPesquisa.addEventListener("input", renderizarProdutos);
sobreposicaoCarrinho.addEventListener("click", evento => { if (evento.target === sobreposicaoCarrinho) fecharCarrinhoDeCompras(); });
document.getElementById("moduloFinalizacaoCompra").addEventListener("click", evento => {
    if (evento.target.id === "moduloFinalizacaoCompra") document.getElementById("moduloFinalizacaoCompra").classList.remove("aberta");
});
renderizarCategorias();
renderizarProdutos();
atualizarInterfaceCarrinho();
