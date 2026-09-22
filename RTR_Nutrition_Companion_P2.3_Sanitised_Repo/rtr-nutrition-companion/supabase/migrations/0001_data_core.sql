-- RTR Nutrition Companion data-core scaffold.
-- Production activation requires Supabase project configuration, region/DPA review,
-- auth-flow device testing, and adversarial RLS tests.

create type public.rtr_role as enum ('client', 'coach');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.rtr_role not null,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);



-- Every authenticated user starts as a client. Coach privileges are granted
-- administratively; never trust user-controlled signup metadata for roles.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, role)
  values (new.id, 'client'::public.rtr_role);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create table public.coach_client_relationships (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references public.profiles(user_id) on delete cascade,
  client_user_id uuid not null references public.profiles(user_id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (coach_user_id, client_user_id),
  check (coach_user_id <> client_user_id)
);

create table public.client_events (
  id uuid primary key,
  client_user_id uuid not null references public.profiles(user_id) on delete cascade,
  device_id uuid not null,
  event_type text not null check (event_type in ('day.resolved', 'coach.update')),
  day_key date not null,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  check (octet_length(payload::text) <= 65536)
);
create index client_events_client_time_idx on public.client_events (client_user_id, occurred_at desc);
create index client_events_type_time_idx on public.client_events (client_user_id, event_type, occurred_at desc);

create table public.client_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references public.profiles(user_id) on delete cascade,
  device_id uuid not null,
  schema_version integer not null check (schema_version > 0),
  snapshot_hash text not null check (snapshot_hash ~ '^[a-f0-9]{64}$'),
  state jsonb not null,
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  unique (client_user_id, snapshot_hash),
  check (octet_length(state::text) <= 1048576)
);
create index client_snapshots_client_time_idx on public.client_snapshots (client_user_id, captured_at desc);

alter table public.profiles enable row level security;
alter table public.coach_client_relationships enable row level security;
alter table public.client_events enable row level security;
alter table public.client_snapshots enable row level security;

create policy profiles_read_self
on public.profiles for select to authenticated
using (user_id = auth.uid());

create policy profiles_coach_read_linked_client
on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.coach_client_relationships r
    where r.coach_user_id = auth.uid()
      and r.client_user_id = profiles.user_id
      and r.active
  )
);

create policy relationships_read_participant
on public.coach_client_relationships for select to authenticated
using (coach_user_id = auth.uid() or client_user_id = auth.uid());

create policy events_client_insert_own
on public.client_events for insert to authenticated
with check (
  client_user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'client'::public.rtr_role
  )
);

create policy events_client_read_own_or_coach
on public.client_events for select to authenticated
using (
  client_user_id = auth.uid()
  or exists (
    select 1 from public.coach_client_relationships r
    where r.coach_user_id = auth.uid()
      and r.client_user_id = client_events.client_user_id
      and r.active
  )
);

create policy snapshots_client_insert_own
on public.client_snapshots for insert to authenticated
with check (
  client_user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'client'::public.rtr_role
  )
);

create policy snapshots_client_read_own_or_coach
on public.client_snapshots for select to authenticated
using (
  client_user_id = auth.uid()
  or exists (
    select 1 from public.coach_client_relationships r
    where r.coach_user_id = auth.uid()
      and r.client_user_id = client_snapshots.client_user_id
      and r.active
  )
);

-- Least-privilege grants. Relationship/profile writes are administrative.
revoke all on public.profiles, public.coach_client_relationships, public.client_events, public.client_snapshots from anon, authenticated;
grant select on public.profiles, public.coach_client_relationships to authenticated;
grant select, insert on public.client_events, public.client_snapshots to authenticated;

-- Minimal coach read model for stage J. security_invoker keeps underlying RLS active.
create view public.coach_client_read_model
with (security_invoker = true) as
select
  r.client_user_id,
  p.display_name,
  (
    select max(e.occurred_at)
    from public.client_events e
    where e.client_user_id = r.client_user_id and e.event_type = 'day.resolved'
  ) as last_resolved_at,
  (
    select max(e.occurred_at)
    from public.client_events e
    where e.client_user_id = r.client_user_id and e.event_type = 'coach.update'
  ) as last_manual_update_at,
  (
    select max(s.captured_at)
    from public.client_snapshots s
    where s.client_user_id = r.client_user_id
  ) as latest_snapshot_at
from public.coach_client_relationships r
join public.profiles p on p.user_id = r.client_user_id
where r.coach_user_id = auth.uid() and r.active;

revoke all on public.coach_client_read_model from anon, authenticated;
grant select on public.coach_client_read_model to authenticated;
