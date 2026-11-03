-- Migração 002: execute APÓS schema.sql e seed_velo.sql.
-- Multiempresa, gestão de líderes, convites e permissões por unidade.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);
insert into public.profiles(id, display_name)
select id, coalesce(raw_user_meta_data->>'full_name', split_part(email,'@',1), 'Líder') from auth.users
on conflict (id) do nothing;
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1),'Líder'))
  on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.create_profile();

create table if not exists public.unit_assignments (
  company_id uuid not null,
  unit_id uuid not null,
  user_id uuid not null,
  primary key(unit_id,user_id),
  foreign key (unit_id, company_id) references public.units(id,company_id) on delete cascade,
  foreign key (company_id,user_id) references public.memberships(company_id,user_id) on delete cascade
);
create table if not exists public.invitations (
  token uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  unit_id uuid,
  email text not null,
  role text not null check(role in ('manager','member')),
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default(now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (unit_id,company_id) references public.units(id,company_id),
  check(role='manager' or unit_id is not null)
);
create index if not exists invitations_company_idx on public.invitations(company_id);
create index if not exists unit_assignments_user_idx on public.unit_assignments(user_id);

create or replace function public.can_access_unit(uid uuid,cid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.is_admin(cid) or exists (
   select 1 from public.unit_assignments ua
   where ua.company_id=cid and ua.unit_id=uid and ua.user_id=(select auth.uid())
 )
$$;
create or replace function public.shares_company_with(target_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(
  select 1 from public.memberships a join public.memberships b using(company_id)
  where a.user_id=(select auth.uid()) and b.user_id=target_id
 )
$$;

alter table public.profiles enable row level security;
alter table public.unit_assignments enable row level security;
alter table public.invitations enable row level security;
create policy profiles_read_shared on public.profiles for select to authenticated
 using(id=(select auth.uid()) or public.shares_company_with(id));
create policy unit_assignments_read on public.unit_assignments for select to authenticated
 using(public.is_admin(company_id) or user_id=(select auth.uid()));
create policy invitations_read_admin on public.invitations for select to authenticated using(public.is_admin(company_id));

-- Reforça permissões existentes: líderes só veem suas unidades e seus registros.
drop policy if exists units_select on public.units;
create policy units_select on public.units for select to authenticated using(public.can_access_unit(id,company_id));
drop policy if exists entries_select on public.entries;
create policy entries_select on public.entries for select to authenticated using(
 public.is_admin(company_id) or (author_id=(select auth.uid()) and public.can_access_unit(unit_id,company_id))
);
drop policy if exists entries_insert on public.entries;
create policy entries_insert on public.entries for insert to authenticated with check(
 public.is_member(company_id) and author_id=(select auth.uid())
 and public.can_access_unit(unit_id,company_id) and public.can_read_template(template_id,company_id)
);
drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries for update to authenticated using(
 author_id=(select auth.uid()) and status='draft' and public.can_access_unit(unit_id,company_id)
) with check(author_id=(select auth.uid()) and public.can_access_unit(unit_id,company_id));
drop policy if exists answers_select on public.entry_answers;
create policy answers_select on public.entry_answers for select to authenticated using(
 exists(select 1 from public.entries e where e.id=entry_id and (
   public.is_admin(e.company_id) or (e.author_id=(select auth.uid()) and public.can_access_unit(e.unit_id,e.company_id))
 ))
);

-- Convites emitidos por administradores, sem chave service_role no navegador.
create or replace function public.create_invitation(target_company uuid, target_email text, target_role text, target_unit uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare invite_token uuid;
begin
 if not public.is_admin(target_company) then raise exception 'Acesso não autorizado';end if;
 if target_role not in ('manager','member') then raise exception 'Perfil inválido';end if;
 if target_role='member' and target_unit is null then raise exception 'Selecione uma unidade para o líder';end if;
 if target_unit is not null and not exists(select 1 from public.units where id=target_unit and company_id=target_company) then
   raise exception 'Unidade não pertence à empresa';end if;
 if trim(target_email) !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'E-mail inválido';end if;
 insert into public.invitations(company_id,unit_id,email,role,created_by)
 values(target_company,target_unit,lower(trim(target_email)),target_role,auth.uid()) returning token into invite_token;
 return invite_token;
end $$;
create or replace function public.accept_invitation(invite_token uuid)
returns text language plpgsql security definer set search_path=public as $$
declare inv public.invitations%rowtype; current_email text;
begin
 if auth.uid() is null then raise exception 'Entre na plataforma primeiro';end if;
 current_email:=lower(coalesce(auth.jwt()->>'email',''));
 select * into inv from public.invitations where token=invite_token for update;
 if not found then raise exception 'Convite não encontrado';end if;
 if inv.accepted_at is not null or inv.expires_at < now() then raise exception 'Convite expirado ou utilizado';end if;
 if inv.email<>current_email then raise exception 'Entre com o e-mail que recebeu o convite';end if;
 if exists(select 1 from public.memberships where company_id=inv.company_id and user_id=auth.uid()) then
   -- Não rebaixa permissões de um membro existente.
   if inv.role='member' then
     insert into public.unit_assignments(company_id,unit_id,user_id)
     values(inv.company_id,inv.unit_id,auth.uid()) on conflict do nothing;
   end if;
 else
   insert into public.memberships(company_id,user_id,role) values(inv.company_id,auth.uid(),inv.role);
   if inv.role='member' then
     insert into public.unit_assignments(company_id,unit_id,user_id) values(inv.company_id,inv.unit_id,auth.uid());
   end if;
 end if;
 update public.invitations set accepted_at=now() where token=invite_token;
 return (select name from public.companies where id=inv.company_id);
end $$;
revoke all on function public.create_invitation(uuid,text,text,uuid) from public;
revoke all on function public.accept_invitation(uuid) from public;
grant execute on function public.create_invitation(uuid,text,text,uuid) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
