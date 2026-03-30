let io = null;

const initSocket = (server, corsOptions) => {
  const { Server } = require('socket.io');
  io = new Server(server, { cors: corsOptions });

  io.on('connection', (socket) => {
    // Nhận tín hiệu tham gia phòng Admin (sau này truyền token trong 'data' để check role)
    socket.on('join_admin_room', (data) => {
      socket.join('admin_room');
      // console.log(`[Socket] Admin joined: ${socket.id}`);
    });

    socket.on('disconnect', () => {
      // Cleanup nếu cần thiết
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
    // Phát sóng tin nhắn (event) tới toàn bộ socket đang đăng ký admin_room
    io.to('admin_room').emit(event, data);
  }
};

module.exports = {
  initSocket,
  getIO,
  notifyAdmin,
};
