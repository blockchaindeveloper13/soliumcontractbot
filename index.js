const { Web3 } = require('web3');
const TelegramBot = require('node-telegram-bot-api');

// SABIT DEGERLER
const CONFIG = {
  TELEGRAM_API_KEY: "7786040626:AAGYSMfTy7xbZ_x6uyNOOBi-e7PUsMJ-28Y",
  CHAT_ID: "1616739367",
  BSC_NODE_URL: "https://bsc-dataseed.binance.org/", // Ana URL
  FALLBACK_NODE_URL: "https://rpc.ankr.com/bsc", // Yedek URL
  CONTRACT_ADDRESS: "0x42395Db998595DC7256aF2a6f10DC7b2E6006993"
};

// Loglama fonksiyonu
const log = (message, error = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (error) console.error(`[ERROR] ${error.stack || error}`);
};

// Telegram Bot
const bot = new TelegramBot(CONFIG.TELEGRAM_API_KEY, { polling: false });

// Web3 ve Kontrat Ayarları
const web3 = new Web3(CONFIG.BSC_NODE_URL);
const contractABI = [
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
];

let contract = new web3.eth.Contract(contractABI, CONFIG.CONTRACT_ADDRESS);

// Bağlantıyı Test Et
async function checkConnection() {
  try {
    const block = await web3.eth.getBlockNumber();
    log(`✅ BSC bağlantısı başarılı. Son blok: ${block}`);
    return true;
  } catch (error) {
    log(`❌ Ana RPC bağlantı hatası: ${error.message}`);
    
    // Yedek RPC'ye geç
    try {
      web3.setProvider(CONFIG.FALLBACK_NODE_URL);
      const fallbackBlock = await web3.eth.getBlockNumber();
      log(`✅ Yedek RPC bağlantısı başarılı. Son blok: ${fallbackBlock}`);
      contract = new web3.eth.Contract(contractABI, CONFIG.CONTRACT_ADDRESS);
      return true;
    } catch (fallbackError) {
      log(`❌ Yedek RPC bağlantı hatası: ${fallbackError.message}`);
      return false;
    }
  }
}

// Event Dinleme
function startEventListening() {
  contract.events.TokensPurchased({
    fromBlock: 'latest'
  })
  .on('data', event => {
    try {
      const bnbAmount = web3.utils.fromWei(event.returnValues.bnbAmount, 'ether');
      const message = `🚀 Yeni Satın Alma!\n👤 ${event.returnValues.buyer}\n💰 ${bnbAmount} BNB`;
      bot.sendMessage(CONFIG.CHAT_ID, message);
      log(`Bildirim gönderildi: ${message}`);
    } catch (sendError) {
      log("Bildirim gönderme hatası", sendError);
    }
  })
  .on('error', error => {
    log("Event dinleme hatası", error);
    setTimeout(initializeBot, 5000);
  });
}

// Botu Başlat
async function initializeBot() {
  try {
    const isConnected = await checkConnection();
    if (isConnected) {
      log(`👂 Dinleme başlatılıyor: ${CONFIG.CONTRACT_ADDRESS}`);
      startEventListening();
    } else {
      log("⏳ Bağlantı kurulamadı. 10 saniye sonra tekrar denenecek...");
      setTimeout(initializeBot, 10000);
    }
  } catch (error) {
    log("Bot başlatma hatası", error);
    setTimeout(initializeBot, 10000);
  }
}

// Uygulamayı Başlat
initializeBot();

// Hata Yakalayıcılar
process.on('unhandledRejection', error => log('⛔ İşlenmemiş hata:', error));
process.on('uncaughtException', error => log('⛔ Yakalanmamış hata:', error));
