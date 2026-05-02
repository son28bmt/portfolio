const { Admin } = require('./src/models');
const { getJwtSecret } = require('./src/utils/jwt.util');
const jwt = require('jsonwebtoken');
require('dotenv').config({ override: true });

async function getToken() {
  try {
    const admin = await Admin.findOne({ where: { username: 'admin' } });
    const token = jwt.sign({ adminId: admin.id, username: admin.username }, getJwtSecret(), { expiresIn: '1d' });
    console.log(token);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
getToken();
