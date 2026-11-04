-- Apply after schema.sql, seed_diarios.sql and 002_gestora_multiempresa.sql.
begin;
create table public.platform_managers(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.platform_managers enable row level security;
-- Preserve existing owners as authorized managers; future provisioning is explicit.
insert into public.platform_managers select distinct user_id from public.memberships where role='owner';
create or replace function public.new_company(company_name text,unit_name text default 'Unidade principal') returns uuid
language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
 if not exists(select 1 from platform_managers where user_id=auth.uid()) then raise exception 'Gestora não autorizada. Solicite o provisionamento da conta.'; end if;
 if length(trim(company_name))<2 then raise exception 'Nome inválido'; end if;
 insert into companies(name) values(trim(company_name)) returning id into cid;
 insert into memberships values(cid,auth.uid(),'owner');
 insert into units(company_id,name) values(cid,coalesce(nullif(trim(unit_name),''),'Unidade principal'));
 return cid;
end $$;
drop policy memberships_select on public.memberships;
create policy memberships_select on public.memberships for select to authenticated using(user_id=auth.uid() or is_admin(company_id));
drop policy profiles_read_shared on public.profiles;
create policy profiles_read_shared on public.profiles for select to authenticated using(id=auth.uid() or exists(select 1 from memberships m where m.user_id=profiles.id and is_admin(m.company_id)));
create policy companies_update on public.companies for update to authenticated using(is_admin(id)) with check(is_admin(id));
create policy units_update on public.units for update to authenticated using(is_admin(company_id)) with check(is_admin(company_id));
-- Validate unit identity on edits; changing tenants is never permitted.
create function public.protect_unit() returns trigger language plpgsql as $$ begin
if new.company_id<>old.company_id then raise exception 'Empresa imutável'; end if; return new; end $$;
create trigger protect_unit before update on public.units for each row execute function public.protect_unit();

create table public.template_versions(
 id uuid primary key default gen_random_uuid(),
 template_id uuid not null references public.templates,
 company_id uuid references public.companies,
 version integer not null check(version>0),
 template_name text not null,
 description text not null default '',
 frequency text not null check(frequency in ('daily','weekly','monthly','custom')),
 fields jsonb not null check(jsonb_typeof(fields)='array'),
 created_at timestamptz not null default now(),
 unique(template_id,version),unique(id,template_id)
);
alter table public.template_versions enable row level security;
create policy versions_read on public.template_versions for select to authenticated using(company_id is null or is_member(company_id));
alter table public.templates drop constraint templates_cadence_check;
alter table public.templates add constraint templates_cadence_check check(cadence in ('daily','weekly','monthly','custom'));
-- Copy original questions and extra fields into immutable first versions.
insert into public.template_versions(template_id,company_id,version,template_name,frequency,fields)
select t.id,t.company_id,1,t.name,t.cadence,
coalesce((select jsonb_agg(jsonb_build_object('id',i.id::text,'category',s.title,'label',i.title,'type','boolean','required',false,'options','[]'::jsonb) order by s.position,i.position)
 from sections s join items i on i.section_id=s.id where s.template_id=t.id),'[]'::jsonb)
||
case t.cadence
when 'daily' then '[{"id":"shift","label":"Turno / horário","type":"text"},{"id":"sales","label":"Vendas","type":"number"},{"id":"goal","label":"Meta","type":"number"},{"id":"visits","label":"Atendimentos","type":"number"},{"id":"complaints","label":"Reclamações","type":"number"},{"id":"occurrences","label":"Ocorrências, ações, responsáveis e prazos","type":"text"},{"id":"pending","label":"Pendências para o dia seguinte","type":"text"}]'::jsonb
when 'weekly' then '[{"id":"sales","label":"Vendas: meta / realizado / ação","type":"text"},{"id":"visits","label":"Atendimentos: meta / realizado / ação","type":"text"},{"id":"retention","label":"Retenção: meta / realizado / ação","type":"text"},{"id":"occurrences","label":"Ocorrências: meta / realizado / ação","type":"text"},{"id":"plan","label":"Plano de ação (prioridade, responsável, prazo e status)","type":"text"}]'::jsonb
else '[{"id":"sales","label":"Vendas: meta / resultado / observações","type":"text"},{"id":"visits","label":"Atendimentos: meta / resultado / observações","type":"text"},{"id":"retention","label":"Retenção: meta / resultado / observações","type":"text"},{"id":"team","label":"Desempenho da equipe: meta / resultado / observações","type":"text"},{"id":"wins","label":"Principais conquistas","type":"text"},{"id":"risks","label":"Desafios / riscos","type":"text"},{"id":"decisions","label":"Decisões necessárias dos sócios","type":"text"},{"id":"priorities","label":"Prioridades do próximo mês (ação, responsável e prazo)","type":"text"}]'::jsonb end
from templates t;
update template_versions v set fields=(select jsonb_agg(
f || jsonb_build_object('category',coalesce(f->>'category',case v.frequency when 'daily' then 'Comercial e indicadores' when 'weekly' then 'Indicadores e plano de ação' else 'Indicadores e prioridades do próximo mês' end),'required',coalesce((f->>'required')::boolean,false),'options',coalesce(f->'options','[]'::jsonb))
order by ord) from jsonb_array_elements(v.fields) with ordinality q(f,ord));
alter table public.entries add column version_id uuid;
alter table public.entries add constraint entry_version foreign key(version_id,template_id) references public.template_versions(id,template_id);
alter table public.entries add column responses jsonb not null default '{}';
alter table public.entries add column due_at timestamptz;
alter table public.entries add column completed_at timestamptz;
alter table public.entries add column scheduled boolean not null default false;
-- Temporarily remove immutable-entry trigger for migration backfill only.
drop trigger validate_entries on public.entries;
update entries e set version_id=v.id,
responses=e.details||coalesce((select jsonb_object_agg(item_id::text,to_jsonb(done)) from entry_answers a where a.entry_id=e.id),'{}'),
completed_at=case when e.status='submitted' then e.updated_at end
from template_versions v where v.template_id=e.template_id and v.version=1;
alter table public.entries alter column version_id set not null;
-- Historical records have no known deadline; do not invent overdue status for them.
create function public.valid_responses(fields jsonb, responses jsonb, final boolean) returns void language plpgsql as $$
declare q jsonb; v jsonb; d date; opt jsonb;
begin
if jsonb_typeof(responses)<>'object' then raise exception 'Respostas inválidas'; end if;
for q in select * from jsonb_array_elements(fields) loop
v:=responses->(q->>'id');
if final and coalesce((q->>'required')::boolean,false) and (v is null or v='null' or v='""' or v='[]') then raise exception 'Campo obrigatório: %',q->>'label'; end if;
if v is null or v='null' or v='""' then continue; end if;
if q->>'type'='number' and jsonb_typeof(v)<>'number' then raise exception 'Número inválido'; end if;
if q->>'type'='boolean' and jsonb_typeof(v)<>'boolean' then raise exception 'Resposta Sim/Não inválida'; end if;
if q->>'type' in ('text','date','select') and jsonb_typeof(v)<>'string' then raise exception 'Texto inválido'; end if;
if q->>'type'='date' then
if (v#>>'{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data inválida'; end if;
d:=(v#>>'{}')::date;
end if;
if q->>'type'='select' and not (coalesce(q->'options','[]') @> jsonb_build_array(v)) then raise exception 'Opção inválida'; end if;
if q->>'type'='checklist' then
if jsonb_typeof(v)<>'array' then raise exception 'Checklist inválido'; end if;
for opt in select * from jsonb_array_elements(v) loop
if not (coalesce(q->'options','[]') @> jsonb_build_array(opt)) then raise exception 'Opção inválida'; end if;
end loop;
end if;
end loop;
if exists(select 1 from jsonb_object_keys(responses) k where not exists(select 1 from jsonb_array_elements(fields) f where f->>'id'=k)) then raise exception 'Campo desconhecido'; end if;
end $$;
create or replace function public.validate_entry() returns trigger language plpgsql security definer set search_path=public as $$
declare v template_versions;
begin
select * into v from template_versions where id=new.version_id and template_id=new.template_id;
if not found or (v.company_id is not null and v.company_id<>new.company_id) then raise exception 'Versão inválida'; end if;
if not can_read_template(new.template_id,new.company_id) then raise exception 'Modelo inválido'; end if;
if tg_op='UPDATE' then
if old.status='submitted' then raise exception 'Registro finalizado é imutável'; end if;
if (new.company_id,new.unit_id,new.template_id,new.author_id,new.period_start,new.version_id,new.due_at,new.scheduled) is distinct from
(old.company_id,old.unit_id,old.template_id,old.author_id,old.period_start,old.version_id,old.due_at,old.scheduled) then raise exception 'Atribuição imutável'; end if;
end if;
perform valid_responses(v.fields,new.responses,new.status='submitted');
new.completed_at:=case when new.status='submitted' then now() else null end;
return new;
end $$;
create trigger validate_entries before insert or update on public.entries for each row execute function public.validate_entry();
-- Answers inherited from the legacy model cannot be mutated after a leader loses access.
create or replace function public.entry_is_editable(eid uuid) returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from entries where id=eid and status='draft' and author_id=auth.uid() and can_access_unit(unit_id,company_id)) $$;
create function public.canonical_period(frequency text, day date) returns date language sql immutable as $$
select case frequency when 'weekly' then date_trunc('week',day::timestamp)::date when 'monthly' then date_trunc('month',day::timestamp)::date else day end $$;
-- Drafts and submissions are saved in one transaction. Submitted responses are immutable.
create function public.save_diary(target_entry uuid,target_company uuid,target_unit uuid,target_version uuid,target_period date,payload jsonb,finalize boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare e entries; v template_versions; eid uuid;
begin
if auth.uid() is null or not is_member(target_company) or not can_access_unit(target_unit,target_company) then raise exception 'Acesso negado'; end if;
select * into v from template_versions where id=target_version;
if not found or (v.company_id is not null and v.company_id<>target_company) then raise exception 'Versão não autorizada'; end if;
if target_entry is null then
target_period:=canonical_period(v.frequency,target_period);
insert into entries(company_id,unit_id,template_id,version_id,author_id,period_start,responses,status)
values(target_company,target_unit,v.template_id,v.id,auth.uid(),target_period,payload,case when finalize then 'submitted' else 'draft' end)
returning id into eid;
else
select * into e from entries where id=target_entry for update;
if not found or e.author_id<>auth.uid() or e.company_id<>target_company or e.unit_id<>target_unit or e.version_id<>target_version or e.period_start<>target_period then raise exception 'Registro não autorizado'; end if;
update entries set responses=payload,status=case when finalize then 'submitted' else 'draft' end where id=e.id;
eid:=e.id;
end if;
return eid;
end $$;
create function public.publish_template(target_company uuid,target_template uuid,template_name text,template_description text,frequency text,questions jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare tid uuid; vid uuid; n integer; q jsonb;
begin
if not is_admin(target_company) then raise exception 'Acesso negado'; end if;
if frequency not in ('daily','weekly','monthly','custom') or length(trim(template_name))<2 or jsonb_typeof(questions)<>'array' or jsonb_array_length(questions)=0 then raise exception 'Modelo inválido'; end if;
if (select count(*)<>count(distinct f->>'id') from jsonb_array_elements(questions) f) then raise exception 'IDs duplicados'; end if;
for q in select * from jsonb_array_elements(questions) loop
if coalesce(q->>'id','')='' or coalesce(q->>'label','')='' or coalesce(q->>'category','')='' or coalesce(q->>'type','') not in ('text','number','boolean','select','date','checklist') or jsonb_typeof(q->'required') is distinct from 'boolean' then raise exception 'Pergunta inválida'; end if;
if q->>'type' in ('select','checklist') and (jsonb_typeof(q->'options') is distinct from 'array' or jsonb_array_length(q->'options')=0) then raise exception 'Informe opções'; end if;
if q->>'type' in ('select','checklist') and exists(select 1 from jsonb_array_elements(q->'options') o where jsonb_typeof(o)<>'string' or length(trim(o#>>'{}'))=0) then raise exception 'Opções vazias ou inválidas'; end if;
end loop;
if target_template is null then
insert into templates(company_id,cadence,name) values(target_company,frequency,trim(template_name)) returning id into tid;
else
select id into tid from templates where id=target_template and company_id=target_company for update;
if tid is null then raise exception 'Modelo não autorizado'; end if;
update templates set name=trim(template_name),cadence=frequency where id=tid;
end if;
select coalesce(max(version),0)+1 into n from template_versions where template_id=tid;
insert into template_versions(template_id,company_id,version,template_name,description,frequency,fields) values(tid,target_company,n,trim(template_name),template_description,frequency,questions) returning id into vid;
return vid;
end $$;
create function public.assign_diary(target_company uuid,target_unit uuid,target_user uuid,target_version uuid,target_period date,deadline timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare v template_versions; eid uuid;
begin
if not is_admin(target_company) then raise exception 'Acesso negado'; end if;
if not exists(select 1 from unit_assignments where company_id=target_company and unit_id=target_unit and user_id=target_user) then raise exception 'Líder sem acesso à unidade'; end if;
if deadline is null or deadline<(target_period::timestamp at time zone 'America/Sao_Paulo') then raise exception 'Prazo inválido'; end if;
select * into v from template_versions where id=target_version;
if not found or (v.company_id is not null and v.company_id<>target_company) then raise exception 'Versão inválida'; end if;
target_period:=canonical_period(v.frequency,target_period);
insert into entries(company_id,unit_id,author_id,template_id,version_id,period_start,due_at,scheduled)
values(target_company,target_unit,target_user,v.template_id,v.id,target_period,deadline,true) returning id into eid;
return eid;
end $$;
create table public.incidents(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references companies,
 unit_id uuid not null,responsible_id uuid not null,description text not null check(length(trim(description))>0),
 priority text not null check(priority in ('low','medium','high')),opened_at timestamptz not null default now(),
 deadline date not null,status text not null default 'open' check(status in ('open','resolved')),
 notes text not null default '',solution text not null default '',
 foreign key(unit_id,company_id) references units(id,company_id),
 foreign key(company_id,responsible_id) references memberships(company_id,user_id));
create table public.action_plans(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references companies,description text not null,
 deadline date not null,status text not null default 'open' check(status in ('open','completed')));
create table public.indicators(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references companies,
 unit_id uuid not null,name text not null,value numeric not null,measured_at date not null,
 foreign key(unit_id,company_id) references units(id,company_id));
create table public.audit_log(
 id bigint generated always as identity primary key,company_id uuid references companies,actor uuid,
 entity text not null,entity_id uuid,action text not null,created_at timestamptz not null default now());
alter table public.incidents enable row level security;
alter table public.action_plans enable row level security;
alter table public.indicators enable row level security;
alter table public.audit_log enable row level security;
create policy incidents_read on incidents for select to authenticated using(is_admin(company_id) or (responsible_id=auth.uid() and can_access_unit(unit_id,company_id)));
create policy incidents_insert on incidents for insert to authenticated with check(can_access_unit(unit_id,company_id) and (is_admin(company_id) or responsible_id=auth.uid()));
create policy incidents_update on incidents for update to authenticated using(is_admin(company_id)) with check(is_admin(company_id));
create policy plans_manage on action_plans for all to authenticated using(is_admin(company_id)) with check(is_admin(company_id));
create policy indicators_read on indicators for select to authenticated using(can_access_unit(unit_id,company_id));
create policy indicators_insert on indicators for insert to authenticated with check(is_admin(company_id));
create policy audit_read on audit_log for select to authenticated using(is_admin(company_id));
create function public.audit_record() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into audit_log(company_id,actor,entity,entity_id,action) values(new.company_id,auth.uid(),tg_table_name,new.id,tg_op);return new;end $$;
create trigger audit_entries after insert or update on entries for each row execute function public.audit_record();
create trigger audit_versions after insert on template_versions for each row execute function public.audit_record();
create trigger audit_incidents after insert or update on incidents for each row execute function public.audit_record();
-- Verified email required for accepting a company invitation.
create or replace function public.accept_invitation(invite_token uuid) returns text language plpgsql security definer set search_path=public as $$
declare inv invitations; mail text;
begin
select lower(email) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
if mail is null then raise exception 'Confirme seu e-mail antes de aceitar'; end if;
select * into inv from invitations where token=invite_token for update;
if not found or inv.accepted_at is not null or inv.expires_at<now() or inv.email<>mail then raise exception 'Convite inválido, expirado ou de outro e-mail'; end if;
insert into memberships values(inv.company_id,auth.uid(),inv.role) on conflict do nothing;
if inv.unit_id is not null then insert into unit_assignments values(inv.company_id,inv.unit_id,auth.uid()) on conflict do nothing; end if;
update invitations set accepted_at=now() where token=invite_token;
return (select name from companies where id=inv.company_id);
end $$;
-- Transactional RPCs own writes; prevent bypass via REST.
drop policy entries_insert on public.entries;
drop policy entries_update on public.entries;
drop policy answers_insert on public.entry_answers;
drop policy answers_update on public.entry_answers;
revoke execute on function public.save_diary(uuid,uuid,uuid,uuid,date,jsonb,boolean),public.publish_template(uuid,uuid,text,text,text,jsonb),public.assign_diary(uuid,uuid,uuid,uuid,date,timestamptz) from public,anon;
grant execute on function public.save_diary(uuid,uuid,uuid,uuid,date,jsonb,boolean),public.publish_template(uuid,uuid,text,text,text,jsonb),public.assign_diary(uuid,uuid,uuid,uuid,date,timestamptz) to authenticated;
create index on entries(author_id,due_at);
create index on template_versions(template_id,version desc);
create or replace function public.can_read_template(tid uuid,cid uuid) returns boolean language sql stable security definer set search_path=public as $$
select is_member(cid) and exists(select 1 from templates where id=tid and (company_id is null or company_id=cid)) $$;
-- Helper functions exposed through PostgREST must not reveal entries from other tenants.
create or replace function public.entry_company(eid uuid) returns uuid language sql stable security definer set search_path=public as $$
select company_id from entries where id=eid and (is_admin(company_id) or (author_id=auth.uid() and can_access_unit(unit_id,company_id))) $$;
create or replace function public.shares_company_with(target_id uuid) returns boolean language sql stable security definer set search_path=public as $$
select target_id=auth.uid() or exists(select 1 from memberships m where m.user_id=target_id and is_admin(m.company_id)) $$;
create function public.protect_incident() returns trigger language plpgsql as $$
begin
if (new.company_id,new.unit_id,new.opened_at) is distinct from (old.company_id,old.unit_id,old.opened_at) then raise exception 'Origem da ocorrência imutável'; end if;
if new.status='resolved' and length(trim(new.solution))=0 then raise exception 'Informe a solução'; end if;
return new; end $$;
create trigger protect_incident before update on public.incidents for each row execute function public.protect_incident();
create function public.manage_unit_access(target_company uuid,target_unit uuid,target_user uuid,allow boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
if not is_admin(target_company) then raise exception 'Acesso negado'; end if;
if not exists(select 1 from memberships where company_id=target_company and user_id=target_user and role='member') then raise exception 'Líder inválido'; end if;
if not exists(select 1 from units where id=target_unit and company_id=target_company) then raise exception 'Unidade inválida'; end if;
if allow then insert into unit_assignments values(target_company,target_unit,target_user) on conflict do nothing;
else delete from unit_assignments where company_id=target_company and unit_id=target_unit and user_id=target_user;
end if;
insert into audit_log(company_id,actor,entity,entity_id,action) values(target_company,auth.uid(),'unit_assignments',target_user,case when allow then 'GRANT' else 'REVOKE' end);
end $$;
create function public.revoke_invitation(invite_token uuid) returns void language plpgsql security definer set search_path=public as $$
declare cid uuid;begin
select company_id into cid from invitations where token=invite_token for update;
if cid is null or not is_admin(cid) then raise exception 'Acesso negado'; end if;
update invitations set expires_at=now() where token=invite_token and accepted_at is null;
end $$;
revoke execute on function public.manage_unit_access(uuid,uuid,uuid,boolean),public.revoke_invitation(uuid) from public,anon;
grant execute on function public.manage_unit_access(uuid,uuid,uuid,boolean),public.revoke_invitation(uuid) to authenticated;

commit;
