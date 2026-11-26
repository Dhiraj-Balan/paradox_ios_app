// ==============================================================================
// PARADOX — Full-Stack Verification & Integration Test Suite
// Where Vision Meets Capital
// Powered by Node.js 24 native node:test
// ==============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');
const path = require('node:path');

// Target server request handler and DB
const { requestHandler } = require('../src/server/server');
const { db, hashPassword, verifyPassword } = require('../src/server/db');
const { signToken, verifyToken } = require('../src/server/auth');

/**
 * High-performance in-memory mock HTTP transaction runner
 */
function mockHttp(method, pathUrl, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = new Readable();
    req.method = method;
    req.url = pathUrl;
    req.headers = {
      host: 'localhost:3000',
      'content-type': 'application/json',
      ...headers
    };

    if (body) {
      const payload = typeof body === 'object' ? JSON.stringify(body) : String(body);
      req.push(payload);
    }
    req.push(null); // End of stream

    let statusCode = 200;
    const responseHeaders = {};
    let responseBody = '';

    const res = new Writable({
      write(chunk, encoding, callback) {
        responseBody += chunk.toString();
        callback();
      }
    });

    res.writeHead = function (code, hdrs) {
      statusCode = code;
      if (hdrs) Object.assign(responseHeaders, hdrs);
    };

    res.setHeader = function (name, val) {
      responseHeaders[name.toLowerCase()] = val;
    };

    res.on('finish', () => {
      let json = null;
      try {
        json = JSON.parse(responseBody);
      } catch {
        json = responseBody;
      }
      resolve({
        statusCode,
        headers: responseHeaders,
        body: json
      });
    });

    try {
      requestHandler(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

// ------------------------------------------------------------------------------
// TEST SUITE
// ------------------------------------------------------------------------------

test('1. Database Engine & Cryptographic Hashing', async (t) => {
  await t.test('Password hashing produces distinct salts and validates correctly', () => {
    const raw = 'FintechPassword#2026';
    const hash1 = hashPassword(raw);
    const hash2 = hashPassword(raw);

    assert.notEqual(hash1, hash2, 'Salts must make hashes distinct');
    assert.ok(verifyPassword(raw, hash1), 'Password must verify against hash1');
    assert.ok(verifyPassword(raw, hash2), 'Password must verify against hash2');
    assert.equal(verifyPassword('WrongPassword', hash1), false, 'Wrong password must be rejected');
  });

  await t.test('JWT token signing and verification', () => {
    const payload = { id: 'usr_test', role: 'investor', email: 'test@apex.com' };
    const token = signToken(payload);
    assert.ok(token.includes('.'), 'Token must have JWT structure');

    const decoded = verifyToken(token);
    assert.equal(decoded.id, 'usr_test');
    assert.equal(decoded.role, 'investor');
    assert.equal(decoded.email, 'test@apex.com');
  });
});

test('2. Authentication Workflows', async (t) => {
  const testInvestorEmail = `investor_${Date.now()}@testfund.com`;

  await t.test('Register new investor account with validation', async () => {
    const res = await mockHttp('POST', '/api/auth/register', {
      email: testInvestorEmail,
      password: 'StrongPassword#123',
      fullName: 'Rohit Khandelwal',
      role: 'investor',
      phone: '+91 99000 11223',
      companyName: 'Khandelwal Family Office',
      country: 'India'
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    assert.equal(res.body.user.role, 'investor');
    assert.equal(res.body.user.full_name, 'Rohit Khandelwal');
  });

  await t.test('Reject duplicate registration email', async () => {
    const res = await mockHttp('POST', '/api/auth/register', {
      email: testInvestorEmail,
      password: 'StrongPassword#123',
      fullName: 'Duplicate Check',
      role: 'investor'
    });

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
  });

  await t.test('Login with valid credentials', async () => {
    const res = await mockHttp('POST', '/api/auth/login', {
      email: testInvestorEmail,
      password: 'StrongPassword#123'
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
  });

  await t.test('Reject login with invalid credentials', async () => {
    const res = await mockHttp('POST', '/api/auth/login', {
      email: testInvestorEmail,
      password: 'IncorrectPassword'
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
  });

  await t.test('Demo switcher returns valid demo sessions', async () => {
    const res = await mockHttp('POST', '/api/auth/demo-switch', { targetRole: 'admin' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.role, 'admin');
    assert.equal(res.body.user.email, 'admin@paradox.com');
  });
});

test('3. Venture Proposal & Admin Approval Lifecycle', async (t) => {
  // Login as entrepreneur
  const founderLogin = await mockHttp('POST', '/api/auth/login', {
    email: 'entrepreneur@paradox.com',
    password: 'Password#123'
  });
  const founderToken = founderLogin.body.token;

  // Login as admin
  const adminLogin = await mockHttp('POST', '/api/auth/login', {
    email: 'admin@paradox.com',
    password: 'Password#123'
  });
  const adminToken = adminLogin.body.token;

  let createdStartupId = null;

  await t.test('Entrepreneur submits new proposal', async () => {
    const res = await mockHttp('POST', '/api/startups', {
      name: 'TerraBreeze Energy',
      tagline: 'Deep geothermal energy generation using resonant magnetic drills',
      description: 'TerraBreeze unlocks baseload clean power at 1/3 the cost of solar + storage.',
      sector: 'Clean Energy',
      stage: 'Seed',
      headquarters: 'Pune, India',
      targetFunding: 25000000,
      proposedEquity: 12.0,
      problemStatement: 'Intermittent renewable energy requires massive battery banks.',
      solutionStatement: 'Baseload supercritical geothermal electricity with 98% uptime.',
      businessModel: 'Power purchase agreements (PPA) with industrial manufacturing parks.'
    }, {
      authorization: `Bearer ${founderToken}`
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.startup.status, 'pending_approval');
    createdStartupId = res.body.startup.id;
  });

  await t.test('Pending proposal is NOT visible in public catalog', async () => {
    const res = await mockHttp('GET', '/api/startups');
    assert.equal(res.statusCode, 200);
    const found = res.body.startups.find(s => s.id === createdStartupId);
    assert.equal(found, undefined, 'Pending startups must not leak into public discovery');
  });

  await t.test('Admin reviews and approves proposal', async () => {
    const res = await mockHttp('PUT', `/api/admin/startups/${createdStartupId}/review`, {
      status: 'approved',
      adminFeedback: 'Diligence completed on patent application. Approved for live catalogue.'
    }, {
      authorization: `Bearer ${adminToken}`
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'approved');
  });

  await t.test('Approved venture is now publicly discoverable with filters', async () => {
    const res = await mockHttp('GET', '/api/startups?sector=Clean+Energy');
    assert.equal(res.statusCode, 200);
    const found = res.body.startups.find(s => s.id === createdStartupId);
    assert.ok(found, 'Venture must now appear in filtered public discovery');
    assert.equal(found.sector, 'Clean Energy');
  });
});

test('4. Investor Watchlist & Indication of Interest (EOI)', async (t) => {
  // Login as investor
  const invLogin = await mockHttp('POST', '/api/auth/login', {
    email: 'investor@paradox.com',
    password: 'Password#123'
  });
  const invToken = invLogin.body.token;

  let testStartupId = 'stp_neuralpay';

  await t.test('Investor toggles save deal in watchlist', async () => {
    const res = await mockHttp('POST', '/api/investments/saved', {
      startupId: testStartupId,
      notes: 'Priority fintech infrastructure diligence'
    }, {
      authorization: `Bearer ${invToken}`
    });

    assert.ok([200, 201].includes(res.statusCode), 'Must return 200 (unsaved) or 201 (saved)');
  });

  await t.test('Investor submits new expression of interest', async () => {
    // Create new unique investor
    const uniqueEmail = `investor_${Date.now()}@apex.co`;
    const regRes = await mockHttp('POST', '/api/auth/register', {
      email: uniqueEmail,
      password: 'StrongPassword#123',
      fullName: 'Ananya Deshmukh',
      role: 'investor'
    });
    const token = regRes.body.token;

    const res = await mockHttp('POST', '/api/investments/interests', {
      startupId: 'stp_aerocarbon',
      proposedAmount: 20000000,
      proposedEquity: 5.5,
      strategicValue: 'Defense aviation supplier introductions in Western Europe',
      message: 'We are eager to lead this seed extension.'
    }, {
      authorization: `Bearer ${token}`
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.interest.proposed_amount, 20000000);
  });
});

test('5. KYC Submission and Administrative Approval', async (t) => {
  // Create user needing KYC
  const userEmail = `founder_kyc_${Date.now()}@test.io`;
  const regRes = await mockHttp('POST', '/api/auth/register', {
    email: userEmail,
    password: 'StrongPassword#123',
    fullName: 'Karan Mehra',
    role: 'entrepreneur'
  });
  const userToken = regRes.body.token;

  let kycId = null;

  await t.test('Submit KYC identification credentials', async () => {
    const res = await mockHttp('POST', '/api/kyc/submit', {
      fullLegalName: 'Karan Mehra',
      documentType: 'passport',
      documentNumber: 'K8920194',
      countryOfIssuance: 'India',
      accreditedDeclaration: true
    }, {
      authorization: `Bearer ${userToken}`
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.status, 'pending');
    kycId = res.body.kycId;
  });

  await t.test('Admin verifies and approves KYC submission', async () => {
    const adminLogin = await mockHttp('POST', '/api/auth/login', {
      email: 'admin@paradox.com',
      password: 'Password#123'
    });
    const adminToken = adminLogin.body.token;

    const res = await mockHttp('PUT', `/api/kyc/review/${kycId}`, {
      status: 'approved'
    }, {
      authorization: `Bearer ${adminToken}`
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'approved');
  });
});

test('6. Secure Bilateral Messaging', async (t) => {
  const invLogin = await mockHttp('POST', '/api/auth/login', {
    email: 'investor@paradox.com',
    password: 'Password#123'
  });
  const invToken = invLogin.body.token;

  await t.test('Send direct message and fetch thread', async () => {
    const sendRes = await mockHttp('POST', '/api/messages/send', {
      conversationId: 'conv_01',
      content: 'Can you provide the audited FY25 balance sheet?'
    }, {
      authorization: `Bearer ${invToken}`
    });

    assert.equal(sendRes.statusCode, 201);
    assert.equal(sendRes.body.success, true);

    const threadRes = await mockHttp('GET', '/api/messages/thread/conv_01', null, {
      authorization: `Bearer ${invToken}`
    });

    assert.equal(threadRes.statusCode, 200);
    assert.ok(threadRes.body.messages.length >= 3);
  });
});
