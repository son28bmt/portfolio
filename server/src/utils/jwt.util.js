const getJwtSecret = () => {
  const secret = String(process.env.JWT_SECRET || '').trim();

  if (!secret || secret === 'secret') {
    throw new Error(
      'JWT_SECRET chưa được cấu hình an toàn. Hãy đặt JWT_SECRET mạnh trong biến môi trường.',
    );
  }

  return secret;
};

module.exports = {
  getJwtSecret,
};
