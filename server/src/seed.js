const User = require('./models/User');
const { connectDB, sequelize } = require('./config/db');

const seedAdmin = async () => {
  try {
    await connectDB();
    
    // Sync to ensure table exists
    await sequelize.sync({ alter: true });

    const username = 'admin';
    const password = 'admin123'; // Direct password, model hook will hash it

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      console.log('⚠️ Admin user already exists.');
    } else {
      await User.create({ username, password });
      console.log('✅ Admin user created successfully!');
      console.log('Username: admin');
      console.log('Password: admin123');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
