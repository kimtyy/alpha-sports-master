const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    // Some older SDKs might not expose listModels directly this way, but let's try the REST API using fetch
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    const models = data.models.map(m => m.name).filter(name => name.includes('gemini'));
    console.log("Available Gemini models:");
    console.log(models.join('\n'));
  } catch(e) {
    console.error(e);
  }
}
listModels();
