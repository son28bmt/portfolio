const { sequelize } = require('../src/config/db');
const Project = require('../src/models/Project');

async function migrate() {
  try {
    console.log('--- Bắt đầu cập nhật cấu trúc Database ---');
    await sequelize.authenticate();
    console.log('✅ Đã kết nối MySQL.');

    // Đồng bộ hóa Model Project (thêm các cột thiếu)
    await Project.sync({ alter: true });
    console.log('✅ Đã cập nhật bảng Projects (thêm cột apkDownloadCount, iosDownloadCount).');

    console.log('--- Hoàn tất thành công ---');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi cập nhật:', error);
    process.exit(1);
  }
}

migrate();
