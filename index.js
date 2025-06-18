const { Web3 } = require('web3');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Loglama fonksiyonu
const log = (message, error = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[INFO] ${timestamp} - ${message}`);
  if (error) console.error(`[ERROR] ${timestamp} - ${error.stack || error}`);
};

// Environment değişkenlerini kontrol et
const requiredEnvVars = ['TELEGRAM_API_KEY', 'CHAT_ID', 'BSC_NODE_URL', 'CONTRACT_ADDRESS'];
try {
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) throw new Error(`${envVar} eksik`);
  }
  log('Environment değişkenleri kontrol edildi');
} catch (error) {
  log('Environment değişkeni hatası', error);
  process.exit(1);
}

// Telegram Bot
let bot;
try {
  bot = new TelegramBot(process.env.TELEGRAM_API_KEY, { polling: false });
  bot.getMe().then(() => log('Telegram bot başlatıldı')).catch((err) => {
    throw new Error(`Telegram bot başlatma hatası: ${err.message}`);
  });
} catch (error) {
  log('Telegram bot başlatma hatası', error);
  process.exit(1);
}

// Web3 başlat
let web3;
try {
  web3 = new Web3(process.env.BSC_NODE_URL);
  log('Web3 başlatıldı');
} catch (error) {
  log('Web3 başlatma hatası', error);
  process.exit(1);
}

// Sözleşme ayarları
const contractAddress = process.env.CONTRACT_ADDRESS;
const contractABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'buyer', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'bnbAmount', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'tokenAmount', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' }
    ],
    name: 'TokensPurchased',
    type: 'event'
  }
];

let contract;
try {
  contract = new web3.eth.Contract(contractABI, contractAddress);
  if (!contract) throw new Error('Sözleşme nesnesi oluşturulamadı');
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

// Event dinleme
try {
  const eventSignature = web3.utils.sha3('TokensPurchased(address,uint256,uint256,uint256)');
  const subscription = web3.eth.subscribe('logs', {
    address: contractAddress,
    topics: [eventSignature]
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
