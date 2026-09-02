-- Cada cabaña usa una base independiente. El registro de clientes pertenece
-- exclusivamente al panel maestro, no a las bases individuales.
drop table if exists public.client_sites;
