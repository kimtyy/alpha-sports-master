const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI('AIzaSyD-uZW07MXhWkhHt0JNgUj68FFpClgNqLc');
async function run() {
  const models = ['gemini-2.0-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent('Hello');
      console.log(m + ' SUCCESS');
      return; // Stop on first success
    } catch (e) {
      console.error(m + ' FAILED:', e.message);
    }
  }
}
run();
