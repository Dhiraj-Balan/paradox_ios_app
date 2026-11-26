// ==============================================================================
// PARADOX — Investment Interests, Portfolio & Watchlist API Routes
// ==============================================================================

const { db } = require('../db');
const { sendJson, sendError, parseJsonBody, requireAuth, logAudit } = require('../middleware');
const crypto = require('node:crypto');

async function handleGetInterests(req, res) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    let interests;
    if (authUser.role === 'investor') {
      interests = db.prepare(`
        SELECT 
          ii.*,
          s.name as startup_name,
          s.sector as startup_sector,
          s.stage as startup_stage,
          s.target_funding,
          s.raised_funding,
          u.full_name as founder_name,
          u.email as founder_email
        FROM investment_interests ii
        JOIN startups s ON ii.startup_id = s.id
        JOIN users u ON s.founder_id = u.id
        WHERE ii.investor_id = ?
        ORDER BY ii.created_at DESC
      `).all(authUser.id);
    } else if (authUser.role === 'entrepreneur') {
      interests = db.prepare(`
        SELECT 
          ii.*,
          s.name as startup_name,
          s.sector as startup_sector,
          s.stage as startup_stage,
          u.full_name as investor_name,
          u.email as investor_email,
          up.company_name as investor_company,
          up.accredited_investor,
          up.net_worth_range
        FROM investment_interests ii
        JOIN startups s ON ii.startup_id = s.id
        JOIN users u ON ii.investor_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE s.founder_id = ?
        ORDER BY ii.created_at DESC
      `).all(authUser.id);
    } else {
      // Admin sees all
      interests = db.prepare(`
        SELECT 
          ii.*,
          s.name as startup_name,
          s.sector as startup_sector,
          inv.full_name as investor_name,
          inv.email as investor_email,
          fnd.full_name as founder_name,
          fnd.email as founder_email
        FROM investment_interests ii
        JOIN startups s ON ii.startup_id = s.id
        JOIN users inv ON ii.investor_id = inv.id
        JOIN users fnd ON s.founder_id = fnd.id
        ORDER BY ii.created_at DESC
      `).all();
    }

    sendJson(res, 200, {
      success: true,
      count: interests.length,
      interests
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch investment interests: ' + err.message);
  }
}

async function handleCreateInterest(req, res) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    if (authUser.role !== 'investor' && authUser.role !== 'admin') {
      return sendError(res, 403, 'Forbidden: Only accredited investors can submit indications of investment interest');
    }

    const body = await parseJsonBody(req);
    const { startupId, proposedAmount, proposedEquity, strategicValue, message } = body;

    if (!startupId || !proposedAmount || !message) {
      return sendError(res, 400, 'Missing mandatory interest fields: startupId, proposedAmount, message');
    }

    const startup = db.prepare('SELECT * FROM startups WHERE id = ?').get(startupId);
    if (!startup) {
      return sendError(res, 404, 'Startup not found');
    }

    if (startup.status !== 'approved' && authUser.role !== 'admin') {
      return sendError(res, 400, 'Investment interests can only be submitted for approved startup proposals');
    }

    // Check if interest already submitted
    const existing = db.prepare('SELECT id FROM investment_interests WHERE startup_id = ? AND investor_id = ?').get(startupId, authUser.id);
    if (existing) {
      return sendError(res, 409, 'You have already submitted an indication of interest for this venture');
    }

    const interestId = 'int_' + crypto.randomUUID();

    db.prepare(`
      INSERT INTO investment_interests (
        id, startup_id, investor_id, proposed_amount, proposed_equity, strategic_value, message, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      interestId,
      startupId,
      authUser.id,
      parseFloat(proposedAmount),
      proposedEquity !== undefined ? parseFloat(proposedEquity) : null,
      strategicValue || null,
      message.trim(),
      'pending'
    );

    // Notify the startup founder
    const amountInCr = (parseFloat(proposedAmount) / 10000000).toFixed(2);
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'notif_' + crypto.randomUUID(),
      startup.founder_id,
      `New ₹${amountInCr} Cr Investment Interest`,
      `${authUser.full_name} has submitted a formal indication of interest for ${startup.name}.`,
      'interest',
      interestId
    );

    logAudit(authUser.id, 'INTEREST_SUBMIT', 'investment_interests', interestId, { startupId, proposedAmount });

    const created = db.prepare('SELECT * FROM investment_interests WHERE id = ?').get(interestId);

    sendJson(res, 201, {
      success: true,
      message: 'Investment indication of interest submitted successfully to the founder',
      interest: created
    });
  } catch (err) {
    sendError(res, 500, 'Failed to submit investment interest: ' + err.message);
  }
}

async function handleUpdateInterestStatus(req, res, interestId) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    const interest = db.prepare(`
      SELECT ii.*, s.founder_id, s.name as startup_name, s.raised_funding
      FROM investment_interests ii
      JOIN startups s ON ii.startup_id = s.id
      WHERE ii.id = ?
    `).get(interestId);

    if (!interest) {
      return sendError(res, 404, 'Investment interest record not found');
    }

    // Must be either founder of the startup or admin
    if (interest.founder_id !== authUser.id && authUser.role !== 'admin' && interest.investor_id !== authUser.id) {
      return sendError(res, 403, 'Forbidden: You are not authorized to update this interest');
    }

    const body = await parseJsonBody(req);
    const { status, responseNote } = body;

    const validStatuses = ['pending', 'under_review', 'accepted', 'declined', 'term_sheet_issued', 'closed'];
    if (!validStatuses.includes(status)) {
      return sendError(res, 400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    db.prepare(`
      UPDATE investment_interests SET
        status = ?,
        response_note = COALESCE(?, response_note),
        responded_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(status, responseNote, interestId);

    // If accepted or closed, optionally update startup raised funding
    if (status === 'closed' || status === 'accepted') {
      db.prepare(`
        UPDATE startups SET
          raised_funding = raised_funding + ?
        WHERE id = ?
      `).run(interest.proposed_amount, interest.startup_id);
    }

    // Notify investor of status change
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'notif_' + crypto.randomUUID(),
      interest.investor_id,
      `Proposal Status Update: ${interest.startup_name}`,
      `Your investment interest in ${interest.startup_name} has been updated to "${status.toUpperCase()}". ${responseNote ? 'Note: ' + responseNote : ''}`,
      'interest',
      interestId
    );

    logAudit(authUser.id, 'INTEREST_STATUS_UPDATE', 'investment_interests', interestId, { status });

    const updated = db.prepare('SELECT * FROM investment_interests WHERE id = ?').get(interestId);

    sendJson(res, 200, {
      success: true,
      message: `Interest status updated to ${status}`,
      interest: updated
    });
  } catch (err) {
    sendError(res, 500, 'Failed to update interest status: ' + err.message);
  }
}

async function handleGetSavedStartups(req, res) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    const saved = db.prepare(`
      SELECT 
        ss.id as saved_id,
        ss.notes,
        ss.created_at as saved_at,
        s.*,
        u.full_name as founder_name
      FROM saved_startups ss
      JOIN startups s ON ss.startup_id = s.id
      JOIN users u ON s.founder_id = u.id
      WHERE ss.user_id = ?
      ORDER BY ss.created_at DESC
    `).all(authUser.id);

    const formatted = saved.map(s => ({
      ...s,
      progressPercentage: Math.min(100, Math.round((s.raised_funding / s.target_funding) * 100)),
      isSaved: true
    }));

    sendJson(res, 200, {
      success: true,
      count: formatted.length,
      startups: formatted
    });
  } catch (err) {
    sendError(res, 500, 'Failed to get saved startups: ' + err.message);
  }
}

async function handleToggleSaveStartup(req, res) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    const body = await parseJsonBody(req);
    const { startupId, notes } = body;

    if (!startupId) {
      return sendError(res, 400, 'startupId is required');
    }

    const existing = db.prepare('SELECT id FROM saved_startups WHERE user_id = ? AND startup_id = ?').get(authUser.id, startupId);

    if (existing) {
      db.prepare('DELETE FROM saved_startups WHERE id = ?').run(existing.id);
      return sendJson(res, 200, {
        success: true,
        saved: false,
        message: 'Removed startup from watchlist'
      });
    } else {
      const id = 'sav_' + crypto.randomUUID();
      db.prepare(`
        INSERT INTO saved_startups (id, user_id, startup_id, notes)
        VALUES (?, ?, ?, ?)
      `).run(id, authUser.id, startupId, notes || null);

      return sendJson(res, 201, {
        success: true,
        saved: true,
        message: 'Saved startup to watchlist'
      });
    }
  } catch (err) {
    sendError(res, 500, 'Toggle save failed: ' + err.message);
  }
}

module.exports = {
  handleGetInterests,
  handleCreateInterest,
  handleUpdateInterestStatus,
  handleGetSavedStartups,
  handleToggleSaveStartup
};
