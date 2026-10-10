-- Développement : base séparée pour lancer les tests sur MySQL (make test-mysql)
-- sans toucher aux données de la base de travail.
CREATE DATABASE IF NOT EXISTS borom_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON borom_test.* TO 'borom'@'%';
