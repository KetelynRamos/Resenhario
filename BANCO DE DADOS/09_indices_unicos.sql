USE resenhario_db;

-- MIGRAÇÃO NÃO DESTRUTIVA: garante no próprio banco duas regras que hoje só o código verifica:
--   1) não existem dois usuários com o mesmo e-mail;
--   2) o mesmo livro não é vinculado duas vezes ao mesmo filme.
-- Cada índice só é criado se ainda não existir E se não houver dados duplicados.
-- Se houver duplicatas, o script apenas avisa (nada é apagado). Pode rodar mais de uma vez.

-- 1) E-mail único em Usuarios ---------------------------------------------------
SET @existe = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios' AND INDEX_NAME = 'UQ_Usuarios_Email');
SET @duplicados = (SELECT COUNT(*) FROM (SELECT Email FROM Usuarios GROUP BY Email HAVING COUNT(*) > 1) d);
SET @sql = CASE
    WHEN @existe > 0 THEN 'SELECT ''UQ_Usuarios_Email já existe'' AS aviso'
    WHEN @duplicados > 0 THEN 'SELECT ''Há e-mails repetidos em Usuarios: revise antes de criar o índice'' AS aviso'
    ELSE 'CREATE UNIQUE INDEX UQ_Usuarios_Email ON Usuarios (Email)'
END;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Par livro + filme único em Adaptacoes --------------------------------------
SET @existe = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Adaptacoes' AND INDEX_NAME = 'UQ_Adaptacoes_Livro_Filme');
SET @duplicados = (SELECT COUNT(*) FROM (SELECT IdLivro, IdFilme FROM Adaptacoes GROUP BY IdLivro, IdFilme HAVING COUNT(*) > 1) d);
SET @sql = CASE
    WHEN @existe > 0 THEN 'SELECT ''UQ_Adaptacoes_Livro_Filme já existe'' AS aviso'
    WHEN @duplicados > 0 THEN 'SELECT ''Há vínculos livro-filme repetidos: revise antes de criar o índice'' AS aviso'
    ELSE 'CREATE UNIQUE INDEX UQ_Adaptacoes_Livro_Filme ON Adaptacoes (IdLivro, IdFilme)'
END;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
