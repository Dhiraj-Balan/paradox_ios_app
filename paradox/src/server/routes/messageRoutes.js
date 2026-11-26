// ==============================================================================
// PARADOX — Encrypted Messaging & Communications API Routes
// ==============================================================================

const { db } = require('../db');
const { sendJson, sendError, parseJsonBody, requireAuth, logAudit } = require('../middleware');
const crypto = require('node:crypto');

async function handleGetConversations(req, res) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    const convs = db.prepare(`
      SELECT 
        c.*,
        s.name as startup_name,
        s.sector as startup_sector,
        CASE WHEN c.participant1_id = ? THEN u2.full_name ELSE u1.full_name END as other_participant_name,
        CASE WHEN c.participant1_id = ? THEN u2.role ELSE u1.role END as other_participant_role,
        CASE WHEN c.participant1_id = ? THEN u2.id ELSE u1.id END as other_participant_id,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND recipient_id = ? AND is_read = 0) as unread_count
      FROM conversations c
      JOIN users u1 ON c.participant1_id = u1.id
      JOIN users u2 ON c.participant2_id = u2.id
      LEFT JOIN startups s ON c.startup_id = s.id
      WHERE c.participant1_id = ? OR c.participant2_id = ?
      ORDER BY c.last_message_at DESC
    `).all(authUser.id, authUser.id, authUser.id, authUser.id, authUser.id, authUser.id);

    sendJson(res, 200, {
      success: true,
      count: convs.length,
      conversations: convs
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch conversations: ' + err.message);
  }
}

async function handleGetThreadMessages(req, res, conversationId) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
    if (!conv) {
      return sendError(res, 404, 'Conversation not found');
    }

    if (conv.participant1_id !== authUser.id && conv.participant2_id !== authUser.id && authUser.role !== 'admin') {
      return sendError(res, 403, 'Forbidden: You are not a participant in this conversation');
    }

    // Mark messages sent to current user as read
    db.prepare(`
      UPDATE messages SET
        is_read = 1,
        read_at = datetime('now')
      WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0
    `).run(conversationId, authUser.id);

    const messages = db.prepare(`
      SELECT 
        m.*,
        u.full_name as sender_name,
        u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `).all(conversationId);

    sendJson(res, 200, {
      success: true,
      conversationId,
      messages
    });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch conversation thread: ' + err.message);
  }
}

async function handleSendMessage(req, res) {
  try {
    const authUser = requireAuth(req, res);
    if (!authUser) return;

    const body = await parseJsonBody(req);
    let { conversationId, recipientId, startupId, content, attachmentUrl } = body;

    if (!content || !content.trim()) {
      return sendError(res, 400, 'Message content cannot be empty');
    }

    // Find or create conversation
    let conv;
    if (conversationId) {
      conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
      if (!conv) return sendError(res, 404, 'Conversation not found');
      recipientId = conv.participant1_id === authUser.id ? conv.participant2_id : conv.participant1_id;
    } else {
      if (!recipientId) {
        return sendError(res, 400, 'Recipient ID is required to start a conversation');
      }

      // Check if conversation already exists between these 2 users
      conv = db.prepare(`
        SELECT * FROM conversations 
        WHERE ((participant1_id = ? AND participant2_id = ?) OR (participant1_id = ? AND participant2_id = ?))
        AND (startup_id = ? OR (startup_id IS NULL AND ? IS NULL))
      `).get(authUser.id, recipientId, recipientId, authUser.id, startupId || null, startupId || null);

      if (!conv) {
        conversationId = 'conv_' + crypto.randomUUID();
        db.prepare(`
          INSERT INTO conversations (id, participant1_id, participant2_id, startup_id, last_message_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).run(conversationId, authUser.id, recipientId, startupId || null);
        conv = { id: conversationId };
      } else {
        conversationId = conv.id;
      }
    }

    const messageId = 'msg_' + crypto.randomUUID();

    db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_id, recipient_id, content, attachment_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      messageId,
      conversationId,
      authUser.id,
      recipientId,
      content.trim(),
      attachmentUrl || null
    );

    // Update conversation timestamp
    db.prepare("UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?").run(conversationId);

    // Create notification for recipient
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'notif_' + crypto.randomUUID(),
      recipientId,
      `New Message from ${authUser.full_name}`,
      content.trim().length > 60 ? content.trim().substring(0, 60) + '...' : content.trim(),
      'message',
      conversationId
    );

    const createdMsg = db.prepare(`
      SELECT m.*, u.full_name as sender_name, u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(messageId);

    sendJson(res, 201, {
      success: true,
      message: 'Message delivered securely',
      conversationId,
      data: createdMsg
    });
  } catch (err) {
    sendError(res, 500, 'Failed to send message: ' + err.message);
  }
}

module.exports = {
  handleGetConversations,
  handleGetThreadMessages,
  handleSendMessage
};
