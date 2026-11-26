# E-commerce RubiGamer

Aplicação Web full-stack para simulação de loja virtual de tecnologia, games e acessórios, desenvolvida com HTML, CSS, JavaScript, Node.js, Express e MySQL.

## Estrutura do projeto

* `server.js`: servidor Express, autenticação/sessão, regras de negócio e transações no MySQL.
* `index.html`, `style.css`, `script.js`: interface da loja, catálogo, carrinho, histórico de pedidos e painel administrativo.
* `ddl.sql`: criação do banco `rubigamer_db`, tabelas, chaves, relacionamentos e restrições.
* `dml-carga_teste.sql`: carga inicial de usuários, categorias, produtos e movimentações de estoque.
* `.env.example`: modelo de variáveis de ambiente sem credenciais reais.
* `package.json`: dependências e scripts do projeto.

## Pré-requisitos

* Node.js (v18 ou superior)
* MySQL Server (ou MariaDB compatível)

## Configuração e execução

1. Instale as dependências do backend:

```bash
npm install
```

2. Configure as variáveis de ambiente copiando o arquivo de exemplo e preenchendo os dados locais:

```bash
cp .env.example .env
```

3. Crie o banco de dados e popule os registros iniciais no MySQL:

```bash
mysql -u seu_usuario_mysql -p < ddl.sql
mysql -u seu_usuario_mysql -p < dml-carga_teste.sql
```

4. Inicie o servidor:

```bash
npm start
```

5. Acesse a aplicação no navegador em `http://localhost:3000`

## Credenciais de demonstração

* **Administrador:** `admin@rubigamer.com` / `Admin123!`
* **Cliente:** `cliente@rubigamer.com` / `cliente123!`