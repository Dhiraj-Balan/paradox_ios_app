// ==============================================================================
// PARADOX — Administrator Control Desk API Routes
// ==============================================================================

const { db } = require('../db');
const { sendJson, sendError, parseJsonBody, requireRole, logAudit } = require('../middleware');
const crypto = require('node:crypto');

async function handleGetAdminStats(req, res) {
  try {
    const adminUser = requireRole(['admin'])(req, res);
    if (!adminUser) return;

    const investorCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'investor'").get().c;
    const entrepreneurCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'entrepreneur'").get().c;
    const totalStartups = db.prepare("SELECT COUNT(*) as c FROM startups").get().c;
    const approvedStartups = db.prepare("SELECT COUNT(*) as c FROM startups WHERE status = 'approved'").get().c;
    const pendingStartups = db.prepare("SELECT COUNT(*) as c FROM startups WHERE status = 'pending_approval'").get().c;
    const pendingKYC = db.prepare("SELECT COUNT(*) as c FROM kyc_verifications WHERE status = 'pending'").get().c;

    const capitalStats = db.prepare(`
      SELECT 
        SUM(target_funding) as total_sought,
        SUM(raised_funding) as total_raised
      FROM startups
    `).get();

    const interestStats = db.prepare(`
      SELECT 
        COUNT(*) as total_interests,
        SUM(proposed_amount) as total_indicated_capital
      FROM investment_interests
    `).get();

    const recentAudits = db.prepare(`
      SELECT a.*, u.full_name as actor_name, u.email as actor_email
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `).all();

    sendJson(res, 200, {
      success: true,
      stats: {
        investorCount,
        entrepreneurCount,
        totalUsers: investorCount + entrepreneurCount + 1,
        totalStartups,
        approvedStartups,
        pendingStartups,
        pendingKYC,
        totalSoughtFunding: capitalStats.total_sought || 0,
        totalRaisedFunding: capitalStats.total_raised || 0,
        totalInterests: interestStats.total_interests || 0,
        totalIndicatedCapital: interestStats.total_indicated_capital || 0
      },
      recentAudits
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch administrator statistics: ' + err.message);
  }
}

async function handleGetAdminUsers(req, res, urlObj) {
  try {
    const adminUser = requireRole(['admin'])(req, res);
    if (!adminUser) return;

    const query = urlObj.searchParams;
    const role = query.get('role');
    const kyc = query.get('kyc');
    const search = query.get('q');

    let sql = `
      SELECT 
        u.id, u.email, u.full_name, u.role, u.phone, u.is_verified, u.kyc_status, u.created_at,
        up.company_name, up.designation, up.country, up.accredited_investor, up.total_invested, up.funding_raised
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE 1=1
    `;
    const params = [];

    if (role && role !== 'all') {
      sql += ' AND u.role = ?';
      params.push(role);
    }
    if (kyc && kyc !== 'all') {
      sql += ' AND u.kyc_status = ?';
      params.push(kyc);
    }
    if (search) {
      sql += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR up.company_name LIKE ?)';
      const p = `%${search}%`;
      params.push(p, p, p);
    }

    sql += ' ORDER BY u.created_at DESC';

    const users = db.prepare(sql).all(...params);

    sendJson(res, 200, {
      success: true,
      count: users.length,
      users
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch users: ' + err.message);
  }
}

async function handleReviewStartupByAdmin(req, res, startupId) {
  try {
    const adminUser = requireRole(['admin'])(req, res);
    if (!adminUser) return;

    const startup = db.prepare('SELECT * FROM startups WHERE id = ?').get(startupId);
    if (!startup) {
      return sendError(res, 404, 'Startup proposal not found');
    }

    const body = await parseJsonBody(req);
    const { status, adminFeedback } = body;

    if (!['approved', 'rejected', 'pending_approval'].includes(status)) {
      return sendError(res, 400, 'Status must be one of: approved, rejected, pending_approval');
    }

    db.prepare(`
      UPDATE startups SET
        status = ?,
        admin_feedback = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(status, adminFeedback || null, startupId);

    // Notify founder
    const title = status === 'approved' ? 'Startup Proposal Approved & Live!' : 'Startup Proposal Update';
    const message = status === 'approved'
      ? `Congratulations! Your venture "${startup.name}" has been approved by PARADOX compliance and is now live for qualified investors.`
      : `Your proposal "${startup.name}" has been marked as ${status}. Review notes: ${adminFeedback || 'Please refine proposal details.'}`;

    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('notif_' + crypto.randomUUID(), startup.founder_id, title, message, 'startup', startupId);

    logAudit(adminUser.id, `STARTUP_${status.toUpperCase()}`, 'startups', startupId, { status, adminFeedback });

    sendJson(res, 200, {
      success: true,
      message: `Startup proposal has been ${status}`,
      startupId,
      status
    });
  } catch (err) {
    sendError(res, 500, 'Failed to review startup: ' + err.message);
  }
}

async function handleGetPendingKYCSubmissions(req, res) {
  try {
    const adminUser = requireRole(['admin'])(req, res);
    if (!adminUser) return;

    const submissions = db.prepare(`
      SELECT 
        k.*,
        u.email,
        u.full_name as user_full_name,
        u.role as user_role,
        u.phone as user_phone,
        up.company_name,
        up.designation
      FROM kyc_verifications k
      JOIN users u ON k.user_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      ORDER BY k.created_at ASC
    `).all();

    sendJson(res, 200, {
      success: true,
      count: submissions.length,
      submissions
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch KYC submissions: ' + err.message);
  }
}

module.exports = {
  handleGetAdminStats,
  handleGetAdminUsers,
  handleReviewStartupByAdmin,
  handleGetPendingKYCSubmissions
};
