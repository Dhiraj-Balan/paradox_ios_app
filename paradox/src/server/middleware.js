// ==============================================================================
// PARADOX — HTTP Middleware & Security Guards
// ==============================================================================

const { authenticateUser } = require('./auth');
const { db } = require('./db');
const crypto = require('node:crypto');

/**
 * Send JSON response with standard security headers
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  });
  res.end(JSON.stringify(data));
}

/**
 * Send standardized error response
 */
function sendError(res, statusCode, message, details = null) {
  sendJson(res, statusCode, {
    success: false,
    error: {
      code: statusCode,
      message,
      details
    }
  });
}

/**
 * Parse JSON body from request stream
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      // 10MB upload limit safeguard
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });

    req.on('end', () => {
      if (!body) {
        return resolve({});
      }
      try {
        const json = JSON.parse(body);
        resolve(json);
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });

    req.on('error', err => {
      reject(err);
    });
  });
}

/**
 * Middleware: Requires valid authentication token
 */
function requireAuth(req, res) {
  const user = authenticateUser(req);
  if (!user) {
    sendError(res, 401, 'Unauthorized: Valid authentication token required');
    return null;
  }
  // Verify user still exists in database and is not banned
  const dbUser = db.prepare('SELECT id, email, full_name, role, kyc_status, is_verified FROM users WHERE id = ?').get(user.id);
  if (!dbUser) {
    sendError(res, 401, 'Unauthorized: User account not found');
    return null;
  }
  return dbUser;
}

/**
 * Middleware: Requires specific roles (e.g. ['admin'], ['investor', 'admin'])
 */
function requireRole(allowedRoles) {
  return function (req, res) {
    const user = requireAuth(req, res);
    if (!user) return null;

    if (!allowedRoles.includes(user.role)) {
      sendError(res, 403, `Forbidden: Operation requires one of roles: [${allowedRoles.join(', ')}]`);
      return null;
    }
    return user;
  };
}

/**
 * Audit log helper
 */
function logAudit(actorId, action, resourceType, resourceId, metadata = {}, ipAddress = '127.0.0.1') {
  try {
    const id = 'aud_' + crypto.randomUUID();
    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, metadata, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, actorId, action, resourceType, resourceId, JSON.stringify(metadata), ipAddress);
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = {
  sendJson,
  sendError,
  parseJsonBody,
  requireAuth,
  requireRole,
  logAudit
};
