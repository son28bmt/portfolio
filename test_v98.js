const { Sequelize } = require('sequelize');
const axios = require('axios');

async function check() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'e:/portfolio/server/database.sqlite', // assuming this is the path
    logging: false
  });

  try {
    const [results] = await sequelize.query("SELECT * FROM Settings WHERE key IN ('ai_apiKey', 'ai_baseUrl')");
    let apiKey = '';
    let baseUrl = '';
    for (const r of results) {
      if (r.key === 'ai_apiKey') apiKey = r.value;
      if (r.key === 'ai_baseUrl') baseUrl = r.value;
    }

    if (!apiKey) {
      console.log('No API key found in DB');
      return;
    }

    const { data } = await axios.get('https://v98store.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    const models = data.data.map(m => m.id);
    const audio = models.filter(m => m.toLowerCase().includes('whisper') || m.toLowerCase().includes('audio'));
    console.log('Audio Models:', audio);
    console.log('Total Models:', models.length);
    console.log('All Models:', models.join(', '));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
