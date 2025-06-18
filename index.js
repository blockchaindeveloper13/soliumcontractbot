const { Web3 } = require('web3');
const TelegramBot = require('node-telegram-bot-api');

// SABIT DEGERLER
const CONFIG = {
  TELEGRAM_API_KEY: "7786040626:AAGYSMfTy7xbZ_x6uyNOOBi-e7PUsMJ-28Y",
  CHAT_ID: "1616739367",
  BSC_NODE_URL: "https://bsc-dataseed.binance.org/",
  CONTRACT_ADDRESS: "0x42395Db998595DC7256aF2a6f10DC7b2E6006993"
};

// Loglama fonksiyonu
const log = (message, error = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (error) console.error(`[ERROR] ${error.stack || error}`);
};

// Telegram Bot (Polling KAPALI)
const bot = new TelegramBot(CONFIG.TELEGRAM_API_KEY, { polling: false });

// Web3 bağlantısı
const web3 = new Web3(CONFIG.BSC_NODE_URL);

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
], CONFIG.CONTRACT_ADDRESS);

// Bağlantı testi
web3.eth.net.isListening()
  .then(() => {
    log("BSC bağlantısı başarılı");
    startEventListening();
  })
  .catch(err => {
    log("BSC bağlantı hatası", err);
    process.exit(1);
  });

function startEventListening() {
  contract.events.TokensPurchased()
    .on('data', event => {
      const message = `🚀 Yeni satın alma!\nAlıcı: ${event.returnValues.buyer}\nBNB: ${web3.utils.fromWei(event.returnValues.bnbAmount, 'ether')}`;
      bot.sendMessage(CONFIG.CHAT_ID, message);
      log(message);
    })
    .on('error', err => {
      log("Event dinleme hatası", err);
    });

  log(`Bot aktif! Kontrat dinleniyor: ${CONFIG.CONTRACT_ADDRESS}`);
}

// Hata yakalama
process.on('unhandledRejection', (err) => {
  log('İşlenmemiş hata:', err);
});

process.on('uncaughtException', (err) => {
  log('Yakalanmamış hata:', err);
});
