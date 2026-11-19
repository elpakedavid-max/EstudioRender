-- EstudioRender: tablas y permisos para sincronizar proyectos entre dispositivos.
-- Ejecutar una vez en Supabase → SQL Editor.

create table if not exists public.projects (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at bigint not null default 0,
  deleted boolean not null default false
);

alter table public.projects enable row level security;

-- Acceso desde la API solo para usuarios con sesión (RLS limita a sus propios proyectos)
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
revoke all on public.projects from anon;

drop policy if exists "projects_owner" on public.projects;
create policy "projects_owner" on public.projects
  for all using (owner = auth.uid()) with check (owner = auth.uid());

-- Almacenamiento privado para fotos y renders (cada usuario en su carpeta)
insert into storage.buckets (id, name, public)
values ('estudiorender', 'estudiorender', false)
on conflict (id) do nothing;

drop policy if exists "er_files_select" on storage.objects;
drop policy if exists "er_files_insert" on storage.objects;
drop policy if exists "er_files_update" on storage.objects;
drop policy if exists "er_files_delete" on storage.objects;

create policy "er_files_select" on storage.objects for select
  using (bucket_id = 'estudiorender' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "er_files_insert" on storage.objects for insert
  with check (bucket_id = 'estudiorender' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "er_files_update" on storage.objects for update
  using (bucket_id = 'estudiorender' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "er_files_delete" on storage.objects for delete
  using (bucket_id = 'estudiorender' and (storage.foldername(name))[1] = auth.uid()::text);
