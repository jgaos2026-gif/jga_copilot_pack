insert into public.services (tier, base_price, description, revision_limits) values
('basic', 500.00, 'Entry package for simple digital design work', 1),
('growth', 1200.00, 'Growth package for broader brand and campaign needs', 2),
('elite', 3000.00, 'High-touch premium package for advanced brand systems', 3)
on conflict (tier) do nothing;

insert into public.clients (id, name, contact_email, contact_phone, state_tag) values
(gen_random_uuid(), 'North Star Fitness', 'northstar@example.com', '555-0100', 'IL-01'),
(gen_random_uuid(), 'Rio Verde Tacos', 'rioverde@example.com', '555-0101', 'TX-44'),
(gen_random_uuid(), 'Apex Legal Media', 'apex@example.com', '555-0102', 'IL-01');

insert into public.metrics (weekly_inquiries, active_projects, load_ratio)
values (12, 4, 0.55);

insert into public.system_load (active_project_count, production_capacity_hours, inquiry_volume_7d)
values (4, 80, 12);
