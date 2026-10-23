-- PR2: login com Google + código no e-mail.
-- 1) profiles.onboarded_at: a tela "Seu nome" aparece uma vez só.
-- 2) handle_new_user passa a usar o nome do Google (só o primeiro nome).

alter table public.profiles
  add column onboarded_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1)
  );

  -- O Google manda o nome completo: guarda só o primeiro nome, até 40 caracteres.
  v_name := left(split_part(regexp_replace(trim(v_name), '\s+', ' ', 'g'), ' ', 1), 40);

  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(v_name, ''), 'eu'));

  return new;
end;
$$;

-- Quem já usa o app (já está num espaço) não vê a tela "Seu nome".
update public.profiles p
set onboarded_at = now()
where p.onboarded_at is null
  and exists (
    select 1 from public.space_members m where m.user_id = p.id
  );
