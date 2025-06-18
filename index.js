const { Web3 } = require('web3');
const TelegramBot = require('node-telegram-bot-api');

// SABIT DEGERLER (Alternatif RPC URL'ler)
const CONFIG = {
  TELEGRAM_API_KEY: "7786040626:AAGYSMfTy7xbZ_x6uyNOOBi-e7PUsMJ-28Y",
  CHAT_ID: "1616739367",
  BSC_NODE_URLS: [
    "https://bsc-dataseed.binance.org/",
    "https://bsc-dataseed1.defibit.io/",
    "https://rpc.ankr.com/bsc"
  ],
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

// Web3 bağlantısı (alternatif URL'lerle)
let currentRpcIndex = 0;
let web3;

async function initializeWeb3() {
  for (let i = 0; i < CONFIG.BSC_NODE_URLS.length; i++) {
    try {
      const provider = new Web3.providers.HttpProvider(CONFIG.BSC_NODE_URLS[i], {
        timeout: 30000,
        headers: [{ name: 'Content-Type', value: 'application/json' }]
      });
      
      web3 = new Web3(provider);
      
      const block = await web3.eth.getBlockNumber();
      currentRpcIndex = i;
      log(`Bağlantı başarılı: ${CONFIG.BSC_NODE_URLS[i]}, Son blok: ${block}`);
      return true;
    } catch (error) {
      log(`RPC bağlantı hatası (${CONFIG.BSC_NODE_URLS[i]}):`, error);
    }
  }
  return false;
}

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

let contract;

// Event dinleme
async function startEventListening() {
  const isConnected = await initializeWeb3();
  if (!isConnected) {
    log("Tüm RPC bağlantıları başarısız. 10 saniye sonra tekrar denenecek...");
    setTimeout(startEventListening, 10000);
    return;
  }

  contract = new web3.eth.Contract(contractABI, CONFIG.CONTRACT_ADDRESS);

  contract.events.TokensPurchased()
    .on('data', event => {
      const bnbAmount = web3.utils.fromWei(event.returnValues.bnbAmount, 'ether');
      const message = `🚀 Yeni Satın Alma!\n👤 ${event.returnValues.buyer}\n💰 ${bnbAmount} BNB`;
      bot.sendMessage(CONFIG.CHAT_ID, message);
      log(message);
    })
    .on('changed', event => log("Event changed:", event))
    .on('error', err => {
      log("Event dinleme hatası", err);
      setTimeout(startEventListening, 5000);
    });
}

// Uygulamayı başlat
startEventListening();

// Her 5 dakikada bir bağlantıyı kontrol et
setInterval(async () => {
  try {
    await web3.eth.getBlockNumber();
  } catch (error) {
    log("Bağlantı kontrol hatası", error);
    startEventListening();
  }
}, 300000);

// Hata yakalayıcılar
process.on('unhandledRejection', error => log('İşlenmemiş hata:', error));
process.on('uncaughtException', error => log('Yakalanmamış hata:', error));
