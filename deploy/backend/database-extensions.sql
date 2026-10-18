-- Run once as the database administrator in the Portal database, before
-- application migrations. Example from a checkout on the database server:
-- sudo -u postgres psql --dbname=insurance_portal_db --set=ON_ERROR_STOP=1 \
--   --file=deploy/backend/database-extensions.sql
-- For a remote/managed database, use its administrative psql connection.
-- Keep the application/deployment database role unprivileged.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
