create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date,
  location text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  quantity text,
  store text,
  notes text,
  buyer text,
  done boolean not null default false,
  purchase_value numeric(12, 2),
  purchase_value_input numeric(12, 2),
  purchase_value_mode text not null default 'total' check (purchase_value_mode in ('total', 'unit')),
  created_at timestamptz not null default now()
);

create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (event_id, name)
);

create table if not exists public.purchase_locations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (event_id, name)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row
execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.artists enable row level security;
alter table public.rooms enable row level security;
alter table public.items enable row level security;
alter table public.buyers enable row level security;
alter table public.purchase_locations enable row level security;

create policy "authenticated users can read events"
on public.events for select
to authenticated
using (true);

create policy "authenticated users can write events"
on public.events for all
to authenticated
using (true)
with check (true);

create policy "authenticated users can read artists"
on public.artists for select
to authenticated
using (true);

create policy "authenticated users can write artists"
on public.artists for all
to authenticated
using (true)
with check (true);

create policy "authenticated users can read rooms"
on public.rooms for select
to authenticated
using (true);

create policy "authenticated users can write rooms"
on public.rooms for all
to authenticated
using (true)
with check (true);

create policy "authenticated users can read items"
on public.items for select
to authenticated
using (true);

create policy "authenticated users can write items"
on public.items for all
to authenticated
using (true)
with check (true);

create policy "authenticated users can read buyers"
on public.buyers for select
to authenticated
using (true);

create policy "authenticated users can write buyers"
on public.buyers for all
to authenticated
using (true)
with check (true);

create policy "authenticated users can read purchase locations"
on public.purchase_locations for select
to authenticated
using (true);

create policy "authenticated users can write purchase locations"
on public.purchase_locations for all
to authenticated
using (true)
with check (true);
