-- Rode no pgAdmin (Query Tool) conectado ao servidor PostgreSQL 18, banco "postgres".
-- Troque 'TROQUE_ESTA_SENHA' pela senha que você quer para o qop_user ANTES de executar.

CREATE USER qop_user WITH PASSWORD 'TROQUE_ESTA_SENHA';

-- Execute este comando separado se o pgAdmin reclamar de transação:
CREATE DATABASE qop OWNER qop_user ENCODING 'UTF8' TEMPLATE template0;
