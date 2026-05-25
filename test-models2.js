const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI('AIzaSyD-uZW07MXhWkhHt0JNgUj68FFpClgNqLc');
async function run() {
  try {
    console.log('Testing gemini-1.5-flash with v1...');
    const model1 = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }, { apiVersion: 'v1' });
    const result1 = await model1.generateContent('Hello');
    console.log('1.5-flash success!');
  } catch (e) {
    console.error('1.5-flash failed:', e.message);
  }
}
run();
