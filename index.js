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

// Telegram Bot (POLLING KAPALI)
const bot = new TelegramBot(CONFIG.TELEGRAM_API_KEY, { polling: false });

// Web3 bağlantısı
const web3 = new Web3(CONFIG.BSC_NODE_URL);

// KONTROL: Web3 bağlantısını test et
web3.eth.getBlockNumber()
  .then(block => log(`✅ BSC bağlantısı başarılı. Son blok: ${block}`))
  .catch(err => log(`❌ BSC bağlantı hatası: ${err.message}`));

// Kontrat ABI (Sadece gerekli event tanımı)
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

// Kontrat instance'ı
const contract = new web3.eth.Contract(contractABI, CONFIG.CONTRACT_ADDRESS);

// EVENT DİNLEME (Yeni ve basit yöntem)
const subscription = web3.eth.subscribe('logs', {
  address: CONFIG.CONTRACT_ADDRESS,
  topics: [web3.utils.sha3('TokensPurchased(address,uint256,uint256,uint256)')]
}, (error, log) => {
  if (error) {
    log("Event dinleme hatası", error);
    return;
  }

  try {
    const event = web3.eth.abi.decodeLog(
      [
        {"type": "address", "name": "buyer", "indexed": true},
        {"type": "uint256", "name": "bnbAmount"},
        {"type": "uint256", "name": "tokenAmount"},
        {"type": "uint256", "name": "timestamp"}
      ],
      log.data,
      log.topics.slice(1)
    );

    const bnbAmount = web3.utils.fromWei(event.bnbAmount, 'ether');
    const message = `🚀 Yeni Satın Alma!\n👤 ${event.buyer}\n💰 ${bnbAmount} BNB`;
    bot.sendMessage(CONFIG.CHAT_ID, message);
    log(`Bildirim gönderildi: ${message}`);
  } catch (err) {
    log("Event decode hatası", err);
  }
});

subscription.on('error', err => {
  log("Subscription hatası", err);
  setTimeout(() => {
    subscription.subscribe();
  }, 5000);
});

log(`✅ Dinleme başladı: ${CONFIG.CONTRACT_ADDRESS}`);

// Hata yakalayıcılar
process.on('unhandledRejection', (error) => log('⛔ İşlenmemiş hata:', error));
process.on('uncaughtException', (error) => log('⛔ Yakalanmamış hata:', error));
