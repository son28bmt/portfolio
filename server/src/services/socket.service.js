const { LiveChatMessage, Admin } = require("../models");
const { sequelize } = require("../config/db");
const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../utils/jwt.util");
const { User } = require("../models");
const { getConversationSnapshot } = require("./chat-purchase.service");

let io = null;

const signGuestChatToken = (guestId) => {
  return jwt.sign(
    { guestId, scope: "guest_chat" },
    getJwtSecret(),
    { expiresIn: process.env.GUEST_CHAT_TOKEN_EXPIRES || "30d" },
  );
};

const verifyAdminSocketToken = async (rawToken) => {
  const token = String(rawToken || "").trim();
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (!decoded?.adminId) return null;

    const admin = await Admin.findByPk(decoded.adminId);
    if (!admin || !['owner', 'support'].includes(admin.role || 'owner')) return null;
    return admin;
  } catch {
    return null;
  }
};

const resolveChatUser = async (rawToken) => {
  try {
    const decoded = jwt.verify(String(rawToken || '').trim(), getJwtSecret());
    return decoded?.id ? User.findByPk(decoded.id, { attributes: ['id'] }) : null;
  } catch { return null; }
};

const initSocket = (server, corsOptions) => {
  const { Server } = require("socket.io");
  io = new Server(server, { cors: corsOptions });

  io.on("connection", (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    // Admin phải gửi token hợp lệ để vào admin room.
    socket.on("join_admin_room", async (payload = {}) => {
      const adminToken = String(payload?.token || "").trim();
      const admin = await verifyAdminSocketToken(adminToken);

      if (!admin) {
        socket.emit("admin_auth_error", {
          message: "Token admin không hợp lệ hoặc đã hết hạn.",
        });
        return;
      }

      socket.join("admin_room");
      socket.isAdmin = true;
      socket.adminId = admin.id;
      socket.adminRole = admin.role || 'owner';
      io.emit("admin_status", { online: true });

      try {
        const sessions = await LiveChatMessage.findAll({
          attributes: [
            "guestId",
            [sequelize.fn("MAX", sequelize.col("name")), "name"],
            [sequelize.fn("MAX", sequelize.col("email")), "email"],
            [sequelize.fn("MAX", sequelize.col("createdAt")), "lastMessageAt"],
            [
              sequelize.fn(
                "COUNT",
                sequelize.literal(
                  "CASE WHEN isRead = false AND role = 'user' THEN 1 END",
                ),
              ),
              "unreadCount",
            ],
          ],
          group: ["guestId"],
          order: [[sequelize.literal("lastMessageAt"), "DESC"]],
        });
        const enriched = await Promise.all(sessions.map(async session => {
          const lastMessage = await LiveChatMessage.findOne({
            where: { guestId: session.guestId }, order: [['createdAt', 'DESC']],
          });
          return {
            ...session.toJSON(),
            purchase: await getConversationSnapshot(session.guestId),
            lastMessageType: lastMessage?.messageType || 'text',
            guideContext: lastMessage?.guideContext || null,
            questionSnapshot: lastMessage?.questionSnapshot || null,
          };
        }));
        socket.emit("init_sessions", enriched);
      } catch (err) {
        console.error("[Socket] Error fetching sessions:", err);
      }
    });

    socket.on("join_chat", async (data) => {
      const { guestId, userToken } = data || {};
      if (!guestId) return;

      socket.join(`room_${guestId}`);
      const user = await resolveChatUser(userToken);
      socket.userId = user?.id || null;

      try {
        const guestToken = signGuestChatToken(guestId);
        socket.emit("guest_session_token", { token: guestToken, guestId });
      } catch (tokenError) {
        console.error("[Socket] Error issuing guest chat token:", tokenError);
      }

      const adminRoom = io.sockets.adapter.rooms.get("admin_room");
      const isAdminOnline = adminRoom && adminRoom.size > 0;
      socket.emit("admin_status", { online: Boolean(isAdminOnline) });
    });

    socket.on("send_to_admin", async (data) => {
      const { guestId, text, name, email } = data || {};
      if (!guestId || !String(text || "").trim()) return;

      try {
        const newMessage = await LiveChatMessage.create({
          guestId,
          userId: socket.userId || null,
          role: "user",
          content: text,
          name,
          email,
        });
        const purchase = await getConversationSnapshot(guestId);

        io.to("admin_room").emit("new_user_message", {
          id: newMessage.id,
          guestId,
          text,
          name,
          email,
          purchase,
          guideContext: newMessage.guideContext || null,
          questionSnapshot: newMessage.questionSnapshot || null,
          timestamp: newMessage.createdAt,
        });
      } catch (err) {
        console.error("[Socket] Error saving/sending user message:", err);
      }
    });

    socket.on("send_to_user", async (data) => {
      if (!socket.isAdmin) {
        socket.emit("admin_auth_error", {
          message: "Bạn chưa xác thực quyền admin.",
        });
        return;
      }

      const { guestId, text } = data || {};
      if (!guestId || !String(text || "").trim()) return;

      try {
        const newMessage = await LiveChatMessage.create({
          guestId,
          role: "admin",
          content: text,
          isRead: true,
        });

        io.to(`room_${guestId}`).emit("receive_admin_message", {
          text,
          timestamp: newMessage.createdAt,
        });
      } catch (err) {
        console.error("[Socket] Error saving/sending admin message:", err);
      }
    });

    socket.on("mark_as_read", async ({ guestId } = {}) => {
      if (!socket.isAdmin || !guestId) return;

      try {
        await LiveChatMessage.update(
          { isRead: true },
          { where: { guestId, role: "user", isRead: false } },
        );
      } catch (err) {
        console.error("[Socket] Error marking messages as read:", err);
      }
    });

    socket.on("disconnect", () => {
      if (socket.isAdmin) {
        const adminRoom = io.sockets.adapter.rooms.get("admin_room");
        const isAdminOnline = adminRoom && adminRoom.size > 0;
        if (!isAdminOnline) {
          io.emit("admin_status", { online: false });
        }
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io chưa được khởi tạo");
  }
  return io;
};

const notifyAdmin = (event, data = {}) => {
  if (io) {
    io.to("admin_room").emit(event, data);
  }
};

module.exports = {
  initSocket,
  getIO,
  notifyAdmin,
};
