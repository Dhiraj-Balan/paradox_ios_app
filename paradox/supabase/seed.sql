-- ==============================================================================
-- PARADOX — Where Vision Meets Capital
-- Supabase / PostgreSQL Seed Data for Testing & Demonstration
-- ==============================================================================

-- Password for all demo accounts is: Paradox#2026
-- PBKDF2 Hash: 6735e5d3663673e13d9876f2... (or standard test hash)

INSERT INTO public.users (id, email, password_hash, full_name, role, phone, is_verified, kyc_status)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'investor@paradox.com', 'a3014cbfcaec58f4a132470c1e8d47eb:40f80a424e6c9fa12e582d9ea1d07c089201bd9b0ce208eb6068d3744923e3cb', 'Vikramaditya Singhania', 'investor', '+91 98200 12345', true, 'verified'),
  ('22222222-2222-2222-2222-222222222222', 'entrepreneur@paradox.com', 'a3014cbfcaec58f4a132470c1e8d47eb:40f80a424e6c9fa12e582d9ea1d07c089201bd9b0ce208eb6068d3744923e3cb', 'Dr. Aarav Patel', 'entrepreneur', '+91 98330 67890', true, 'verified'),
  ('33333333-3333-3333-3333-333333333333', 'admin@paradox.com', 'a3014cbfcaec58f4a132470c1e8d47eb:40f80a424e6c9fa12e582d9ea1d07c089201bd9b0ce208eb6068d3744923e3cb', 'Evelyn Cross', 'admin', '+91 98110 54321', true, 'verified')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.user_profiles (user_id, bio, company_name, designation, country, accredited_investor, net_worth_range, investment_thesis, sectors_of_interest, total_invested, funding_raised)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Managing Partner at Apex Capital. Focused on deep tech, quantum algorithms, and next-gen fintech infrastructure across India and Southeast Asia.', 'Apex Capital Partners', 'Managing Partner', 'India', true, '₹50 Cr - ₹100 Cr', 'Backing category-defining B2B fintech and AI infrastructures with strong gross margins and defensible moats.', ARRAY['Fintech', 'AI/ML', 'Clean Energy', 'Healthtech'], 128000000.00, 0.00),
  ('22222222-2222-2222-2222-222222222222', 'Founder & CEO of NeuralPay & QuantumLedger. Serial entrepreneur with 2 successful exits in cryptographic payments and distributed compute.', 'NeuralPay Technologies', 'Founder & CEO', 'India', false, NULL, NULL, ARRAY['Fintech', 'AI/ML'], 0.00, 38000000.00),
  ('33333333-3333-3333-3333-333333333333', 'Chief Compliance & Platform Officer at PARADOX Global Ecosystem.', 'PARADOX Operations', 'Chief Platform Officer', 'United States', true, 'Institutional', 'Platform Governance & Worldwide Compliance.', ARRAY['All'], 0.00, 0.00)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.startups (id, founder_id, name, tagline, description, sector, stage, headquarters, target_funding, raised_funding, proposed_equity, pre_money_valuation, mrr, arr, burn_rate, runway_months, problem_statement, solution_statement, business_model, status, view_count)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'NeuralPay', 'Autonomous AI-powered Cross-Border Settlement Engine', 'NeuralPay eliminates T+2 settlement friction and 3.5% foreign exchange markups using proprietary quantum-resistant ledger architecture, delivering instant liquidity for cross-border enterprise treasuries.', 'Fintech', 'Series A', 'Bengaluru, India', 50000000.00, 32000000.00, 10.00, 450000000.00, 4200000.00, 50400000.00, 1800000.00, 24, 'Cross-border enterprise money movement takes 2-4 business days and incurs high hidden fees in currency conversion and correspondent banking delays.', 'Real-time atomic settlement network with sub-second finality and guaranteed zero FX slippage for institutional treasury flows.', '0.15% fee on gross transaction volume + enterprise SaaS SLA tier at ₹4,00,000/month.', 'approved', 1420),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'AeroCarbon', 'High-Density Graphene Storage for Clean Aviation', 'AeroCarbon produces ultra-lightweight structural solid-state batteries that double electric aircraft flight range without adding weight penalty.', 'Clean Energy', 'Seed', 'Hyderabad, India', 30000000.00, 18000000.00, 12.50, 210000000.00, 1500000.00, 18000000.00, 950000.00, 18, 'Existing lithium-ion battery chemistry is too heavy for commercial passenger electric aviation, stalling commercialization.', 'Patented graphene-infused structural composite cells providing 620 Wh/kg specific energy density.', 'Tier-1 OEM supply contracts with drone and regional air mobility manufacturers.', 'approved', 980),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'BioSynthetica', 'Generative Molecular Target Discovery for Rare Oncology', 'Proprietary foundational bio-intelligence model trained on 100M+ genomic assays predicting drug efficacy in seconds.', 'Healthtech', 'Pre-Seed', 'Mumbai, India', 15000000.00, 6000000.00, 15.00, 85000000.00, 400000.00, 4800000.00, 500000.00, 14, 'Target validation in preclinical drug discovery averages 4.5 years with a 92% attrition rate.', 'In-silico molecular simulation that identifies validated cancer targets with 84% laboratory concordance.', 'Annual platform licensing + milestone-based co-development royalties with pharma giants.', 'approved', 760)
ON CONFLICT (id) DO NOTHING;
