const { Web3 } = require('web3');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Loglama için yardımcı fonksiyon
const log = (message, error = null) => {
  console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
  if (error) console.error(`[ERROR] ${new Date().toISOString()} - ${error.stack || error}`);
};

// Environment değişkenlerini kontrol et
try {
  if (!process.env.TELEGRAM_API_KEY) throw new Error('TELEGRAM_API_KEY eksik');
  if (!process.env.CHAT_ID) throw new Error('CHAT_ID eksik');
  if (!process.env.BSC_NODE_URL) throw new Error('BSC_NODE_URL eksik');
  if (!process.env.CONTRACT_ADDRESS) throw new Error('CONTRACT_ADDRESS eksik');
  log('Environment değişkenleri yüklendi');
} catch (error) {
  log('Environment değişkeni hatası', error);
  process.exit(1);
}

// Telegram Bot
let bot;
try {
  bot = new TelegramBot(process.env.TELEGRAM_API_KEY, { polling: false });
  log('Telegram bot başlatıldı');
} catch (error) {
  log('Telegram bot başlatma hatası', error);
  process.exit(1);
}

// Web3 ve Sözleşme Ayarları
let web3;
try {
  web3 = new Web3(process.env.BSC_NODE_URL);
  log('Web3 başlatıldı');
} catch (error) {
  log('Web3 başlatma hatası', error);
  process.exit(1);
}

const contractAddress = process.env.CONTRACT_ADDRESS;
const contractABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "buyer", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "bnbAmount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "tokenAmount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "TokensPurchased",
    "type": "event"
  }
];

let contract;
try {
  contract = new web3.eth.Contract(contractABI, contractAddress);
  if (!contract.events) throw new Error('Sözleşme eventi undefined');
  log('Sözleşme başlatıldı');
} catch (error) {
  log('Sözleşme başlatma hatası', error);
  process.exit(1);
}

// Wei’den BNB’ye çevirme
const toBNB = (wei) => {
  try {
    return web3.utils.fromWei(wei, 'ether');
  } catch (error) {
    log('Wei’den BNB’ye çevirme hatası', error);
    return '0';
  }
};

// TokensPurchased event’ini dinle
try {
  const subscription = web3.eth.subscribe('logs', {
    address: contractAddress,
    topics: [web3.utils.sha3('TokensPurchased(address,uint256,uint256,uint256)')]
  }, async (error, logData) => {
    if (error) {
      log('Log abonelik hatası', error);
      process.exit(1);
      return;
    }
    try {
      const decodedLog = web3.eth.abi.decodeLog([
        { type: 'address', name: 'buyer', indexed: true },
        { type: 'uint256', name: 'bnbAmount' },
        { type: 'uint256', name: 'tokenAmount' },
        { type: 'uint256', name: 'timestamp' }
      ], logData.data, logData.topics.slice(1));
      const bnb = toBNB(decodedLog.bnbAmount);
      const tokens = toBNB(decodedLog.tokenAmount); // Token decimal’ına göre ayarla
      const message = `
🚀 Yeni Alım!
👤 Alıcı: ${decodedLog.buyer}
💰 BNB: ${bnb} BNB
🎟️ Token: ${tokens} TOKEN
🕒 Zaman: ${new Date(decodedLog.timestamp * 1000).toLocaleString()}
      `;
      await bot.sendMessage(process.env.CHAT_ID, message);
      log('Bildirim gönderildi', message);
    } catch (error) {
      log('Log çözümleme veya bildirim hatası', error);
    }
  });
  log('Event dinleme başlatıldı');
  subscription.on('error', (error) => {
    log('Abonelik hatası', error);
    process.exit(1);
  });
} catch (error) {
  log('Event dinleme başlatma hatası', error);
  process.exit(1);
}

// Botun çalıştığını logla
log('Bot çalışıyor...');

// WebSocket bağlantısını kontrol et
web3.eth.net.isListening()
  .then(() => log('WebSocket bağlantısı başarılı'))
  .catch((error) => {
    log('WebSocket bağlantısı koptu', error);
    process.exit(1);
  });
