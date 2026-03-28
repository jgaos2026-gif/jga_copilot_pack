-- JGA Enterprise OS schema
create extension if not exists "pgcrypto";

create type public.app_role as enum ('owner','admin','staff','contractor','client');
create type public.project_status as enum ('intake','deposit_pending','active','revision','completed','archived');
create type public.payment_stage as enum ('none','deposit_sent','deposit_paid','final_sent','final_paid','refunded','chargeback');
create type public.contract_status as enum ('draft','sent','signed','void');
create type public.dispute_status as enum ('none','open','resolved');
create type public.call_outcome as enum ('no_answer','callback','interested','closed_watch_email','not_interested');
create type public.escrow_status as enum ('pending','paused','eligible','released','clawback');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'client',
  full_name text,
  email text,
  state_tag text,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tier text not null unique,
  base_price numeric(12,2) not null,
  description text not null,
  revision_limits integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.profiles(id),
  name text not null,
  contact_email text,
  contact_phone text,
  state_tag text not null default 'IL-01',
  created_at timestamptz not null default now()
);

create table public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  service_tier text not null,
  project_summary text not null,
  urgency text not null default 'standard',
  restrictions text,
  acknowledgements jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  intake_submission_id uuid references public.intake_submissions(id),
  assigned_contractor_id uuid,
  service_tier text not null,
  status project_status not null default 'intake',
  payment_stage payment_stage not null default 'none',
  quote_price numeric(12,2),
  final_price numeric(12,2),
  qc_passed boolean not null default false,
  delivery_ready boolean not null default false,
  delivered_at timestamptz,
  state_tag text not null default 'IL-01',
  created_at timestamptz not null default now()
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  template_name text not null,
  status contract_status not null default 'draft',
  signed_at timestamptz,
  storage_path text,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  payment_stage payment_stage not null,
  processor text default 'stripe',
  processor_reference text,
  tax_reserve_pct numeric(5,2) default 0,
  allocation_breakdown jsonb not null default '{}'::jsonb,
  state_tag text not null default 'IL-01',
  created_at timestamptz not null default now()
);

create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  weekly_inquiries integer not null default 0,
  active_projects integer not null default 0,
  load_ratio numeric(8,4) not null default 0,
  created_at timestamptz not null default now()
);

create table public.system_load (
  id uuid primary key default gen_random_uuid(),
  active_project_count integer not null default 0,
  production_capacity_hours integer not null default 80,
  inquiry_volume_7d integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.contractors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id),
  state_tag text not null,
  identity_code text not null unique,
  verification_status text not null default 'pending',
  payout_method_status text not null default 'pending',
  w9_status text not null default 'pending',
  agreements_signed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id),
  project_id uuid references public.projects(id),
  lead_company text,
  lead_contact text,
  lead_phone text,
  outcome call_outcome not null,
  notes text,
  callback_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id),
  project_id uuid not null references public.projects(id),
  amount numeric(12,2) not null,
  escrow_status escrow_status not null default 'pending',
  hold_until timestamptz,
  released_at timestamptz,
  clawback_flag boolean not null default false,
  dispute_status dispute_status not null default 'none',
  created_at timestamptz not null default now()
);

create table public.ledger_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  payload_json jsonb not null default '{}'::jsonb,
  state_tag text,
  created_at timestamptz not null default now()
);

create table public.stability_daily_checklists (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id),
  checklist_date date not null default current_date,
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.stability_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id),
  week_of date not null,
  notes text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- simple helper function stubs
create or replace function public.can_start_production(p_project_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.projects p
    join public.contracts c on c.project_id = p.id
    where p.id = p_project_id
      and p.payment_stage in ('deposit_paid','final_sent','final_paid')
      and c.status = 'signed'
  );
$$;

create or replace function public.can_mark_delivered(p_project_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.payment_stage = 'final_paid'
      and p.qc_passed = true
  );
$$;

-- RLS (starter posture - refine in app)
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.contracts enable row level security;
alter table public.transactions enable row level security;
alter table public.contractors enable row level security;
alter table public.call_logs enable row level security;
alter table public.commissions enable row level security;
alter table public.ledger_events enable row level security;

-- permissive starter policies for development only
create policy "profiles self read" on public.profiles
for select using (auth.uid() = id);

create policy "owner admin can read clients" on public.clients
for select using (true);

create policy "owner admin can read projects" on public.projects
for select using (true);

create policy "owner admin can read contracts" on public.contracts
for select using (true);

create policy "owner admin can read transactions" on public.transactions
for select using (true);

create policy "contractor can read own call logs" on public.call_logs
for select using (
  contractor_id in (
    select id from public.contractors where profile_id = auth.uid()
  )
);

create policy "contractor can insert own call logs" on public.call_logs
for insert with check (
  contractor_id in (
    select id from public.contractors where profile_id = auth.uid()
  )
);
