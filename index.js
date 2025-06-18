const { Web3 } = require('web3');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Loglama fonksiyonu (hata ayıklama için)
const log = (message, error = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[INFO] ${timestamp} - ${message}`);
  if (error) console.error(`[ERROR] ${timestamp} - ${error.message || error}`);
};

// Environment değişkenleri kontrolü
const requiredEnvVars = ['TELEGRAM_API_KEY', 'CHAT_ID', 'BSC_NODE_URL', 'CONTRACT_ADDRESS'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    log(`HATA: ${envVar} environment değişkeni tanımlı değil!`);
    process.exit(1);
  }
}

// Telegram Bot başlatma
const bot = new TelegramBot(process.env.TELEGRAM_API_KEY, { polling: false });

// Web3 ve BSC bağlantısı
const web3 = new Web3(process.env.BSC_NODE_URL);

// Kontrat ABI ve adres
const contractABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "buyer", "type": "address" },
      { "indexed": false, "name": "bnbAmount", "type": "uint256" },
      { "indexed": false, "name": "tokenAmount", "type": "uint256" },
      { "indexed": false, "name": "timestamp", "type": "uint256" }
    ],
    "name": "TokensPurchased",
    "type": "event"
  }
];
const contract = new web3.eth.Contract(contractABI, process.env.CONTRACT_ADDRESS);

// Event dinleme
contract.events.TokensPurchased({})
  .on('data', async (event) => {
    const buyer = event.returnValues.buyer;
    const bnbAmount = web3.utils.fromWei(event.returnValues.bnbAmount, 'ether');
    const tokenAmount = web3.utils.fromWei(event.returnValues.tokenAmount, 'ether');
    const timestamp = new Date(event.returnValues.timestamp * 1000).toLocaleString();

    const message = `
🚀 **Yeni Presale Satın Alma!**
👤 Alıcı: \`${buyer}\`  
💰 BNB: **${bnbAmount}**  
🎟️ Token: **${tokenAmount}**  
⏰ Tarih: ${timestamp}
    `;

    try {
      await bot.sendMessage(process.env.CHAT_ID, message, { parse_mode: 'Markdown' });
      log('Telegram bildirimi gönderildi: ' + message);
    } catch (err) {
      log('Telegram gönderim hatası:', err);
    }
  })
  .on('error', (error) => {
    log('Event dinleme hatası:', error);
  });

// Başlangıç kontrolü
log(`Bot başlatıldı. Kontrat dinleniyor: ${process.env.CONTRACT_ADDRESS}`);
console.log('BSC Node: ', process.env.BSC_NODE_URL);
console.log('Chat ID: ', process.env.CHAT_ID);
