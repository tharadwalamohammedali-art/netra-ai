import {
  evaluateAndSendMessage,
  submitFalsePositiveAppeal,
  getUserSharedMessages
} from '../services/sharingGate.js';

export async function handleSendMessage({ db, user, body, clientIp }) {
  const { recipientEmail, content, confirmSend } = body || {};

  if (!recipientEmail || typeof recipientEmail !== 'string') {
    return { status: 400, data: { error: 'Recipient email address is required.' } };
  }

  if (!content || typeof content !== 'string') {
    return { status: 400, data: { error: 'Message content cannot be blank.' } };
  }

  const result = await evaluateAndSendMessage({
    db,
    senderId: user.userId,
    senderEmail: user.email,
    recipientEmail: recipientEmail.trim().toLowerCase(),
    content,
    confirmSend: Boolean(confirmSend),
    clientIp
  });

  if (result.status === 'blocked') {
    return { status: 403, data: result };
  }

  if (result.status === 'warning_required') {
    return { status: 422, data: result };
  }

  return { status: 200, data: result };
}

export function handleSubmitAppeal({ db, user, body }) {
  const { messageId, reason } = body || {};

  if (!messageId || !reason) {
    return { status: 400, data: { error: 'Message ID and appeal reason are required.' } };
  }

  try {
    const result = submitFalsePositiveAppeal({
      db,
      userId: user.userId,
      messageId,
      reason
    });
    return { status: 201, data: result };
  } catch (err) {
    return { status: 400, data: { error: err.message } };
  }
}

export function handleGetShareHistory({ db, user }) {
  const messages = getUserSharedMessages({ db, userId: user.userId });
  return { status: 200, data: { messages } };
}
