-- PR6: ciclo de vida do espaço + convite.
-- 1) spaces.name opcional: null = o casal não definiu; o app calcula o nome exibido.
-- 2) create_space_with_invite / regenerate_invite sem a validade no argumento (o banco usa now() + 7 dias).
-- 3) invite_preview (pública), rename_space, leave_space e switch_space_and_redeem.

alter table public.spaces
  alter column name drop not null,
  alter column name drop default;

drop function public.create_space_with_invite(text, text, timestamptz);

create function public.create_space_with_invite(p_name text, p_code text)
returns table (space_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.space_members where user_id = auth.uid()) then
    raise exception 'already_in_space';
  end if;

  insert into public.spaces (name, created_by)
  values (nullif(trim(p_name), ''), auth.uid())
  returning id into v_space_id;

  insert into public.space_members (space_id, user_id, role)
  values (v_space_id, auth.uid(), 'owner');

  insert into public.invites (space_id, code, created_by, expires_at)
  values (v_space_id, upper(p_code), auth.uid(), now() + interval '7 days');

  return query select v_space_id, upper(p_code);
end;
$$;

drop function public.regenerate_invite(uuid, text, timestamptz);

create function public.regenerate_invite(p_space_id uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_space_member(p_space_id) then
    raise exception 'forbidden';
  end if;
  select count(*) into v_count from public.space_members where space_id = p_space_id;
  if v_count >= 2 then
    raise exception 'space_full';
  end if;

  delete from public.invites
  where space_id = p_space_id and redeemed_at is null;

  insert into public.invites (space_id, code, created_by, expires_at)
  values (p_space_id, upper(p_code), auth.uid(), now() + interval '7 days');

  return upper(p_code);
end;
$$;

-- Prévia da tela de convite, aberta antes do login: devolve só o mínimo
-- (sem títulos, e-mails ou ids). As miniaturas são os tipos dos itens.
create function public.invite_preview(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_status text;
  v_host text;
  v_item_count int := 0;
  v_thumbnails jsonb := '[]'::jsonb;
begin
  select * into v_invite
  from public.invites
  where code = upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));

  if not found then
    return jsonb_build_object(
      'status', 'invalid',
      'host_first_name', null,
      'item_count', 0,
      'thumbnails', '[]'::jsonb,
      'is_member', false
    );
  end if;

  if v_invite.redeemed_at is not null then
    v_status := 'used';
  elsif public.space_member_count(v_invite.space_id) >= 2 then
    v_status := 'full';
  elsif v_invite.expires_at <= now() then
    v_status := 'expired';
  else
    v_status := 'valid';
  end if;

  select nullif(split_part(trim(p.display_name), ' ', 1), '') into v_host
  from public.profiles p
  where p.id = v_invite.created_by;

  if v_status = 'valid' then
    select count(*)::int into v_item_count
    from public.items
    where space_id = v_invite.space_id and status = 'want';

    select coalesce(jsonb_agg(t.type order by t.created_at desc), '[]'::jsonb)
    into v_thumbnails
    from (
      select i.type, i.created_at
      from public.items i
      where i.space_id = v_invite.space_id and i.status = 'want'
      order by i.created_at desc
      limit 3
    ) t;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'host_first_name', v_host,
    'item_count', v_item_count,
    'thumbnails', v_thumbnails,
    'is_member', auth.uid() is not null and exists (
      select 1 from public.space_members m
      where m.space_id = v_invite.space_id and m.user_id = auth.uid()
    )
  );
end;
$$;

-- Não existe policy de update em spaces: qualquer membro renomeia por aqui.
create function public.rename_space(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select space_id into v_space_id
  from public.space_members
  where user_id = auth.uid();

  if v_space_id is null then
    raise exception 'forbidden';
  end if;

  update public.spaces
  set name = nullif(trim(p_name), '')
  where id = v_space_id;
end;
$$;

-- A última pessoa a sair apaga o espaço (cascade: itens, notas e convites).
-- Senão, os itens ficam com quem fica, que passa a ser 'owner' (só informativo).
create function public.leave_space()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select space_id, role into v_space_id, v_role
  from public.space_members
  where user_id = auth.uid();

  if v_space_id is null then
    raise exception 'forbidden';
  end if;

  perform 1 from public.spaces where id = v_space_id for update;

  if public.space_member_count(v_space_id) <= 1 then
    delete from public.spaces where id = v_space_id;
    return 'deleted';
  end if;

  delete from public.space_members
  where space_id = v_space_id and user_id = auth.uid();

  if v_role = 'owner' then
    update public.space_members
    set role = 'owner'
    where space_id = v_space_id;
  end if;

  return 'left';
end;
$$;

-- Quem já começou um espaço sozinho entra no do par numa transação só:
-- leva os itens (created_by e notas seguem o item) ou apaga o espaço antigo.
create function public.switch_space_and_redeem(p_code text, p_bring_items boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_old_space_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_invite
  from public.invites
  where code = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'invalid_invite';
  end if;
  if v_invite.redeemed_at is not null then
    raise exception 'invite_used';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite_expired';
  end if;
  if public.space_member_count(v_invite.space_id) >= 2 then
    raise exception 'space_full';
  end if;

  select space_id into v_old_space_id
  from public.space_members
  where user_id = auth.uid();

  if v_old_space_id = v_invite.space_id then
    raise exception 'own_invite';
  end if;

  if v_old_space_id is not null then
    perform 1 from public.spaces where id = v_old_space_id for update;

    if public.space_member_count(v_old_space_id) > 1 then
      raise exception 'space_has_partner';
    end if;

    if p_bring_items then
      update public.items
      set space_id = v_invite.space_id
      where space_id = v_old_space_id;
    end if;

    delete from public.spaces where id = v_old_space_id;
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (v_invite.space_id, auth.uid(), 'member');

  update public.invites
  set redeemed_at = now(), redeemed_by = auth.uid()
  where id = v_invite.id;

  return v_invite.space_id;
end;
$$;

-- Grants explícitos por RPC: só quem está logado executa.
revoke execute on function public.create_space_with_invite(text, text) from public, anon;
grant execute on function public.create_space_with_invite(text, text) to authenticated;

revoke execute on function public.regenerate_invite(uuid, text) from public, anon;
grant execute on function public.regenerate_invite(uuid, text) to authenticated;

revoke execute on function public.rename_space(text) from public, anon;
grant execute on function public.rename_space(text) to authenticated;

revoke execute on function public.leave_space() from public, anon;
grant execute on function public.leave_space() to authenticated;

revoke execute on function public.switch_space_and_redeem(text, boolean) from public, anon;
grant execute on function public.switch_space_and_redeem(text, boolean) to authenticated;

-- A única exceção: a prévia do convite abre antes do login (tela 7).
revoke execute on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;
