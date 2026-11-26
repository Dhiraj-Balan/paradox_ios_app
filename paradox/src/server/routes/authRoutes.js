// ==============================================================================
// PARADOX — Authentication & Profile API Routes
// ==============================================================================

const { db, hashPassword, verifyPassword } = require('../db');
const { signToken } = require('../auth');
const { sendJson, sendError, parseJsonBody, requireAuth, logAudit } = require('../middleware');
const crypto = require('node:crypto');

async function handleRegister(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { email, password, fullName, role, phone, companyName, designation, country } = body;

    if (!email || !password || !fullName || !role) {
      return sendError(res, 400, 'Missing required registration fields: email, password, fullName, role');
    }

    if (!['investor', 'entrepreneur'].includes(role)) {
      return sendError(res, 400, 'Invalid role. Must be "investor" or "entrepreneur"');
    }

    // Password validation: minimum 8 characters
    if (password.length < 8) {
      return sendError(res, 400, 'Password must be at least 8 characters long');
    }

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendError(res, 400, 'Invalid email address format');
    }

    // Check if email already registered
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existingUser) {
      return sendError(res, 409, 'An account with this email address already exists');
    }

    const userId = 'usr_' + crypto.randomUUID();
    const profileId = 'prof_' + crypto.randomUUID();
    const hashedPassword = hashPassword(password);

    // Insert user
    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, role, phone, is_verified, kyc_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      email.toLowerCase().trim(),
      hashedPassword,
      fullName.trim(),
      role,
      phone || null,
      0,
      'unverified'
    );

    // Insert profile
    db.prepare(`
      INSERT INTO user_profiles (id, user_id, company_name, designation, country, sectors_of_interest)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      profileId,
      userId,
      companyName || null,
      designation || null,
      country || 'India',
      JSON.stringify(['Fintech', 'AI/ML'])
    );

    // Initial welcome notification
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'notif_' + crypto.randomUUID(),
      userId,
      'Welcome to PARADOX',
      `Welcome ${fullName}. Your ${role} account is now active. Please complete KYC verification to unlock full capital ecosystem capabilities.`,
      'system'
    );

    logAudit(userId, 'USER_REGISTER', 'users', userId, { role, email });

    const token = signToken({ id: userId, email: email.toLowerCase().trim(), role, fullName });

    const userRecord = db.prepare('SELECT id, email, full_name, role, phone, is_verified, kyc_status, created_at FROM users WHERE id = ?').get(userId);
    const profileRecord = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);

    sendJson(res, 201, {
      success: true,
      message: 'Account registered successfully',
      token,
      user: {
        ...userRecord,
        profile: profileRecord
      }
    });
  } catch (err) {
    sendError(res, 500, 'Registration failed: ' + err.message);
  }
}

async function handleLogin(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { email, password } = body;

    if (!email || !password) {
      return sendError(res, 400, 'Email and password are required');
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return sendError(res, 401, 'Invalid email or password credentials');
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return sendError(res, 401, 'Invalid email or password credentials');
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name
    });

    const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(user.id);

    logAudit(user.id, 'USER_LOGIN', 'users', user.id, { role: user.role });

    const { password_hash, ...safeUser } = user;

    sendJson(res, 200, {
      success: true,
      message: 'Authentication successful',
      token,
      user: {
        ...safeUser,
        profile
      }
    });
  } catch (err) {
    sendError(res, 500, 'Login failed: ' + err.message);
  }
}

async function handleGetMe(req, res) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(authUser.id);
    const unreadNotifs = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(authUser.id).count;
    const kyc = db.prepare('SELECT status, document_type, rejection_reason FROM kyc_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(authUser.id);

    sendJson(res, 200, {
      success: true,
      user: {
        ...authUser,
        profile,
        unreadNotificationsCount: unreadNotifs,
        kycSubmission: kyc || null
      }
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch user session: ' + err.message);
  }
}

async function handleUpdateProfile(req, res) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    const body = await parseJsonBody(req);
    const {
      fullName, phone, bio, companyName, designation, country,
      accreditedInvestor, netWorthRange, investmentThesis, sectorsOfInterest,
      preferredStages, minTicketSize, maxTicketSize, websiteUrl, linkedinUrl
    } = body;

    if (fullName) {
      db.prepare("UPDATE users SET full_name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?")
        .run(fullName, phone || null, authUser.id);
    }

    db.prepare(`
      UPDATE user_profiles SET
        bio = COALESCE(?, bio),
        company_name = COALESCE(?, company_name),
        designation = COALESCE(?, designation),
        country = COALESCE(?, country),
        accredited_investor = COALESCE(?, accredited_investor),
        net_worth_range = COALESCE(?, net_worth_range),
        investment_thesis = COALESCE(?, investment_thesis),
        sectors_of_interest = COALESCE(?, sectors_of_interest),
        preferred_stages = COALESCE(?, preferred_stages),
        min_ticket_size = COALESCE(?, min_ticket_size),
        max_ticket_size = COALESCE(?, max_ticket_size),
        website_url = COALESCE(?, website_url),
        linkedin_url = COALESCE(?, linkedin_url),
        updated_at = datetime('now')
      WHERE user_id = ?
    `).run(
      bio, companyName, designation, country,
      accreditedInvestor !== undefined ? (accreditedInvestor ? 1 : 0) : null,
      netWorthRange, investmentThesis,
      sectorsOfInterest ? JSON.stringify(sectorsOfInterest) : null,
      preferredStages ? JSON.stringify(preferredStages) : null,
      minTicketSize, maxTicketSize,
      websiteUrl, linkedinUrl,
      authUser.id
    );

    const updatedUser = db.prepare('SELECT id, email, full_name, role, phone, is_verified, kyc_status FROM users WHERE id = ?').get(authUser.id);
    const updatedProfile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(authUser.id);

    sendJson(res, 200, {
      success: true,
      message: 'Profile updated successfully',
      user: {
        ...updatedUser,
        profile: updatedProfile
      }
    });
  } catch (err) {
    sendError(res, 500, 'Profile update failed: ' + err.message);
  }
}

async function handleRecoverPassword(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { email } = body;
    if (!email) {
      return sendError(res, 400, 'Email address is required for password recovery');
    }

    const user = db.prepare('SELECT id, full_name FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (user) {
      // Simulate secure OTP delivery
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'notif_' + crypto.randomUUID(),
        user.id,
        'Security Verification Code',
        `Your PARADOX password reset authorization code is: ${otp}. Valid for 15 minutes.`,
        'system'
      );
    }

    // Always respond with success to prevent user enumeration attacks
    sendJson(res, 200, {
      success: true,
      message: 'If the provided email is registered, recovery instructions and an OTP have been dispatched.'
    });
  } catch (err) {
    sendError(res, 500, 'Password recovery failed: ' + err.message);
  }
}

async function handleDemoSwitch(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { targetRole } = body;

    let targetEmail = 'investor@paradox.com';
    if (targetRole === 'entrepreneur') targetEmail = 'entrepreneur@paradox.com';
    if (targetRole === 'admin') targetEmail = 'admin@paradox.com';

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(targetEmail);
    if (!user) {
      return sendError(res, 404, 'Demo user not found');
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name
    });

    const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(user.id);
    const { password_hash, ...safeUser } = user;

    sendJson(res, 200, {
      success: true,
      message: `Switched session to ${user.full_name} (${user.role})`,
      token,
      user: {
        ...safeUser,
        profile
      }
    });
  } catch (err) {
    sendError(res, 500, 'Demo switch failed: ' + err.message);
  }
}

module.exports = {
  handleRegister,
  handleLogin,
  handleGetMe,
  handleUpdateProfile,
  handleRecoverPassword,
  handleDemoSwitch
};
