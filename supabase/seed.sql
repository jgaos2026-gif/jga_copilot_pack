insert into public.services (tier, base_price, description, revision_limits) values
('basic', 500.00, 'Entry package for simple digital design work', 1),
('growth', 1200.00, 'Growth package for broader brand and campaign needs', 2),
('elite', 3000.00, 'High-touch premium package for advanced brand systems', 3)
on conflict (tier) do nothing;

-- Clients
insert into public.clients (id, name, contact_email, contact_phone, state_tag) values
('aaaaaaaa-0001-0001-0001-000000000001', 'North Star Fitness', 'northstar@example.com', '555-0100', 'IL-01'),
('aaaaaaaa-0002-0002-0002-000000000002', 'Rio Verde Tacos', 'rioverde@example.com', '555-0101', 'TX-44'),
('aaaaaaaa-0003-0003-0003-000000000003', 'Apex Legal Media', 'apex@example.com', '555-0102', 'IL-01');

-- Projects (4 projects across multiple statuses)
insert into public.projects (id, client_id, service_tier, status, payment_stage, quote_price, final_price, state_tag) values
('bbbbbbbb-0001-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', 'basic',  'completed', 'final_paid',    500.00,  500.00, 'IL-01'),
('bbbbbbbb-0002-0002-0002-000000000002', 'aaaaaaaa-0002-0002-0002-000000000002', 'growth', 'active',    'deposit_paid', 1200.00, 1200.00, 'TX-44'),
('bbbbbbbb-0003-0003-0003-000000000003', 'aaaaaaaa-0003-0003-0003-000000000003', 'elite',  'intake',    'none',         3000.00,    null, 'IL-01'),
('bbbbbbbb-0004-0004-0004-000000000004', 'aaaaaaaa-0001-0001-0001-000000000001', 'growth', 'revision',  'deposit_paid', 1200.00, 1200.00, 'IL-01');

-- Contracts (2 contracts)
insert into public.contracts (id, project_id, template_name, status, signed_at) values
('cccccccc-0001-0001-0001-000000000001', 'bbbbbbbb-0001-0001-0001-000000000001', 'standard-service-agreement', 'signed', now() - interval '30 days'),
('cccccccc-0002-0002-0002-000000000002', 'bbbbbbbb-0002-0002-0002-000000000002', 'standard-service-agreement', 'signed', now() - interval '10 days');

-- Transactions (3 transactions)
insert into public.transactions (id, project_id, amount, payment_stage, processor, state_tag) values
('dddddddd-0001-0001-0001-000000000001', 'bbbbbbbb-0001-0001-0001-000000000001', 500.00,  'final_paid',    'stripe', 'IL-01'),
('dddddddd-0002-0002-0002-000000000002', 'bbbbbbbb-0002-0002-0002-000000000002', 600.00,  'deposit_paid',  'stripe', 'TX-44'),
('dddddddd-0003-0003-0003-000000000003', 'bbbbbbbb-0004-0004-0004-000000000004', 600.00,  'deposit_paid',  'stripe', 'IL-01');

-- Contractors (2 demo contractors)
-- profile_id is nullable in the schema; these are placeholder records for demo purposes.
-- Real contractors must be created via POST /api/auth/register + POST /api/contractors
-- which creates the auth user, profile, and contractor rows in sequence.
insert into public.contractors (id, profile_id, state_tag, identity_code, verification_status, payout_method_status, w9_status) values
('eeeeeeee-0001-0001-0001-000000000001', null, 'IL-01', 'JGA-IL-C001', 'approved', 'approved', 'approved'),
('eeeeeeee-0002-0002-0002-000000000002', null, 'TX-44', 'JGA-TX-C002', 'pending',  'pending',  'pending');

-- Ledger events (5 events)
insert into public.ledger_events (event_type, entity_type, entity_id, payload_json, state_tag) values
('project_created',   'project',     'bbbbbbbb-0001-0001-0001-000000000001', '{"tier":"basic","client":"North Star Fitness"}',        'IL-01'),
('deposit_received',  'transaction', 'dddddddd-0002-0002-0002-000000000002', '{"amount":600.00,"stage":"deposit_paid"}',              'TX-44'),
('contract_signed',   'contract',    'cccccccc-0002-0002-0002-000000000002', '{"template":"standard-service-agreement"}',             'TX-44'),
('final_payment',     'transaction', 'dddddddd-0001-0001-0001-000000000001', '{"amount":500.00,"stage":"final_paid"}',                'IL-01'),
('dispute_opened',    'project',     'bbbbbbbb-0004-0004-0004-000000000004', '{"reason":"scope_change","state_tag":"IL-01"}',         'IL-01');

-- Metrics / load
insert into public.metrics (weekly_inquiries, active_projects, load_ratio)
values (12, 4, 0.55)
on conflict do nothing;

insert into public.system_load (active_project_count, production_capacity_hours, inquiry_volume_7d)
values (4, 80, 12)
on conflict do nothing;
