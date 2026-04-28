alter table projects add column if not exists scope_in  text[] default '{}';
alter table projects add column if not exists scope_out text[] default '{}';
