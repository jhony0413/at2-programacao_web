const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express()
const port = 3000

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // altera se precisar
    password: '',      // põe sua senha
    database: 'nomeloja_db'
});

db.connect((err) => {
    if (err) {
        console.error('Erro de conexão com MySQL:', err);
        return;
    }
    console.log('Conexão com MySQL bem sucedida.');
});

app.use(express.static(path.join(__dirname)));
app.use(express.json());

app.get('/api/produtos', (req, res) => {
    const query = `
        SELECT P.codigo, P.nome, C.nome AS categoria, P.preco, P.estoque, P.imagem 
        FROM produtos P
        JOIN categorias C ON P.categoria_id = C.id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Erro em buscar produtos:', err);
            res.status(500).json({ erro: 'Erro do servidor' });
            return;
        }
        res.json(results);
    });
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})