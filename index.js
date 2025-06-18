const { Web3 } = require('web3');
const TelegramBot = require('node-telegram-bot-api');

// SABIT DEGERLER (DÜZELTİLMİŞ RPC URL)
const CONFIG = {
  TELEGRAM_API_KEY: "7786040626:AAGYSMfTy7xbZ_x6uyNOOBi-e7PUsMJ-28Y",
  CHAT_ID: "1616739367",
  BSC_NODE_URL: "https://rpc.ankr.com/bsc", // DÜZELTİLDİ
  CONTRACT_ADDRESS: "0x42395Db998595DC7256aF2a6f10DC7b2E6006993"
};

// Loglama fonksiyonu
const log = (message, error = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (error) console.error(`[ERROR] ${error.stack || error}`);
};

// Telegram Bot (POLLING AKTİF)
const bot = new TelegramBot(CONFIG.TELEGRAM_API_KEY, {
  polling: true, // POLLING MODU AKTİF
  filepath: false
});

// Web3 bağlantısı (timeout ile)
const web3 = new Web3(
  new Web3.providers.HttpProvider(CONFIG.BSC_NODE_URL, {
    timeout: 30000,
    headers: [{ name: 'Content-Type', value: 'application/json' }]
  })
);

// Kontrat ayarları
const contractABI = [{
  "anonymous": false,
  "inputs": [
    {"indexed": true, "name": "buyer", "type": "address"},
    {"indexed": false, "name": "bnbAmount", "type": "uint256"},
    {"indexed": false, "name": "tokenAmount", "type": "uint256"},
    {"indexed": false, "name": "timestamp", "type": "uint256"}
  ],
  "name": "TokensPurchased",
  "type": "event"
}];

const contract = new web3.eth.Contract(contractABI, CONFIG.CONTRACT_ADDRESS);

// Bağlantı testi
async function checkConnection() {
  try {
    const block = await web3.eth.getBlockNumber();
    log(`BSC bağlantısı başarılı. Son blok: ${block}`);
    return true;
  } catch (error) {
    log("BSC bağlantı hatası", error);
    return false;
  }
}

// Event dinleme
async function startEventListening() {
  const isConnected = await checkConnection();
  if (!isConnected) {
    setTimeout(startEventListening, 10000);
    return;
  }

  contract.events.TokensPurchased()
    .on('data', event => {
      const bnbAmount = web3.utils.fromWei(event.returnValues.bnbAmount, 'ether');
      const message = `🚀 Yeni Satın Alma!\n👤 ${event.returnValues.buyer}\n💰 ${bnbAmount} BNB`;
      bot.sendMessage(CONFIG.CHAT_ID, message);
      log(message);
    })
    .on('error', err => {
      log("Event dinleme hatası", err);
      setTimeout(startEventListening, 5000);
    });
}

// Bot komutları
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🤖 Presale Bot Aktif!\n\nBSC bağlantısı: " + CONFIG.BSC_NODE_URL);
});

bot.onText(/\/check/, async (msg) => {
  const isConnected = await checkConnection();
  bot.sendMessage(msg.chat.id, isConnected ? "✅ BSC bağlantısı aktif" : "❌ BSC bağlantı hatası");
});

// Uygulamayı başlat
startEventListening();

// Hata yakalayıcılar
process.on('unhandledRejection', error => log('İşlenmemiş hata:', error));
process.on('uncaughtException', error => log('Yakalanmamış hata:', error));

log("🤖 Bot başlatıldı. BSC dinleme aktif...");
