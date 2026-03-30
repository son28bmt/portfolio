require('dotenv').config();
const { sequelize, connectDB } = require('./config/db');
const { Admin } = require('./models');

const run = async () => {
  try {
    await connectDB();
    await sequelize.sync();

    const username = process.env.MARKET_ADMIN_USER || 'admin';
    const password = process.env.MARKET_ADMIN_PASS || 'admin123';

    const existed = await Admin.findOne({ where: { username } });
    if (existed) {
      console.log(`Admin "${username}" đã tồn tại.`);
      process.exit(0);
    }

    await Admin.create({ username, password });
    console.log('Tạo admin marketplace thành công.');
    console.log(`Tài khoản: ${username}`);
    console.log(`Mật khẩu: ${password}`);
    process.exit(0);
  } catch (error) {
    console.error('Không thể seed admin marketplace:', error.message);
    process.exit(1);
  }
};

run();
