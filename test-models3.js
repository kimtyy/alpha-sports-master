const { GoogleGenerativeAI } = require('@google/generative-ai');
async function run() {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyD-uZW07MXhWkhHt0JNgUj68FFpClgNqLc');
  const data = await res.json();
  console.log(data.models ? data.models.map(m => m.name).join('\n') : data);
}
run();
