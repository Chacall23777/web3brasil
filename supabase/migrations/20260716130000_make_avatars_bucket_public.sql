-- Garante que o bucket 'avatars' existe e está marcado como público,
-- para que getPublicUrl() sirva os arquivos corretamente (evita erro 400).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;
