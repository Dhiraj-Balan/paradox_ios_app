// ==============================================================================
// PARADOX — Full-Stack Application Server
// Where Vision Meets Capital
// ==============================================================================

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const url = require('node:url');

const { db } = require('./db');
const { sendJson, sendError } = require('./middleware');

// Routes
const authRoutes = require('./routes/authRoutes');
const startupRoutes = require('./routes/startupRoutes');
const investmentRoutes = require('./routes/investmentRoutes');
const kycRoutes = require('./routes/kycRoutes');
const messageRoutes = require('./routes/messageRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2'
};

/**
 * Main request dispatcher
 */
function requestHandler(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  // ----------------------------------------------------------------------------
  // API ROUTING
  // ----------------------------------------------------------------------------
  if (pathname.startsWith('/api/')) {
    // 1. Authentication
    if (pathname === '/api/auth/register' && method === 'POST') {
      return authRoutes.handleRegister(req, res);
    }
    if (pathname === '/api/auth/login' && method === 'POST') {
      return authRoutes.handleLogin(req, res);
    }
    if (pathname === '/api/auth/me' && method === 'GET') {
      return authRoutes.handleGetMe(req, res);
    }
    if (pathname === '/api/auth/profile' && method === 'PUT') {
      return authRoutes.handleUpdateProfile(req, res);
    }
    if (pathname === '/api/auth/recover' && method === 'POST') {
      return authRoutes.handleRecoverPassword(req, res);
    }
    if (pathname === '/api/auth/demo-switch' && method === 'POST') {
      return authRoutes.handleDemoSwitch(req, res);
    }

    // 2. Startups & Discovery
    if (pathname === '/api/startups' && method === 'GET') {
      return startupRoutes.handleGetStartups(req, res, parsedUrl);
    }
    if (pathname === '/api/startups' && method === 'POST') {
      return startupRoutes.handleCreateStartup(req, res);
    }
    const startupIdMatch = pathname.match(/^\/api\/startups\/([a-zA-Z0-9_-]+)$/);
    if (startupIdMatch) {
      const startupId = startupIdMatch[1];
      if (method === 'GET') return startupRoutes.handleGetStartupById(req, res, startupId);
      if (method === 'PUT') return startupRoutes.handleUpdateStartup(req, res, startupId);
      if (method === 'DELETE') return startupRoutes.handleDeleteStartup(req, res, startupId);
    }

    // 3. Investments & Interests
    if (pathname === '/api/investments/interests' && method === 'GET') {
      return investmentRoutes.handleGetInterests(req, res);
    }
    if (pathname === '/api/investments/interests' && method === 'POST') {
      return investmentRoutes.handleCreateInterest(req, res);
    }
    const interestStatusMatch = pathname.match(/^\/api\/investments\/interests\/([a-zA-Z0-9_-]+)\/status$/);
    if (interestStatusMatch && method === 'PUT') {
      return investmentRoutes.handleUpdateInterestStatus(req, res, interestStatusMatch[1]);
    }
    if (pathname === '/api/investments/saved' && method === 'GET') {
      return investmentRoutes.handleGetSavedStartups(req, res);
    }
    if (pathname === '/api/investments/saved' && method === 'POST') {
      return investmentRoutes.handleToggleSaveStartup(req, res);
    }

    // 4. KYC
    if (pathname === '/api/kyc/status' && method === 'GET') {
      return kycRoutes.handleGetKYCStatus(req, res);
    }
    if (pathname === '/api/kyc/submit' && method === 'POST') {
      return kycRoutes.handleSubmitKYC(req, res);
    }
    const kycReviewMatch = pathname.match(/^\/api\/kyc\/review\/([a-zA-Z0-9_-]+)$/);
    if (kycReviewMatch && method === 'PUT') {
      return kycRoutes.handleReviewKYC(req, res, kycReviewMatch[1]);
    }

    // 5. Messages
    if (pathname === '/api/messages/conversations' && method === 'GET') {
      return messageRoutes.handleGetConversations(req, res);
    }
    const msgThreadMatch = pathname.match(/^\/api\/messages\/thread\/([a-zA-Z0-9_-]+)$/);
    if (msgThreadMatch && method === 'GET') {
      return messageRoutes.handleGetThreadMessages(req, res, msgThreadMatch[1]);
    }
    if (pathname === '/api/messages/send' && method === 'POST') {
      return messageRoutes.handleSendMessage(req, res);
    }

    // 6. Notifications
    if (pathname === '/api/notifications' && method === 'GET') {
      return notificationRoutes.handleGetNotifications(req, res);
    }
    const notifReadMatch = pathname.match(/^\/api\/notifications\/([a-zA-Z0-9_-]+)\/read$/);
    if (notifReadMatch && method === 'PUT') {
      return notificationRoutes.handleMarkNotificationRead(req, res, notifReadMatch[1]);
    }

    // 7. Administrator
    if (pathname === '/api/admin/stats' && method === 'GET') {
      return adminRoutes.handleGetAdminStats(req, res);
    }
    if (pathname === '/api/admin/users' && method === 'GET') {
      return adminRoutes.handleGetAdminUsers(req, res, parsedUrl);
    }
    if (pathname === '/api/admin/kyc/pending' && method === 'GET') {
      return adminRoutes.handleGetPendingKYCSubmissions(req, res);
    }
    const adminStartupReviewMatch = pathname.match(/^\/api\/admin\/startups\/([a-zA-Z0-9_-]+)\/review$/);
    if (adminStartupReviewMatch && method === 'PUT') {
      return adminRoutes.handleReviewStartupByAdmin(req, res, adminStartupReviewMatch[1]);
    }

    // Unknown API endpoint
    return sendError(res, 404, `Endpoint ${method} ${pathname} not found`);
  }

  // ----------------------------------------------------------------------------
  // STATIC FILE SERVING
  // ----------------------------------------------------------------------------
  let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);

  // Security: prevent path traversal out of PUBLIC_DIR
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(PUBLIC_DIR))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.stat(resolved, (err, stats) => {
    if (err || !stats.isFile()) {
      // Single Page Application fallback: send index.html for unknown HTML paths
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(indexPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Resource not found');
      }
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(resolved).pipe(res);
  });
}

const server = http.createServer(requestHandler);

function startServer(port = process.env.PORT || 3000) {
  return new Promise((resolve, reject) => {
    server.listen(port, '0.0.0.0', () => {
      console.log(`\n================================================================`);
      console.log(`  PARADOX — Where Vision Meets Capital`);
      console.log(`  Production Full-Stack Engine Live on http://localhost:${port}`);
      console.log(`================================================================\n`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

// Auto-run if executed directly
if (require.main === module) {
  const port = process.env.PORT || 3000;
  startServer(port).catch(err => {
    console.error('Server startup failed:', err);
    process.exit(1);
  });
}

module.exports = {
  server,
  startServer,
  requestHandler
};
