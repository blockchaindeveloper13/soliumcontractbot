const { Web3 } = require('web3');
const TelegramBot = require('node-telegram-bot-api');

// SABIT DEGERLER (Ankr RPC ile güncellendi)
const CONFIG = {
  TELEGRAM_API_KEY: "7786040626:AAGYSMfTy7xbZ_x6uyNOOBi-e7PUsMJ-28Y",
  CHAT_ID: "1616739367",
  BSC_NODE_URL: "https://rpc.ankr.com/bsc", // ANKR RPC kullanılıyor
  CONTRACT_ADDRESS: "0x42395Db998595DC7256aF2a6f10DC7b2E6006993"
};

// Loglama fonksiyonu (geliştirilmiş)
const log = (message, error = null) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  if (error) {
    console.error(`[ERROR] ${error.stack || error}`);
    // Hataları Telegram'a da gönder
    try {
      bot.sendMessage(CONFIG.CHAT_ID, `⚠️ Hata: ${error.message || error}`);
    } catch (e) {
      console.error('Telegram hatası:', e);
    }
  }
};

// Telegram Bot
const bot = new TelegramBot(CONFIG.TELEGRAM_API_KEY, { polling: false });

// Web3 bağlantısı (timeout ile)
const web3 = new Web3(
  new Web3.providers.HttpProvider(CONFIG.BSC_NODE_URL, {
    timeout: 30000 // 30 saniye timeout
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

// Bağlantıyı test et
async function checkConnection() {
  try {
    const isListening = await web3.eth.net.isListening();
    if (!isListening) throw new Error('RPC bağlantısı kurulamadı');
    log(`BSC bağlantısı başarılı (Ankr RPC)`);
    return true;
  } catch (error) {
    log("BSC bağlantı hatası", error);
    return false;
  }
}

// Event dinleme
async function startEventListening() {
  try {
    const connectionOK = await checkConnection();
    if (!connectionOK) {
      setTimeout(startEventListening, 10000); // 10 sn sonra tekrar dene
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
        setTimeout(startEventListening, 5000); // 5 sn sonra yeniden başlat
      });

    log(`Dinleme başladı: ${CONFIG.CONTRACT_ADDRESS}`);
  } catch (error) {
    log("Dinleme başlatma hatası", error);
    setTimeout(startEventListening, 10000); // 10 sn sonra tekrar dene
  }
}

// Hata yakalayıcılar
process.on('unhandledRejection', error => {
  log('İşlenmemiş hata (rejection):', error);
});

process.on('uncaughtException', error => {
  log('Yakalanmamış hata (exception):', error);
});

// Uygulamayı başlat
startEventListening();

// Her 5 dakikada bir bağlantıyı kontrol et
setInterval(checkConnection, 300000);
