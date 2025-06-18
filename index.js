const { Web3 } = require('web3');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Loglama fonksiyonu
const log = (message, error = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (error) console.error(`[ERROR] ${error.stack || error}`);
};

// Environment kontrolü
const requiredEnvVars = ['TELEGRAM_API_KEY', 'CHAT_ID', 'BSC_NODE_URL', 'CONTRACT_ADDRESS'];
requiredEnvVars.forEach(env => {
  if (!process.env[env]) {
    log(`HATA: ${env} environment değişkeni tanımlı değil!`);
    process.exit(1);
  }
});

// Telegram Bot (POLLING MODUNDA)
const bot = new TelegramBot(process.env.TELEGRAM_API_KEY, {
  polling: true // Polling modu aktif
});

// Web3 bağlantısı
const web3 = new Web3(process.env.BSC_NODE_URL);

// Bağlantı testi
web3.eth.net.isListening()
  .then(() => log("BSC bağlantısı başarılı"))
  .catch(err => {
    log("BSC bağlantı hatası", err);
    process.exit(1);
  });

// Kontrat ayarları
const contract = new web3.eth.Contract([
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "buyer", "type": "address"},
      {"indexed": false, "name": "bnbAmount", "type": "uint256"},
      {"indexed": false, "name": "tokenAmount", "type": "uint256"},
      {"indexed": false, "name": "timestamp", "type": "uint256"}
    ],
    "name": "TokensPurchased",
    "type": "event"
  }
], process.env.CONTRACT_ADDRESS);

// Event dinleme
contract.events.TokensPurchased()
  .on('data', event => {
    const message = `Yeni satın alma: ${event.returnValues.buyer}`;
    bot.sendMessage(process.env.CHAT_ID, message);
    log(message);
  })
  .on('error', err => {
    log("Event dinleme hatası", err);
  });

// Bot komutları (polling için)
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Presale botu aktif!");
});

log("Bot başarıyla başlatıldı");
