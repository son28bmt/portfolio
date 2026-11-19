const { sendSupportReplyNoticeEmail } = require('./email.service');

const DEBOUNCE_MS = 12 * 60 * 1000;
const pendingByConversation = new Map();

const queueSupportReplyNotice = ({ guestId, to, guideSlug = '' } = {}) => {
  const email = String(to || '').trim().toLowerCase();
  if (!guestId || !email) return;

  const previous = pendingByConversation.get(guestId);
  if (previous) clearTimeout(previous.timer);

  const timer = setTimeout(async () => {
    pendingByConversation.delete(guestId);
    try {
      await sendSupportReplyNoticeEmail({ to: email, guestId, guideSlug });
    } catch (error) {
      console.error('[Support email] Could not send reply notice:', error?.message || error);
    }
  }, DEBOUNCE_MS);

  pendingByConversation.set(guestId, { timer, email, guideSlug });
};

module.exports = { queueSupportReplyNotice };