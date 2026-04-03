let io = null;

const initSocket = (server, corsOptions) => {
  const { Server } = require('socket.io');
  io = new Server(server, { cors: corsOptions });

  io.on('connection', (socket) => {
    // console.log(`[Socket] New connection: ${socket.id}`);

    // --- ADMIN LOGIC ---
    socket.on('join_admin_room', (data) => {
      socket.join('admin_room');
      socket.isAdmin = true;
      // Thông báo cho tất cả người dùng là Admin đã Online
      io.emit('admin_status', { online: true });
      // console.log(`[Socket] Admin joined: ${socket.id}`);
    });

    // --- USER LOGIC ---
    socket.on('join_chat', (data) => {
      const { guestId } = data;
      if (guestId) {
        socket.join(`room_${guestId}`);
        socket.guestId = guestId;
        // console.log(`[Socket] Guest ${guestId} joined room_${guestId}`);
        
        // Kiểm tra xem có admin nào đang online không
        const adminRoom = io.sockets.adapter.rooms.get('admin_room');
        const isAdminOnline = adminRoom && adminRoom.size > 0;
        socket.emit('admin_status', { online: !!isAdminOnline });
      }
    });

    // --- MESSAGING ---
    // Khách gửi cho Admin
    socket.on('send_to_admin', (data) => {
      const { guestId, text, name, email } = data;
      // Gửi tới toàn bộ Admin đang online
      io.to('admin_room').emit('new_user_message', {
        socketId: socket.id,
        guestId,
        text,
        name,
        email,
        timestamp: new Date()
      });
    });

    // Admin gửi cho Khách
    socket.on('send_to_user', (data) => {
      const { guestId, text } = data;
      // Gửi tới phòng riêng của khách đó
      io.to(`room_${guestId}`).emit('receive_admin_message', {
        text,
        timestamp: new Date()
      });
    });

    socket.on('disconnect', () => {
      if (socket.isAdmin) {
        // Kiểm tra xem còn admin nào khác không
        const adminRoom = io.sockets.adapter.rooms.get('admin_room');
        const isAdminOnline = adminRoom && adminRoom.size > 0;
        if (!isAdminOnline) {
          io.emit('admin_status', { online: false });
        }
      }
      // console.log(`[Socket] Disconnected: ${socket.id}`);
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
