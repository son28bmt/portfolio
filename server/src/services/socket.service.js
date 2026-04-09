const { LiveChatMessage } = require('../models');
const { sequelize } = require('../config/db');

let io = null;

const initSocket = (server, corsOptions) => {
  const { Server } = require('socket.io');
  io = new Server(server, { cors: corsOptions });

  io.on('connection', (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    // --- ADMIN LOGIC ---
    socket.on('join_admin_room', async () => {
      console.log(`[Socket] Socket ${socket.id} joining admin_room`);
      socket.join('admin_room');
      socket.isAdmin = true;
      io.emit('admin_status', { online: true });

      // Gửi danh sách các phiên chat hiện có cho admin mới vào
      try {
        console.log(`[Socket] Admin joined. Fetching sessions...`);
        const sessions = await LiveChatMessage.findAll({
          attributes: [
            'guestId', 
            [sequelize.fn('MAX', sequelize.col('name')), 'name'],
            [sequelize.fn('MAX', sequelize.col('email')), 'email'],
            [sequelize.fn('MAX', sequelize.col('createdAt')), 'lastMessageAt'],
            [sequelize.fn('COUNT', sequelize.literal("CASE WHEN isRead = false AND role = 'user' THEN 1 END")), 'unreadCount']
          ],
          group: ['guestId'],
          order: [[sequelize.literal('lastMessageAt'), 'DESC']]
        });
        console.log(`[Socket] Found ${sessions.length} sessions`);
        socket.emit('init_sessions', sessions);
      } catch (err) {
        console.error('[Socket] Error fetching sessions:', err);
      }
    });

    // --- USER LOGIC ---
    socket.on('join_chat', (data) => {
      const { guestId } = data;
      if (guestId) {
        console.log(`[Socket] Guest ${guestId} joined room_${guestId}`);
        socket.join(`room_${guestId}`);
        socket.guestId = guestId;
        
        const adminRoom = io.sockets.adapter.rooms.get('admin_room');
        const isAdminOnline = adminRoom && adminRoom.size > 0;
        socket.emit('admin_status', { online: !!isAdminOnline });
      }
    });

    // --- MESSAGING ---
    socket.on('send_to_admin', async (data) => {
      const { guestId, text, name, email } = data;
      console.log(`[Socket] Incoming message from Guest ${guestId}: "${text}"`);
      
      try {
        // Lưu tin nhắn vào DB
        const newMessage = await LiveChatMessage.create({
          guestId,
          role: 'user',
          content: text,
          name,
          email
        });
        console.log(`[Socket] Message saved to DB with ID: ${newMessage.id}`);

        // Lấy số lượng Admin thực tế đang ở trong phòng
        const adminRoom = io.sockets.adapter.rooms.get('admin_room');
        const adminCount = adminRoom ? adminRoom.size : 0;
        console.log(`[Socket] Emitting new_user_message to ${adminCount} admin(s) in room`);

        // Gửi tới toàn bộ Admin đang online
        io.to('admin_room').emit('new_user_message', {
          id: newMessage.id,
          guestId,
          text,
          name,
          email,
          timestamp: newMessage.createdAt
        });
      } catch (err) {
        console.error('[Socket] Error saving/sending user message:', err);
      }
    });

    socket.on('send_to_user', async (data) => {
      const { guestId, text } = data;
      console.log(`[Socket] Admin sending to Guest ${guestId}: "${text}"`);
      
      try {
        // Lưu tin nhắn admin vào DB
        const newMessage = await LiveChatMessage.create({
          guestId,
          role: 'admin',
          content: text,
          isRead: true 
        });

        io.to(`room_${guestId}`).emit('receive_admin_message', {
          text,
          timestamp: newMessage.createdAt
        });
        console.log(`[Socket] Admin message emitted to Guest room`);
      } catch (err) {
        console.error('[Socket] Error saving/sending admin message:', err);
      }
    });

    // Sự kiện đánh dấu tin nhắn là đã đọc
    socket.on('mark_as_read', async ({ guestId }) => {
      try {
        await LiveChatMessage.update(
          { isRead: true },
          { where: { guestId, role: 'user', isRead: false } }
        );
      } catch (err) {
        console.error('[Socket] Error marking messages as read:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      if (socket.isAdmin) {
        const adminRoom = io.sockets.adapter.rooms.get('admin_room');
        const isAdminOnline = adminRoom && adminRoom.size > 0;
        if (!isAdminOnline) {
          io.emit('admin_status', { online: false });
        }
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io chưa được khởi tạo');
  }
  return io;
};

const notifyAdmin = (event, data = {}) => {
  if (io) {
    io.to('admin_room').emit(event, data);
  }
};

module.exports = {
  initSocket,
  getIO,
  notifyAdmin,
};
