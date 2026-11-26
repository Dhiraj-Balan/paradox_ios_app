// ==============================================================================
// PARADOX — Startup Proposals & Discovery API Routes
// ==============================================================================

const { db } = require('../db');
const { authenticateUser } = require('../auth');
const { sendJson, sendError, parseJsonBody, requireAuth, logAudit } = require('../middleware');
const crypto = require('node:crypto');

async function handleGetStartups(req, res, urlObj) {
  try {
    const authUser = authenticateUser(req);
    const query = urlObj.searchParams;

    const searchTerm = query.get('q') || '';
    const sector = query.get('sector') || '';
    const stage = query.get('stage') || '';
    const minFunding = parseFloat(query.get('minFunding')) || 0;
    const maxFunding = parseFloat(query.get('maxFunding')) || 1000000000;
    const founderOnly = query.get('my') === 'true';
    const statusFilter = query.get('status') || '';

    let sql = `
      SELECT 
        s.*,
        u.full_name as founder_name,
        u.email as founder_email,
        u.kyc_status as founder_kyc_status,
        up.company_name as founder_company,
        CASE WHEN ss.id IS NOT NULL THEN 1 ELSE 0 END as is_saved
      FROM startups s
      JOIN users u ON s.founder_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN saved_startups ss ON (ss.startup_id = s.id AND ss.user_id = ?)
      WHERE 1=1
    `;

    const params = [authUser ? authUser.id : null];

    // Visibility / Status logic
    if (founderOnly && authUser) {
      sql += ' AND s.founder_id = ?';
      params.push(authUser.id);
    } else if (authUser && authUser.role === 'admin') {
      if (statusFilter) {
        sql += ' AND s.status = ?';
        params.push(statusFilter);
      }
    } else {
      // Normal investors/public only see approved startups unless it's their own
      if (authUser) {
        sql += " AND (s.status = 'approved' OR s.founder_id = ?)";
        params.push(authUser.id);
      } else {
        sql += " AND s.status = 'approved'";
      }
    }

    // Keyword search
    if (searchTerm) {
      sql += ' AND (s.name LIKE ? OR s.tagline LIKE ? OR s.description LIKE ? OR s.headquarters LIKE ?)';
      const termPattern = `%${searchTerm}%`;
      params.push(termPattern, termPattern, termPattern, termPattern);
    }

    // Sector filter
    if (sector && sector !== 'All') {
      sql += ' AND s.sector = ?';
      params.push(sector);
    }

    // Stage filter
    if (stage && stage !== 'All') {
      sql += ' AND s.stage = ?';
      params.push(stage);
    }

    // Funding range
    if (minFunding > 0) {
      sql += ' AND s.target_funding >= ?';
      params.push(minFunding);
    }
    if (maxFunding < 1000000000) {
      sql += ' AND s.target_funding <= ?';
      params.push(maxFunding);
    }

    sql += ' ORDER BY s.created_at DESC';

    const startups = db.prepare(sql).all(...params);

    const formatted = startups.map(s => ({
      ...s,
      progressPercentage: Math.min(100, Math.round((s.raised_funding / s.target_funding) * 100)),
      isSaved: Boolean(s.is_saved)
    }));

    sendJson(res, 200, {
      success: true,
      count: formatted.length,
      startups: formatted
    });
  } catch (err) {
    sendError(res, 500, 'Failed to retrieve startups: ' + err.message);
  }
}

async function handleGetStartupById(req, res, startupId) {
  try {
    const authUser = authenticateUser(req);

    // Increment view count
    db.prepare('UPDATE startups SET view_count = view_count + 1 WHERE id = ?').run(startupId);

    const sql = `
      SELECT 
        s.*,
        u.full_name as founder_name,
        u.email as founder_email,
        u.phone as founder_phone,
        u.kyc_status as founder_kyc_status,
        up.company_name as founder_company,
        up.designation as founder_designation,
        up.linkedin_url as founder_linkedin,
        up.bio as founder_bio,
        CASE WHEN ss.id IS NOT NULL THEN 1 ELSE 0 END as is_saved
      FROM startups s
      JOIN users u ON s.founder_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN saved_startups ss ON (ss.startup_id = s.id AND ss.user_id = ?)
      WHERE s.id = ?
    `;

    const startup = db.prepare(sql).get(authUser ? authUser.id : null, startupId);
    if (!startup) {
      return sendError(res, 404, 'Startup proposal not found');
    }

    // Access control: if not approved, only founder or admin can view
    if (startup.status !== 'approved') {
      if (!authUser || (authUser.id !== startup.founder_id && authUser.role !== 'admin')) {
        return sendError(res, 403, 'This startup proposal is currently undergoing private compliance review');
      }
    }

    // Fetch existing investment interests if founder or admin
    let interests = [];
    if (authUser && (authUser.id === startup.founder_id || authUser.role === 'admin')) {
      interests = db.prepare(`
        SELECT ii.*, u.full_name as investor_name, u.email as investor_email, up.company_name as investor_company
        FROM investment_interests ii
        JOIN users u ON ii.investor_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE ii.startup_id = ?
        ORDER BY ii.created_at DESC
      `).all(startupId);
    }

    sendJson(res, 200, {
      success: true,
      startup: {
        ...startup,
        progressPercentage: Math.min(100, Math.round((startup.raised_funding / startup.target_funding) * 100)),
        isSaved: Boolean(startup.is_saved),
        interests
      }
    });
  } catch (err) {
    sendError(res, 500, 'Failed to retrieve startup: ' + err.message);
  }
}

async function handleCreateStartup(req, res) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    if (!['entrepreneur', 'admin'].includes(authUser.role)) {
      return sendError(res, 403, 'Forbidden: Only entrepreneurs or administrators can submit startup proposals');
    }

    const body = await parseJsonBody(req);
    const {
      name, tagline, description, sector, stage, headquarters,
      targetFunding, proposedEquity, preMoneyValuation,
      mrr, arr, burnRate, runwayMonths, pitchDeckUrl,
      problemStatement, solutionStatement, businessModel, tractionHighlights, teamSummary
    } = body;

    // Validate required fields
    if (!name || !tagline || !description || !sector || !stage || !headquarters || !targetFunding || proposedEquity === undefined) {
      return sendError(res, 400, 'Missing mandatory proposal fields: name, tagline, description, sector, stage, headquarters, targetFunding, proposedEquity');
    }

    const startupId = 'stp_' + crypto.randomUUID();
    const status = authUser.role === 'admin' ? 'approved' : 'pending_approval';

    db.prepare(`
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
    `).run(
      startupId,
      authUser.id,
      name.trim(),
      tagline.trim(),
      description.trim(),
      sector,
      stage,
      headquarters.trim(),
      parseFloat(targetFunding),
      0.0,
      parseFloat(proposedEquity),
      parseFloat(preMoneyValuation) || (parseFloat(targetFunding) * (100 / parseFloat(proposedEquity))),
      parseFloat(mrr) || 0.0,
      parseFloat(arr) || 0.0,
      parseFloat(burnRate) || 0.0,
      parseInt(runwayMonths) || 12,
      pitchDeckUrl || null,
      problemStatement || description,
      solutionStatement || tagline,
      businessModel || 'Direct B2B/B2C SaaS & platform fees',
      tractionHighlights || null,
      teamSummary || null,
      status,
      0
    );

    // Notify administrators
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    for (const admin of admins) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, reference_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'notif_' + crypto.randomUUID(),
        admin.id,
        'New Startup Submission Pending Review',
        `A new startup proposal "${name}" (${sector}, ₹${(parseFloat(targetFunding)/10000000).toFixed(2)} Cr) was submitted by ${authUser.full_name}.`,
        'startup',
        startupId
      );
    }

    logAudit(authUser.id, 'STARTUP_CREATE', 'startups', startupId, { name, sector, targetFunding });

    const created = db.prepare('SELECT * FROM startups WHERE id = ?').get(startupId);

    sendJson(res, 201, {
      success: true,
      message: status === 'approved' ? 'Startup created and published' : 'Startup proposal submitted successfully. Pending administrative compliance approval.',
      startup: created
    });
  } catch (err) {
    sendError(res, 500, 'Failed to create startup proposal: ' + err.message);
  }
}

async function handleUpdateStartup(req, res, startupId) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    const startup = db.prepare('SELECT * FROM startups WHERE id = ?').get(startupId);
    if (!startup) {
      return sendError(res, 404, 'Startup proposal not found');
    }

    if (startup.founder_id !== authUser.id && authUser.role !== 'admin') {
      return sendError(res, 403, 'Forbidden: You do not have permission to modify this proposal');
    }

    const body = await parseJsonBody(req);
    const {
      name, tagline, description, sector, stage, headquarters,
      targetFunding, raisedFunding, proposedEquity, preMoneyValuation,
      mrr, arr, burnRate, runwayMonths, pitchDeckUrl,
      problemStatement, solutionStatement, businessModel, tractionHighlights, teamSummary
    } = body;

    db.prepare(`
      UPDATE startups SET
        name = COALESCE(?, name),
        tagline = COALESCE(?, tagline),
        description = COALESCE(?, description),
        sector = COALESCE(?, sector),
        stage = COALESCE(?, stage),
        headquarters = COALESCE(?, headquarters),
        target_funding = COALESCE(?, target_funding),
        raised_funding = COALESCE(?, raised_funding),
        proposed_equity = COALESCE(?, proposed_equity),
        pre_money_valuation = COALESCE(?, pre_money_valuation),
        mrr = COALESCE(?, mrr),
        arr = COALESCE(?, arr),
        burn_rate = COALESCE(?, burn_rate),
        runway_months = COALESCE(?, runway_months),
        pitch_deck_url = COALESCE(?, pitch_deck_url),
        problem_statement = COALESCE(?, problem_statement),
        solution_statement = COALESCE(?, solution_statement),
        business_model = COALESCE(?, business_model),
        traction_highlights = COALESCE(?, traction_highlights),
        team_summary = COALESCE(?, team_summary),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name, tagline, description, sector, stage, headquarters,
      targetFunding !== undefined ? parseFloat(targetFunding) : null,
      raisedFunding !== undefined ? parseFloat(raisedFunding) : null,
      proposedEquity !== undefined ? parseFloat(proposedEquity) : null,
      preMoneyValuation !== undefined ? parseFloat(preMoneyValuation) : null,
      mrr !== undefined ? parseFloat(mrr) : null,
      arr !== undefined ? parseFloat(arr) : null,
      burnRate !== undefined ? parseFloat(burnRate) : null,
      runwayMonths !== undefined ? parseInt(runwayMonths) : null,
      pitchDeckUrl,
      problemStatement, solutionStatement, businessModel, tractionHighlights, teamSummary,
      startupId
    );

    logAudit(authUser.id, 'STARTUP_UPDATE', 'startups', startupId);

    const updated = db.prepare('SELECT * FROM startups WHERE id = ?').get(startupId);

    sendJson(res, 200, {
      success: true,
      message: 'Startup proposal updated successfully',
      startup: updated
    });
  } catch (err) {
    sendError(res, 500, 'Failed to update startup: ' + err.message);
  }
}

async function handleDeleteStartup(req, res, startupId) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    const startup = db.prepare('SELECT * FROM startups WHERE id = ?').get(startupId);
    if (!startup) {
      return sendError(res, 404, 'Startup proposal not found');
    }

    if (startup.founder_id !== authUser.id && authUser.role !== 'admin') {
      return sendError(res, 403, 'Forbidden: Only the founder or platform administrator can delete this proposal');
    }

    db.prepare('DELETE FROM startups WHERE id = ?').run(startupId);

    logAudit(authUser.id, 'STARTUP_DELETE', 'startups', startupId, { name: startup.name });

    sendJson(res, 200, {
      success: true,
      message: 'Startup proposal deleted successfully'
    });
  } catch (err) {
    sendError(res, 500, 'Failed to delete startup: ' + err.message);
  }
}

module.exports = {
  handleGetStartups,
  handleGetStartupById,
  handleCreateStartup,
  handleUpdateStartup,
  handleDeleteStartup
};
