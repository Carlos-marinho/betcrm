-- BetCRM - Inicialização do Postgres
-- Roda automaticamente na primeira subida do container

-- Extensões úteis
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- busca textual
CREATE EXTENSION IF NOT EXISTS unaccent;       -- normalização BR
CREATE EXTENSION IF NOT EXISTS btree_gin;      -- índices GIN

-- Configurações de performance
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
