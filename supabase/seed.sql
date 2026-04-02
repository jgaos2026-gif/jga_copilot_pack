-- ============================================================
-- Services (3 required)
-- ============================================================
insert into public.services (tier, base_price, description, revision_limits) values
('basic',  500.00,  'Entry package for simple digital design work',              1),
('growth', 1200.00, 'Growth package for broader brand and campaign needs',       2),
('elite',  3000.00, 'High-touch premium package for advanced brand systems',     3)
on conflict (tier) do nothing;

-- ============================================================
-- Clients (3 required)
-- ============================================================
insert into public.clients (id, name, contact_email, contact_phone, state_tag) values
('a1000000-0000-0000-0000-000000000001', 'North Star Fitness', 'northstar@example.com', '555-0100', 'IL-01'),
('a1000000-0000-0000-0000-000000000002', 'Rio Verde Tacos',    'rioverde@example.com',  '555-0101', 'TX-44'),
('a1000000-0000-0000-0000-000000000003', 'Apex Legal Media',   'apex@example.com',      '555-0102', 'IL-01')
on conflict (id) do nothing;

-- ============================================================
-- Projects (4 across multiple statuses)
-- ============================================================
insert into public.projects (id, client_id, service_tier, status, payment_stage, quote_price, final_price, state_tag) values
('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'elite',  'active',    'deposit_paid', 3000.00, 3000.00, 'IL-01'),
('b2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'growth', 'intake',    'none',         1200.00, null,     'TX-44'),
('b2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'basic',  'completed', 'final_paid',   500.00,  500.00,   'IL-01'),
('b2000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'growth', 'revision',  'deposit_paid', 1200.00, 1200.00,  'IL-01')
on conflict (id) do nothing;

-- ============================================================
-- Contracts (2 required)
-- ============================================================
insert into public.contracts (id, project_id, template_name, status, signed_at) values
('c3000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'standard-service-agreement-v2', 'signed', now() - interval '10 days'),
('c3000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000003', 'standard-service-agreement-v2', 'signed', now() - interval '30 days')
on conflict (id) do nothing;

-- ============================================================
-- Transactions (3 required)
-- ============================================================
insert into public.transactions (id, project_id, amount, payment_stage, processor, state_tag) values
('d4000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 1500.00, 'deposit_paid', 'stripe', 'IL-01'),
('d4000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000003',  250.00, 'deposit_paid', 'stripe', 'IL-01'),
('d4000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003',  250.00, 'final_paid',   'stripe', 'IL-01')
on conflict (id) do nothing;

-- ============================================================
-- Contractors (2 required)
-- ============================================================
insert into public.contractors (id, state_tag, identity_code, verification_status, payout_method_status, w9_status, agreements_signed_at) values
('e5000000-0000-0000-0000-000000000001', 'IL-01', 'CTR-IL-0001', 'verified', 'verified', 'on_file', now() - interval '60 days'),
('e5000000-0000-0000-0000-000000000002', 'TX-44', 'CTR-TX-0002', 'verified', 'pending',  'on_file', now() - interval '45 days')
on conflict (id) do nothing;

-- ============================================================
-- Ledger events (5 required, append-only)
-- ============================================================
insert into public.ledger_events (event_type, entity_type, entity_id, payload_json, state_tag) values
('project_created',     'project',     'b2000000-0000-0000-0000-000000000001', '{"service_tier":"elite","quote_price":3000}', 'IL-01'),
('deposit_confirmed',   'transaction', 'd4000000-0000-0000-0000-000000000001', '{"amount":1500,"stage":"deposit_paid"}',       'IL-01'),
('contract_signed',     'contract',    'c3000000-0000-0000-0000-000000000001', '{"template":"standard-service-agreement-v2"}', 'IL-01'),
('project_completed',   'project',     'b2000000-0000-0000-0000-000000000003', '{"final_price":500}',                          'IL-01'),
('dispute_flag_raised', 'commission',  null,                                   '{"reason":"scope_creep","state_tag":"TX-44"}', 'TX-44');

-- ============================================================
-- System metrics
-- ============================================================
insert into public.metrics (weekly_inquiries, active_projects, load_ratio)
values (12, 4, 0.55);

insert into public.system_load (active_project_count, production_capacity_hours, inquiry_volume_7d)
values (4, 80, 12);
