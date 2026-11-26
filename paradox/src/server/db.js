// ==============================================================================
// PARADOX — Database Engine (Local Persistent SQLite / Supabase Compatible)
// Powered by Node.js 24 native node:sqlite DatabaseSync
// ==============================================================================

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const DB_PATH = process.env.DATABASE_FILE || path.join(__dirname, '..', '..', 'paradox.db');

// Ensure parent directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys for high concurrency & integrity
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

/**
 * Initializes the full schema matching the PostgreSQL Supabase architecture
 */
function initSchema() {
  db.exec(`
    -- 1. USERS
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('investor', 'entrepreneur', 'admin')),
      phone TEXT,
      avatar_url TEXT,
      is_verified INTEGER DEFAULT 0,
      kyc_status TEXT DEFAULT 'unverified' CHECK(kyc_status IN ('unverified', 'pending', 'verified', 'rejected')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 2. USER PROFILES
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bio TEXT,
      company_name TEXT,
      designation TEXT,
      country TEXT DEFAULT 'India',
      accredited_investor INTEGER DEFAULT 0,
      net_worth_range TEXT,
      investment_thesis TEXT,
      sectors_of_interest TEXT, -- JSON array of strings
      preferred_stages TEXT,    -- JSON array of strings
      min_ticket_size REAL DEFAULT 500000.0,
      max_ticket_size REAL DEFAULT 50000000.0,
      total_invested REAL DEFAULT 0.0,
      funding_raised REAL DEFAULT 0.0,
      website_url TEXT,
      linkedin_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 3. STARTUPS
    CREATE TABLE IF NOT EXISTS startups (
      id TEXT PRIMARY KEY,
      founder_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      description TEXT NOT NULL,
      sector TEXT NOT NULL,
      stage TEXT NOT NULL CHECK(stage IN ('Idea', 'Pre-Seed', 'Seed', 'Series A', 'Series B+')),
      headquarters TEXT NOT NULL,
      target_funding REAL NOT NULL,
      raised_funding REAL DEFAULT 0.0,
      proposed_equity REAL NOT NULL,
      pre_money_valuation REAL NOT NULL,
      mrr REAL DEFAULT 0.0,
      arr REAL DEFAULT 0.0,
      burn_rate REAL DEFAULT 0.0,
      runway_months INTEGER DEFAULT 12,
      pitch_deck_url TEXT,
      financial_model_url TEXT,
      video_pitch_url TEXT,
      demo_url TEXT,
      problem_statement TEXT NOT NULL,
      solution_statement TEXT NOT NULL,
      business_model TEXT NOT NULL,
      traction_highlights TEXT,
      team_summary TEXT,
      logo_url TEXT,
      cover_image_url TEXT,
      status TEXT DEFAULT 'pending_approval' CHECK(status IN ('draft', 'pending_approval', 'approved', 'rejected', 'funded')),
      admin_feedback TEXT,
      view_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 4. INVESTMENT INTERESTS
    CREATE TABLE IF NOT EXISTS investment_interests (
      id TEXT PRIMARY KEY,
      startup_id TEXT NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
      investor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      proposed_amount REAL NOT NULL,
      proposed_equity REAL,
      strategic_value TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'under_review', 'accepted', 'declined', 'term_sheet_issued', 'closed')),
      response_note TEXT,
      responded_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(startup_id, investor_id)
    );

    -- 5. SAVED STARTUPS (Watchlist)
    CREATE TABLE IF NOT EXISTS saved_startups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      startup_id TEXT NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, startup_id)
    );

    -- 6. KYC VERIFICATIONS
    CREATE TABLE IF NOT EXISTS kyc_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_legal_name TEXT NOT NULL,
      document_type TEXT NOT NULL,
      document_number TEXT NOT NULL,
      country_of_issuance TEXT NOT NULL,
      document_file_url TEXT NOT NULL,
      address_proof_url TEXT,
      accredited_declaration INTEGER DEFAULT 1,
      annual_income_range TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      rejection_reason TEXT,
      reviewed_by TEXT REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 7. CONVERSATIONS & MESSAGES
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      participant1_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      participant2_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      startup_id TEXT REFERENCES startups(id) ON DELETE SET NULL,
      last_message_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(participant1_id, participant2_id, startup_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      attachment_url TEXT,
      is_read INTEGER DEFAULT 0,
      read_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 8. NOTIFICATIONS
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('system', 'interest', 'kyc', 'startup', 'message', 'deal')),
      reference_id TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 9. AUDIT LOGS
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      metadata TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- INDEXES
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_startups_status ON startups(status);
    CREATE INDEX IF NOT EXISTS idx_startups_sector ON startups(sector);
    CREATE INDEX IF NOT EXISTS idx_startups_founder ON startups(founder_id);
    CREATE INDEX IF NOT EXISTS idx_interests_investor ON investment_interests(investor_id);
    CREATE INDEX IF NOT EXISTS idx_interests_startup ON investment_interests(startup_id);
    CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_startups(user_id);
    CREATE INDEX IF NOT EXISTS idx_kyc_user ON kyc_verifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);
}

/**
 * Hash password with PBKDF2 salt
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify password against salt:hash
 */
function verifyPassword(password, storedPasswordHash) {
  if (!storedPasswordHash || !storedPasswordHash.includes(':')) return false;
  const [salt, originalHash] = storedPasswordHash.split(':');
  const testHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(testHash), Buffer.from(originalHash));
}

/**
 * Seed foundational accounts and realistic mock data
 */
function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return;

  const defaultPassword = 'Password#123';
  const hashedPassword = hashPassword(defaultPassword);

  const investorId = 'usr_investor_01';
  const entrepreneurId = 'usr_founder_01';
  const adminId = 'usr_admin_01';

  // 1. Insert Users
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role, phone, is_verified, kyc_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(investorId, 'investor@paradox.com', hashedPassword, 'Vikramaditya Singhania', 'investor', '+91 98200 12345', 1, 'verified');
  insertUser.run(entrepreneurId, 'entrepreneur@paradox.com', hashedPassword, 'Dr. Aarav Patel', 'entrepreneur', '+91 98330 67890', 1, 'verified');
  insertUser.run(adminId, 'admin@paradox.com', hashedPassword, 'Evelyn Cross', 'admin', '+91 98110 54321', 1, 'verified');

  // 2. Insert Profiles
  const insertProfile = db.prepare(`
    INSERT INTO user_profiles (id, user_id, bio, company_name, designation, country, accredited_investor, net_worth_range, investment_thesis, sectors_of_interest, preferred_stages, min_ticket_size, max_ticket_size, total_invested, funding_raised)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Investor Profile with prompt-specified figures (₹12.8 Cr total invested)
  insertProfile.run(
    'prof_inv_01',
    investorId,
    'Managing Partner at Apex Capital. Focused on deep tech, enterprise fintech, and quantum-safe architectures across India and Southeast Asia.',
    'Apex Capital Partners',
    'Managing Partner',
    'India',
    1,
    '₹50 Cr - ₹100 Cr',
    'Backing category-defining B2B fintech, autonomous AI systems, and clean mobility infrastructures with clear unit economics.',
    JSON.stringify(['Fintech', 'AI/ML', 'Clean Energy', 'Healthtech']),
    JSON.stringify(['Seed', 'Series A']),
    1000000.0,
    50000000.0,
    128000000.0, // ₹12.8 Cr Total Invested
    0.0
  );

  // Entrepreneur Profile with prompt-specified figures (₹3.8 Cr funding raised)
  insertProfile.run(
    'prof_ent_01',
    entrepreneurId,
    'Founder & CEO at NeuralPay & QuantumLedger. Serial tech founder with 12+ years in cryptographic payment systems and enterprise distributed compute.',
    'NeuralPay Technologies',
    'Founder & CEO',
    'India',
    0,
    null,
    null,
    JSON.stringify(['Fintech', 'AI/ML', 'Enterprise SaaS']),
    null,
    500000.0,
    50000000.0,
    0.0,
    38000000.0 // ₹3.8 Cr Funding Raised
  );

  // Admin Profile
  insertProfile.run(
    'prof_adm_01',
    adminId,
    'Chief Compliance & Platform Governance Officer at PARADOX Global Investment Platform.',
    'PARADOX Operations Desk',
    'Chief Platform Officer',
    'United States',
    1,
    'Institutional',
    'Platform Security, Global Anti-Money Laundering & Accredited Investor Compliance.',
    JSON.stringify(['All']),
    null,
    0.0,
    0.0,
    0.0,
    0.0
  );

  // 3. Insert Startups
  const insertStartup = db.prepare(`
    INSERT INTO startups (
      id, founder_id, name, tagline, description, sector, stage, headquarters,
      target_funding, raised_funding, proposed_equity, pre_money_valuation,
      mrr, arr, burn_rate, runway_months, pitch_deck_url, problem_statement,
      solution_statement, business_model, traction_highlights, team_summary,
      status, view_count
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
  `);

  // Startup 1: NeuralPay (Fintech Series A)
  insertStartup.run(
    'stp_neuralpay',
    entrepreneurId,
    'NeuralPay',
    'Autonomous AI-powered Cross-Border Settlement Engine',
    'NeuralPay eliminates traditional correspondent banking latency and 3.5% foreign exchange markups using proprietary quantum-resistant distributed liquidity pools, delivering sub-second settlement for global enterprises.',
    'Fintech',
    'Series A',
    'Bengaluru, India',
    50000000.0, // ₹5.0 Cr Target
    32000000.0, // ₹3.2 Cr Raised
    10.0,       // 10% Equity
    450000000.0, // ₹45.0 Cr Valuation
    4200000.0,  // ₹42L MRR
    50400000.0, // ₹5.04 Cr ARR
    1800000.0,  // ₹18L monthly burn
    24,
    'https://documents.paradox.finance/pitch-decks/neuralpay-series-a.pdf',
    'Enterprise international money movement requires 2 to 4 business days, incurring multi-hop correspondent fees and currency conversion losses exceeding $150B annually.',
    'A sub-second atomic settlement engine combining state-channel liquidity routing with cryptographic multi-currency vault guarantees.',
    '0.15% transaction fee on gross volume + enterprise API tier starting at ₹3,50,000 / month.',
    'Processing ₹180 Cr annualized volume across 14 enterprise treasury customers with 28% MoM growth.',
    'Founders from Stripe, Goldman Sachs, and IIT Madras. 18 full-time software and quantitative finance engineers.',
    'approved',
    1840
  );

  // Startup 2: AeroCarbon (Clean Energy Seed)
  insertStartup.run(
    'stp_aerocarbon',
    entrepreneurId,
    'AeroCarbon Systems',
    'Next-Gen Graphene Composite Solid-State Energy Cells for Aviation',
    'AeroCarbon produces structural energy storage panels for commercial eVTOL and electric commercial aircraft, unlocking 2.4x standard energy density without battery weight penalties.',
    'Clean Energy',
    'Seed',
    'Hyderabad, India',
    30000000.0, // ₹3.0 Cr Target
    18000000.0, // ₹1.8 Cr Raised
    12.5,       // 12.5% Equity
    210000000.0,
    1400000.0,
    16800000.0,
    950000.0,
    18,
    'https://documents.paradox.finance/pitch-decks/aerocarbon-seed.pdf',
    'Lithium-ion batteries are too heavy and heat-sensitive for commercial regional air mobility, creating a severe bottleneck for zero-emission aviation.',
    'Carbon-nanotube reinforced structural cells with 620 Wh/kg energy density and zero thermal runaway risk.',
    'High-margin Tier-1 manufacturing contracts with OEM aerospace integrators + license royalties.',
    'Signed MOUs with 2 regional air transport defense contractors; prototype certified by DGCA laboratory.',
    'Ex-ISRO propulsion engineers and materials science PhDs from IISc Bangalore.',
    'approved',
    1290
  );

  // Startup 3: BioSynthetica (Healthtech Pre-Seed)
  insertStartup.run(
    'stp_biosynthetica',
    entrepreneurId,
    'BioSynthetica AI',
    'Generative Molecular Target Discovery for Rare Oncology',
    'BioSynthetica trains foundation biological models on 120M+ single-cell sequencing graphs to discover high-affinity oncology targets in days rather than years.',
    'Healthtech',
    'Pre-Seed',
    'Mumbai, India',
    15000000.0, // ₹1.5 Cr Target
    6000000.0,  // ₹60L Raised
    15.0,
    85000000.0,
    380000.0,
    4560000.0,
    450000.0,
    16,
    'https://documents.paradox.finance/pitch-decks/biosynthetica-deck.pdf',
    'Pre-clinical target discovery takes 4.5 years and fails 90% of the time, costing pharmaceutical giants billions.',
    'Transformer-based bio-algorithmic pipeline that predicts candidate compound binding affinities with 89% in-vitro accuracy.',
    'SaaS licensing to biopharma research labs + milestone milestone co-development royalties on lead candidates.',
    'Completed successful bench validation on 3 EGFR-resistant kinase pathways in partnership with Tata Memorial Centre.',
    'Stanford Bio-X Postdocs and AI researchers with 14 combined Nature/Cell publications.',
    'approved',
    960
  );

  // Startup 4: QuantumShield (Cybersecurity Series A)
  insertStartup.run(
    'stp_quantumshield',
    entrepreneurId,
    'QuantumShield Networks',
    'Post-Quantum Cryptographic Gateway for Sovereign Banking Networks',
    'Hardware and software security micro-appliances providing drop-in NIST-standardized lattice cryptography for legacy banking mainframes.',
    'Cybersecurity',
    'Series A',
    'Delhi NCR, India',
    40000000.0,
    25000000.0,
    8.0,
    460000000.0,
    3200000.0,
    38400000.0,
    1400000.0,
    22,
    'https://documents.paradox.finance/pitch-decks/quantumshield.pdf',
    'Within 3 to 5 years, quantum computers will break RSA-2048 encryption, exposing all financial transactions and national security communications.',
    'Zero-latency TLS proxy appliance that automatically upgrades cryptographic handshakes to Kyber-1024 and Dilithium.',
    'Enterprise software license per core + mission-critical 24/7 sovereign SOC support tier.',
    'Deployed at 4 Tier-1 scheduled commercial banks safeguarding ₹2,400 Cr in daily interbank wire transmissions.',
    'Former CERT-In cybersecurity directors and cryptography faculty from IIT Delhi.',
    'approved',
    1150
  );

  // Startup 5: Agrilink (Agritech Seed - Pending Admin Approval)
  insertStartup.run(
    'stp_agrilink',
    entrepreneurId,
    'Agrilink Precision',
    'Hyper-Spectral Satellite Irrigation and Yield Optimization for Agribusiness',
    'Agrilink delivers millimeter-precision soil moisture and nitrogen distribution maps from synthetic aperture radar satellites directly to farm equipment.',
    'Agritech',
    'Seed',
    'Pune, India',
    20000000.0,
    0.0,
    14.0,
    120000000.0,
    650000.0,
    7800000.0,
    600000.0,
    15,
    'https://documents.paradox.finance/pitch-decks/agrilink-seed.pdf',
    'Water scarcity and improper fertilizer distribution reduce agricultural yield by 38% across the Indian subcontinent.',
    'Sub-meter satellite AI analytics triggering autonomous drip irrigation valves in real time.',
    'Per-acre SaaS subscription for corporate agricultural conglomerates and state farming federations.',
    'Covering 45,000 acres in Maharashtra and Punjab with documented 31% water savings.',
    'IIT Bombay agronomists and ex-ISRO remote sensing scientists.',
    'pending_approval',
    340
  );

  // 4. Saved Startups (Watchlist for demo investor)
  const insertSaved = db.prepare(`
    INSERT INTO saved_startups (id, user_id, startup_id, notes)
    VALUES (?, ?, ?, ?)
  `);
  insertSaved.run('sav_01', investorId, 'stp_neuralpay', 'High conviction fintech infrastructure. Met founders at Bangalore Summit.');
  insertSaved.run('sav_02', investorId, 'stp_aerocarbon', 'Review technical patent diligence with our aerospace advisor.');
  insertSaved.run('sav_03', investorId, 'stp_quantumshield', 'Critical banking moat. Synergistic with our portco cybersecurity fund.');

  // 5. Investment Interests (Deal pipeline)
  const insertInterest = db.prepare(`
    INSERT INTO investment_interests (
      id, startup_id, investor_id, proposed_amount, proposed_equity, strategic_value, message, status, response_note, responded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertInterest.run(
    'int_01',
    'stp_neuralpay',
    investorId,
    15000000.0, // ₹1.5 Cr proposed check
    3.0,
    'Access to our sovereign bank network in Singapore, Tokyo, and Mumbai, plus regulatory sandbox mentorship.',
    'We have thoroughly reviewed your traction and architecture. Apex Capital would like to lead this Series A round with an initial ticket of ₹1.5 Cr and board representation.',
    'accepted',
    'Thank you Vikramaditya. We are excited about Apex Capitals strategic relationships. Sending initial data room access.',
    new Date().toISOString()
  );

  insertInterest.run(
    'int_02',
    'stp_aerocarbon',
    investorId,
    10000000.0, // ₹1.0 Cr proposed check
    4.5,
    'Connections with commercial aerospace OEM procurement teams in France and Germany.',
    'AeroCarbon presents an extraordinary breakthrough in high-density storage. We would like to initiate technical due diligence.',
    'under_review',
    null,
    null
  );

  // 6. KYC Verifications
  const insertKYC = db.prepare(`
    INSERT INTO kyc_verifications (
      id, user_id, full_legal_name, document_type, document_number, country_of_issuance,
      document_file_url, accredited_declaration, annual_income_range, status, reviewed_by, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertKYC.run(
    'kyc_inv_01',
    investorId,
    'Vikramaditya Singhania',
    'passport',
    'Z5982143',
    'India',
    'https://storage.paradox.finance/kyc/vikramaditya-passport.pdf',
    1,
    '₹5 Cr+',
    'approved',
    adminId,
    new Date().toISOString()
  );

  insertKYC.run(
    'kyc_ent_01',
    entrepreneurId,
    'Dr. Aarav Patel',
    'incorporation_cert',
    'U72900KA2024PTC189210',
    'India',
    'https://storage.paradox.finance/kyc/neuralpay-coi.pdf',
    1,
    '₹1 Cr - ₹5 Cr',
    'approved',
    adminId,
    new Date().toISOString()
  );

  // 7. Conversations & Messages
  const insertConv = db.prepare(`
    INSERT INTO conversations (id, participant1_id, participant2_id, startup_id, last_message_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);
  insertConv.run('conv_01', investorId, entrepreneurId, 'stp_neuralpay');

  const insertMsg = db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, recipient_id, content, is_read, read_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertMsg.run(
    'msg_01',
    'conv_01',
    investorId,
    entrepreneurId,
    'Hi Dr. Patel, we were thoroughly impressed by your sub-second atomic settlement demo. What is your current runway with the existing ₹3.2 Cr commitments?',
    1,
    new Date().toISOString()
  );

  insertMsg.run(
    'msg_02',
    'conv_01',
    entrepreneurId,
    investorId,
    'Hello Vikramaditya, thank you for reaching out. With our current monthly burn of ₹18L and incoming enterprise contract collections, our runway extends comfortably to 24 months. We are closing the remaining ₹1.8 Cr of this round within the next 45 days.',
    1,
    new Date().toISOString()
  );

  insertMsg.run(
    'msg_03',
    'conv_01',
    investorId,
    entrepreneurId,
    'Excellent. Our investment committee has approved the preliminary term sheet for ₹1.5 Cr. Let us schedule a partner sync for Thursday at 3 PM IST.',
    0,
    null
  );

  // 8. Notifications
  const insertNotification = db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, reference_id, is_read)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertNotification.run('notif_01', investorId, 'Investment Term Sheet Accepted', 'NeuralPay has formally accepted your expression of interest. Data room access is now unlocked.', 'interest', 'int_01', 0);
  insertNotification.run('notif_02', investorId, 'KYC Verification Approved', 'Your accredited investor verification has been certified by the PARADOX Global Compliance Team.', 'kyc', 'kyc_inv_01', 1);
  insertNotification.run('notif_03', entrepreneurId, 'New ₹1.5 Cr Expression of Interest', 'Apex Capital Partners has submitted a formal indication of interest for NeuralPay.', 'interest', 'int_01', 0);
  insertNotification.run('notif_04', entrepreneurId, 'Startup Listing Approved', 'Your proposal for NeuralPay has passed compliance review and is now live in the discovery catalogue.', 'startup', 'stp_neuralpay', 1);
  insertNotification.run('notif_05', adminId, 'New Startup Submission Pending', 'Agrilink Precision has submitted a proposal for Series A funding requiring administrative review.', 'startup', 'stp_agrilink', 0);

  // 9. Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, metadata, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertAudit.run('aud_01', adminId, 'KYC_APPROVE', 'kyc_verifications', 'kyc_inv_01', JSON.stringify({ verified_role: 'investor', accredited: true }), '127.0.0.1');
  insertAudit.run('aud_02', adminId, 'STARTUP_APPROVE', 'startups', 'stp_neuralpay', JSON.stringify({ sector: 'Fintech', target: 50000000 }), '127.0.0.1');
}

// Auto-initialize schema and seeds upon module load
initSchema();
seedInitialData();

module.exports = {
  db,
  initSchema,
  seedInitialData,
  hashPassword,
  verifyPassword
};
