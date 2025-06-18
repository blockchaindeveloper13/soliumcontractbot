const { Web3 } = require('web3');
const TelegramBot = require('node-telegram-bot-api');

// 1. AYARLAR
const CONFIG = {
  TELEGRAM_API_KEY: "7786040626:AAGYSMfTy7xbZ_x6uyNOOBi-e7PUsMJ-28Y",
  CHAT_ID: "1616739367",
  BSC_NODE_URL: "https://bsc-dataseed.binance.org/", 
  CONTRACT_ADDRESS: "0x42395Db998595DC7256aF2a6f10DC7b2E6006993"
};

// 2. LOGLAMA
function log(message, error = null) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (error) console.error(`[ERROR] ${error.message}`);
}

// 3. TELEGRAM BOT (POLLING AKTİF)
const bot = new TelegramBot(CONFIG.TELEGRAM_API_KEY, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

// 4. WEB3 BAĞLANTISI
const web3 = new Web3(CONFIG.BSC_NODE_URL);

// 5. KONTROL MEKANİZMASI
async function checkConnection() {
  try {
    const block = await web3.eth.getBlockNumber();
    log(`✅ BSC bağlantısı başarılı. Son blok: ${block}`);
    return true;
  } catch (error) {
    log(`❌ BSC bağlantı hatası: ${error.message}`);
    return false;
  }
}

// 6. EVENT DİNLEME
async function startEventListener() {
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

  contract.events.TokensPurchased()
    .on('data', event => {
      const bnbAmount = web3.utils.fromWei(event.returnValues.bnbAmount, 'ether');
      const message = `🚀 Yeni Satın Alma!\n👤 ${event.returnValues.buyer}\n💰 ${bnbAmount} BNB`;
      bot.sendMessage(CONFIG.CHAT_ID, message);
      log(`Bildirim gönderildi: ${message}`);
    })
    .on('error', err => {
      log("Event dinleme hatası", err);
      setTimeout(startEventListener, 5000);
    });
}

// 7. BAŞLANGIÇ
async function initialize() {
  const isConnected = await checkConnection();
  if (isConnected) {
    startEventListener();
    log(`🤖 Bot başlatıldı. Kontrat dinleniyor: ${CONFIG.CONTRACT_ADDRESS}`);
  } else {
    setTimeout(initialize, 10000);
  }
}

// 8. KOMUTLAR
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🤖 Presale Bot Aktif!");
});

bot.onText(/\/check/, async (msg) => {
  const isConnected = await checkConnection();
  bot.sendMessage(msg.chat.id, isConnected ? "✅ BSC bağlantısı aktif" : "❌ BSC bağlantı hatası");
});

// 9. UYGULAMAYI BAŞLAT
initialize();

// 10. HATA YAKALAYICILAR
process.on('unhandledRejection', error => log('⛔ İşlenmemiş hata:', error));
process.on('uncaughtException', error => log('⛔ Yakalanmamış hata:', error));
