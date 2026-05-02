const { Admin } = require('./src/models');
const { connectDB } = require('./src/config/db');
require('dotenv').config({ override: true });

async function createAdmin() {
  try {
    await connectDB();
    const username = 'admin';
    const password = 'password123';
    
    // Check if it already exists
    const existing = await Admin.findOne({ where: { username } });
    if (existing) {
      console.log('Tài khoản admin đã tồn tại. Đang cập nhật lại mật khẩu...');
      existing.password = password;
      await existing.save();
      console.log('Cập nhật mật khẩu thành công!');
    } else {
      const admin = await Admin.create({
        username,
        password
      });
      console.log('Tạo tài khoản admin thành công!');
    }
    
    console.log(`\n============================`);
    console.log(`Tài khoản: ${username}`);
    console.log(`Mật khẩu: ${password}`);
    console.log(`============================\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi tạo tài khoản admin:', error);
    process.exit(1);
  }
}

createAdmin();
