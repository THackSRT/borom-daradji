-- Développement : base séparée pour lancer les tests sur PostgreSQL (make test-pgsql)
-- sans toucher aux données de la base de travail.
CREATE DATABASE borom_test OWNER borom;
