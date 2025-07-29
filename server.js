// require('dotenv').config();
// const express = require('express');
// const { Client, LocalAuth } = require('whatsapp-web.js');
// const qrcode = require('qrcode-terminal');
// const bodyParser = require('body-parser');

// const app = express();
// app.use(bodyParser.json());

// // 🟢 Use LocalAuth to persist session in `.wwebjs_auth`
// const client = new Client({
//   authStrategy: new LocalAuth(),
//   puppeteer: {
//     headless: true,
//     args: ['--no-sandbox', '--disable-setuid-sandbox'],
//   },
// });

// // QR code
// client.on('qr', (qr) => {
//   console.log('⚡ Scan the QR code to log in:');
//   qrcode.generate(qr, { small: true });
//  console.log(
//     `✅ OR open this link in your HTML: https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
//       qr
//     )}`
//   )
// });

// // Ready
// client.on('ready', () => {
//   console.log('✅ WhatsApp client is ready!');
// });

// client.initialize();

// // API: Send WhatsApp OTP
// app.post('/send-otp', async (req, res) => {
//   const { phone, code } = req.body;

//   if (!phone || !code) {
//     return res.status(400).send({ success: false, message: 'Phone and code required.' });
//   }

//   const formattedPhone = phone.replace('+', '') + '@c.us';

//   try {
//     await client.sendMessage(formattedPhone, `🔐 كود المصادقة هو: ${code}`);
//     console.log(`✅ Sent OTP to ${phone}`);
//     return res.send({ success: true, message: 'Message sent via WhatsApp.' });
//   } catch (err) {
//     console.error('❌ WhatsApp send error:', err);
//     return res.status(500).send({ success: false, message: 'Failed to send WhatsApp message.' });
//   }
// });

// // Health check
// app.get('/', (req, res) => {
//   res.send('✅ WhatsApp server is running!');
// });

// // Start server
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });
require('dotenv').config();
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

app.use(express.static('public'));

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

const sseClients = [];
let isAuthenticated = false;

client.on('qr', (qr) => {
  console.log('📡 QR generated');
  if (!isAuthenticated) {
    sseClients.forEach(res => {
      res.write(`data: ${JSON.stringify({ qr })}\n\n`);
    });
  } else {
    console.log('⚠️ Ignored QR because already authenticated');
  }
});

client.on('ready', () => {
  console.log('✅ WhatsApp client is ready!');
  isAuthenticated = true;
  sseClients.forEach(res => {
    res.write(`data: ${JSON.stringify({ status: 'ready' })}\n\n`);
  });
});

client.on('disconnected', (reason) => {
  console.log(`🔌 WhatsApp client disconnected: ${reason}`);
  isAuthenticated = false;
  sseClients.forEach(res => {
    res.write(`data: ${JSON.stringify({ status: 'disconnected' })}\n\n`);
  });
});

client.initialize();

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);

  req.on('close', () => {
    console.log('❌ SSE client closed connection');
    sseClients.splice(sseClients.indexOf(res), 1);
  });
});

app.get('/qr', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'qr.html'));
});
// // API: Send WhatsApp OTP
app.post('/send-otp', async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).send({ success: false, message: 'Phone and code required.' });
  }

  const formattedPhone = phone.replace('+', '') + '@c.us';

  try {
    await client.sendMessage(formattedPhone, `🔐 كود المصادقة هو: ${code}`);
    console.log(`✅ Sent OTP to ${phone}`);
    return res.send({ success: true, message: 'Message sent via WhatsApp.' });
  } catch (err) {
    console.error('❌ WhatsApp send error:', err);
    return res.status(500).send({ success: false, message: 'Failed to send WhatsApp message.' });
  }
});

app.get('/', (req, res) => {
  res.send('✅ WhatsApp SSE server running!');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
