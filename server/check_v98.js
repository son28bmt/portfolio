const { sequelize } = require('./src/config/db');
const Setting = require('./src/models/Setting');
const axios = require('axios');

async function run() {
  try {
    await sequelize.authenticate();
    const apiKeySetting = await Setting.findOne({ where: { key: 'ai_apiKey' } });
    if (!apiKeySetting || !apiKeySetting.value) {
      console.log('No API key found in DB');
      process.exit(0);
    }
    const apiKey = apiKeySetting.value;

    const { data } = await axios.get('https://v98store.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    const models = data.data.map(m => m.id);
    const audio = models.filter(m => m.toLowerCase().includes('whisper') || m.toLowerCase().includes('audio') || m.toLowerCase().includes('stt') || m.toLowerCase().includes('transcribe'));
    console.log('Audio Models:', audio);
    console.log('Total Models:', models.length);
    console.log('Sample Models:', models.slice(0, 10));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

run();
