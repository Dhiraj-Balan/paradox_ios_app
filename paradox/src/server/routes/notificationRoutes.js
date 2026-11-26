// ==============================================================================
// PARADOX — Notifications API Routes
// ==============================================================================

const { db } = require('../db');
const { sendJson, sendError, parseJsonBody, requireAuth } = require('../middleware');

async function handleGetNotifications(req, res) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    const notifs = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(authUser.id);

    const unreadCount = db.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(authUser.id).count;

    sendJson(res, 200, {
      success: true,
      unreadCount,
      notifications: notifs
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch notifications: ' + err.message);
  }
}

async function handleMarkNotificationRead(req, res, notifId) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    if (notifId === 'all') {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(authUser.id);
      return sendJson(res, 200, { success: true, message: 'All notifications marked as read' });
    }

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notifId, authUser.id);

    sendJson(res, 200, {
      success: true,
      message: 'Notification marked as read'
    });
  } catch (err) {
    sendError(res, 500, 'Failed to update notification: ' + err.message);
  }
}

module.exports = {
  handleGetNotifications,
  handleMarkNotificationRead
};
