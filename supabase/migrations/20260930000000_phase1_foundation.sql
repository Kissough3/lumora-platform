-- LUMORA Phase 1: tenant isolation + RLS on EXISTING tables.
-- Idempotent and non-destructive: creates no tables, drops no data.
-- ASSUMPTION (verify against live schema before applying):
--   organization_members(organization_id uuid, user_id uuid, role text)
--   tenant tables have organization_id uuid.

create or replace function public.lumora_is_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m
                 where m.organization_id = org and m.user_id = auth.uid());
$$;

create or replace function public.lumora_role(org uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.role from public.organization_members m
  where m.organization_id = org and m.user_id = auth.uid() limit 1;
$$;

-- Mirrors packages/core/src/permissions.ts (staff tiers only).
create or replace function public.lumora_can_write(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.lumora_role(org) in ('owner','admin','manager','assistant');
$$;

create or replace function public.lumora_is_admin(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.lumora_role(org) in ('owner','admin');
$$;

revoke all on function public.lumora_is_member(uuid), public.lumora_role(uuid),
  public.lumora_can_write(uuid), public.lumora_is_admin(uuid) from public, anon;
grant execute on function public.lumora_is_member(uuid), public.lumora_role(uuid),
  public.lumora_can_write(uuid), public.lumora_is_admin(uuid) to authenticated;

-- Apply policies only to tables that exist and have organization_id.
do $$
declare t text;
begin
  foreach t in array array['clients','leads','projects','bookings','tasks',
                           'automation_rules','automation_runs','media_assets']
  loop
    if exists (select 1 from information_schema.columns
               where table_schema='public' and table_name=t and column_name='organization_id') then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists lumora_select on public.%I', t);
      execute format('drop policy if exists lumora_insert on public.%I', t);
      execute format('drop policy if exists lumora_update on public.%I', t);
      execute format('drop policy if exists lumora_delete on public.%I', t);
      execute format('create policy lumora_select on public.%I for select to authenticated using (public.lumora_is_member(organization_id))', t);
      execute format('create policy lumora_insert on public.%I for insert to authenticated with check (public.lumora_can_write(organization_id))', t);
      execute format('create policy lumora_update on public.%I for update to authenticated using (public.lumora_can_write(organization_id)) with check (public.lumora_can_write(organization_id))', t);
      execute format('create policy lumora_delete on public.%I for delete to authenticated using (public.lumora_is_admin(organization_id))', t);
    end if;
  end loop;
end $$;

-- Payments: readable/writable only by owner/admin/manager/accountant.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='organization_id') then
    alter table public.payments enable row level security;
    drop policy if exists lumora_select on public.payments;
    drop policy if exists lumora_write on public.payments;
    create policy lumora_select on public.payments for select to authenticated
      using (public.lumora_role(organization_id) in ('owner','admin','manager','accountant'));
    create policy lumora_write on public.payments for all to authenticated
      using (public.lumora_role(organization_id) in ('owner','admin','accountant'))
      with check (public.lumora_role(organization_id) in ('owner','admin','accountant'));
  end if;
end $$;

-- Audit logs: admins read; no update/delete policy => immutable for users.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='organization_id') then
    alter table public.audit_logs enable row level security;
    drop policy if exists lumora_select on public.audit_logs;
    drop policy if exists lumora_insert on public.audit_logs;
    create policy lumora_select on public.audit_logs for select to authenticated using (public.lumora_is_admin(organization_id));
    create policy lumora_insert on public.audit_logs for insert to authenticated with check (public.lumora_is_member(organization_id));
    revoke update, delete on public.audit_logs from authenticated, anon;
  end if;
end $$;

-- Membership: members see co-members; only admins manage. No self-promotion.
alter table public.organization_members enable row level security;
drop policy if exists lumora_select on public.organization_members;
drop policy if exists lumora_manage on public.organization_members;
create policy lumora_select on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.lumora_is_member(organization_id));
create policy lumora_manage on public.organization_members for all to authenticated
  using (public.lumora_is_admin(organization_id)) with check (public.lumora_is_admin(organization_id));

alter table public.organizations enable row level security;
drop policy if exists lumora_select on public.organizations;
drop policy if exists lumora_update on public.organizations;
create policy lumora_select on public.organizations for select to authenticated using (public.lumora_is_member(id));
create policy lumora_update on public.organizations for update to authenticated
  using (public.lumora_role(id) = 'owner') with check (public.lumora_role(id) = 'owner');

-- Safe org creation: caller becomes owner atomically. Assumes organizations(name).
create or replace function public.lumora_create_organization(org_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if org_name is null or length(trim(org_name)) < 2 or length(org_name) > 120 then
    raise exception 'invalid organization name';
  end if;
  insert into public.organizations (name) values (trim(org_name)) returning id into new_id;
  insert into public.organization_members (organization_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;
revoke all on function public.lumora_create_organization(text) from public, anon;
grant execute on function public.lumora_create_organization(text) to authenticated;
