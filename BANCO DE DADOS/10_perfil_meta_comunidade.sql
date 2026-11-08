USE resenhario_db;

-- MIGRAÇÃO NÃO DESTRUTIVA: perfil do usuário, meta de leitura e interações do feed.
-- Só cria o que ainda não existe. Pode ser executada mais de uma vez.
-- IMPORTANTE: rode este script no banco ANTES de publicar a versão nova da API.

-- 1) Perfil e meta de leitura em Usuarios ------------------------------------------
-- Mesmo padrão do script 05: só adiciona a coluna se ela ainda não existir.

-- frase do perfil
SET @existe = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios' AND COLUMN_NAME = 'Bio');
SET @sql = IF(@existe = 0, 'ALTER TABLE Usuarios ADD COLUMN Bio VARCHAR(280) NULL', 'SELECT ''Usuarios.Bio já existe'' AS aviso');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- livro favorito
SET @existe = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios' AND COLUMN_NAME = 'LivroFavorito');
SET @sql = IF(@existe = 0, 'ALTER TABLE Usuarios ADD COLUMN LivroFavorito VARCHAR(200) NULL', 'SELECT ''Usuarios.LivroFavorito já existe'' AS aviso');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- avatar pronto ou foto enviada
SET @existe = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios' AND COLUMN_NAME = 'Avatar');
SET @sql = IF(@existe = 0, 'ALTER TABLE Usuarios ADD COLUMN Avatar MEDIUMTEXT NULL', 'SELECT ''Usuarios.Avatar já existe'' AS aviso');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- meta: livros em 6 meses
SET @existe = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios' AND COLUMN_NAME = 'MetaLivros');
SET @sql = IF(@existe = 0, 'ALTER TABLE Usuarios ADD COLUMN MetaLivros INT NULL', 'SELECT ''Usuarios.MetaLivros já existe'' AS aviso');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- quando a meta começou
SET @existe = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios' AND COLUMN_NAME = 'MetaInicio');
SET @sql = IF(@existe = 0, 'ALTER TABLE Usuarios ADD COLUMN MetaInicio DATETIME NULL', 'SELECT ''Usuarios.MetaInicio já existe'' AS aviso');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Curtidas nas resenhas ------------------------------------------------------------
-- Uma pessoa curte uma resenha no máximo uma vez (índice único).
-- ON DELETE CASCADE: se a resenha for apagada, as curtidas dela vão junto.
CREATE TABLE IF NOT EXISTS Curtidas (
    IdCurtida INT AUTO_INCREMENT PRIMARY KEY,
    IdReview INT NOT NULL,
    IdUsuario INT NOT NULL,
    DataCriacao DATETIME NOT NULL,
    UNIQUE KEY UQ_Curtidas_Review_Usuario (IdReview, IdUsuario),
    FOREIGN KEY (IdReview) REFERENCES Reviews(IdReviews) ON DELETE CASCADE,
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

-- 3) Comentários nas resenhas ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Comentarios (
    IdComentario INT AUTO_INCREMENT PRIMARY KEY,
    IdReview INT NOT NULL,
    IdUsuario INT NOT NULL,
    Texto VARCHAR(1000) NOT NULL,
    DataCriacao DATETIME NOT NULL,
    FOREIGN KEY (IdReview) REFERENCES Reviews(IdReviews) ON DELETE CASCADE,
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);
