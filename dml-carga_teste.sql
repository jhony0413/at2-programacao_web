USE rubigamer_db;

INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES
('Administrador RubiGamer', 'admin@rubigamer.com', '$2b$10$MRrbos9G8oHr2f25fyIceexYSu8BF2Q.tgerWyZ9KbJ.3RMLC.ul2', 'admin'),
('Cliente Demonstração', 'cliente@rubigamer.com', '$2b$10$dgIGDZZa6j83IPYyQkhXGOSGK3eL4rAappx5J.Gjv1xdvjAH6n73m', 'cliente');

INSERT INTO categorias (nome) VALUES
('Informática'),
('Acessórios'),
('Gamer');

INSERT INTO produtos (codigo, nome, categoria_id, preco, estoque, imagem, ativo) VALUES
('PROD001', 'Notebook Novabook', 1, 3299.90, 5, 'imagens/ilu1.png', TRUE),
('PROD002', 'Teclado Mecânico RGB', 2, 349.90, 8, 'imagens/ilu2.png', TRUE),
('PROD003', 'Mouse Gamer Pulse', 3, 189.90, 12, 'imagens/ilu3.png', TRUE),
('PROD004', 'Headset SoundMax', 3, 429.90, 3, 'imagens/ilu4.png', TRUE),
('PROD005', 'Monitor UltraView 27"', 1, 1399.90, 2, 'imagens/ilu5.png', TRUE),
('PROD006', 'Webcam Vision HD', 2, 249.90, 0, 'imagens/ilu6.png', TRUE),
('PROD007', 'Controle GamePad X', 3, 299.90, 6, 'imagens/ilu7.png', TRUE),
('PROD008', 'SSD Flash 1TB', 1, 499.90, 7, 'imagens/ilu8.png', TRUE);

INSERT INTO movimentacoes_estoque (produto_codigo, usuario_id, tipo, quantidade, saldo_resultante, motivo) VALUES
('PROD001', 1, 'entrada', 5, 5, 'Carga inicial de estoque'),
('PROD002', 1, 'entrada', 8, 8, 'Carga inicial de estoque'),
('PROD003', 1, 'entrada', 12, 12, 'Carga inicial de estoque'),
('PROD004', 1, 'entrada', 3, 3, 'Carga inicial de estoque'),
('PROD005', 1, 'entrada', 2, 2, 'Carga inicial de estoque'),
('PROD006', 1, 'entrada', 0, 0, 'Carga inicial de estoque'),
('PROD007', 1, 'entrada', 6, 6, 'Carga inicial de estoque'),
('PROD008', 1, 'entrada', 7, 7, 'Carga inicial de estoque');