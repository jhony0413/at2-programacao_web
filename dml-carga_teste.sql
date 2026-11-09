-- Inserir Categorias
INSERT INTO categorias (nome) VALUES ('Informática'), ('Acessórios'), ('Gamer');

-- Inserir Produtos
INSERT INTO produtos (codigo, nome, categoria_id, preco, estoque, imagem) VALUES
('PROD001', 'Notebook Novabook', 1, 3299.90, 5, 'imagens/ilu1.png'),
('PROD002', 'Teclado Mecânico RGB', 2, 349.90, 8, 'imagens/ilu2.png'),
('PROD003', 'Mouse Gamer Pulse', 3, 189.90, 12, 'imagens/ilu3.png'),
('PROD004', 'Headset SoundMax', 3, 429.90, 3, 'imagens/ilu4.png'),
('PROD005', 'Monitor UltraView 27"', 1, 1399.90, 2, 'imagens/ilu5.png'),
('PROD006', 'Webcam Vision HD', 2, 249.90, 0, 'imagens/ilu6.png'),
('PROD007', 'Controle GamePad X', 3, 299.90, 6, 'imagens/ilu7.png'),
('PROD008', 'SSD Flash 1TB', 1, 499.90, 7, 'imagens/ilu8.png');