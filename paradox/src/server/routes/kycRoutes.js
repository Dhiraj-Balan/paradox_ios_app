// ==============================================================================
// PARADOX — KYC Identification & Compliance API Routes
// ==============================================================================

const { db } = require('../db');
const { sendJson, sendError, parseJsonBody, requireAuth, requireRole, logAudit } = require('../middleware');
const crypto = require('node:crypto');

async function handleGetKYCStatus(req, res) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    const submission = db.prepare(`
      SELECT * FROM kyc_verifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(authUser.id);

    sendJson(res, 200, {
      success: true,
      kycStatus: authUser.kyc_status,
      isVerified: Boolean(authUser.is_verified),
      submission: submission || null
    });
  } catch (err) {
    sendError(res, 500, 'Failed to retrieve KYC status: ' + err.message);
  }
}

async function handleSubmitKYC(req, res) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    const body = await parseJsonBody(req);
    const {
      fullLegalName, documentType, documentNumber, countryOfIssuance,
      documentFileUrl, addressProofUrl, accreditedDeclaration, annualIncomeRange
    } = body;

    if (!fullLegalName || !documentType || !documentNumber || !countryOfIssuance) {
      return sendError(res, 400, 'Missing mandatory KYC fields: fullLegalName, documentType, documentNumber, countryOfIssuance');
    }

    const validDocTypes = ['passport', 'national_id', 'driving_license', 'tax_id', 'incorporation_cert'];
    if (!validDocTypes.includes(documentType)) {
      return sendError(res, 400, `Invalid documentType. Must be one of: ${validDocTypes.join(', ')}`);
    }

    const kycId = 'kyc_' + crypto.randomUUID();

    // Default document url if test upload
    const docUrl = documentFileUrl || `https://storage.paradox.finance/vault/kyc_${crypto.randomBytes(8).toString('hex')}.pdf`;

    db.prepare(`
      INSERT INTO kyc_verifications (
        id, user_id, full_legal_name, document_type, document_number, country_of_issuance,
        document_file_url, address_proof_url, accredited_declaration, annual_income_range, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      kycId,
      authUser.id,
      fullLegalName.trim(),
      documentType,
      documentNumber.trim(),
      countryOfIssuance.trim(),
      docUrl,
      addressProofUrl || null,
      accreditedDeclaration ? 1 : 0,
      annualIncomeRange || null
    );

    // Update user state to pending
    db.prepare("UPDATE users SET kyc_status = 'pending', updated_at = datetime('now') WHERE id = ?").run(authUser.id);

    // Notify administrators
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    for (const admin of admins) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, reference_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'notif_' + crypto.randomUUID(),
        admin.id,
        'KYC Submission Pending Compliance Review',
        `User ${fullLegalName} (${authUser.role}, ${countryOfIssuance}) has submitted KYC document ${documentType.toUpperCase()} for verification.`,
        'kyc',
        kycId
      );
    }

    logAudit(authUser.id, 'KYC_SUBMIT', 'kyc_verifications', kycId, { documentType, countryOfIssuance });

    sendJson(res, 201, {
      success: true,
      message: 'KYC documents submitted securely. Platform compliance review is in progress.',
      kycId,
      status: 'pending'
    });
  } catch (err) {
    sendError(res, 500, 'KYC submission failed: ' + err.message);
  }
}

async function handleReviewKYC(req, res, kycId) {
  try {
    const adminUser = requireRole(['admin'])(req, res);
    if (!adminUser) return;

    const kycRecord = db.prepare('SELECT * FROM kyc_verifications WHERE id = ?').get(kycId);
    if (!kycRecord) {
      return sendError(res, 404, 'KYC submission not found');
    }

    const body = await parseJsonBody(req);
    const { status, rejectionReason } = body;

    if (!['approved', 'rejected'].includes(status)) {
      return sendError(res, 400, 'Status must be either "approved" or "rejected"');
    }

    // Update KYC verification
    db.prepare(`
      UPDATE kyc_verifications SET
        status = ?,
        rejection_reason = ?,
        reviewed_by = ?,
        reviewed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(status, rejectionReason || null, adminUser.id, kycId);

    // Update user record: users.kyc_status uses ('unverified', 'pending', 'verified', 'rejected')
    const userKycStatus = status === 'approved' ? 'verified' : 'rejected';
    const isVerified = status === 'approved' ? 1 : 0;
    db.prepare(`
      UPDATE users SET
        kyc_status = ?,
        is_verified = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(userKycStatus, isVerified, kycRecord.user_id);

    // Notify user
    const title = status === 'approved' ? 'KYC Verification Approved' : 'KYC Verification Rejected';
    const message = status === 'approved'
      ? 'Congratulations! Your global investor/founder identity has been verified. Full ecosystem features are now unlocked.'
      : `Your KYC submission could not be verified. Reason: ${rejectionReason || 'Document legibility or mismatch'}. Please resubmit.`;

    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('notif_' + crypto.randomUUID(), kycRecord.user_id, title, message, 'kyc', kycId);

    logAudit(adminUser.id, `KYC_${status.toUpperCase()}`, 'kyc_verifications', kycId, { targetUser: kycRecord.user_id });

    sendJson(res, 200, {
      success: true,
      message: `KYC submission ${status}`,
      kycId,
      status
    });
  } catch (err) {
    sendError(res, 500, 'KYC review failed: ' + err.message);
  }
}

module.exports = {
  handleGetKYCStatus,
  handleSubmitKYC,
  handleReviewKYC
};
