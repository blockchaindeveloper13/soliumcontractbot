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
const bot = new TelegramBot(CONFIG.TELEGRAM_API_KEY, {
  polling: false,
  webHook: false
});

// Web3 bağlantısı
const web3 = new Web3(CONFIG.BSC_NODE_URL);

// Kontrat ABI (Güncellenmiş)
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

// Bağlantıyı kontrol et
async function checkWeb3Connection() {
  try {
    const code = await web3.eth.getCode(CONFIG.CONTRACT_ADDRESS);
    if (code === '0x') throw new Error('Kontrat kodu bulunamadı');
    
    const block = await web3.eth.getBlockNumber();
    log(`✅ BSC bağlantısı başarılı. Son blok: ${block}`);
    return true;
  } catch (error) {
    log(`❌ Web3 bağlantı hatası: ${error.message}`);
    return false;
  }
}

// Event dinleme
function startEventListening() {
  try {
    const eventOptions = {
      fromBlock: 'latest',
      address: CONFIG.CONTRACT_ADDRESS
    };

    const event = contract.events.TokensPurchased(eventOptions);

    if (!event) {
      throw new Error('Event objesi oluşturulamadı');
    }

    event
      .on('data', async (data) => {
        try {
          const bnbAmount = web3.utils.fromWei(data.returnValues.bnbAmount, 'ether');
          const message = `🚀 Yeni Satın Alma!\n👤 ${data.returnValues.buyer}\n💰 ${bnbAmount} BNB`;
          await bot.sendMessage(CONFIG.CHAT_ID, message);
          log(`Bildirim gönderildi: ${message}`);
        } catch (sendError) {
          log("Bildirim gönderme hatası", sendError);
        }
      })
      .on('error', (err) => {
        log("Event dinleme hatası", err);
        setTimeout(startEventListening, 5000);
      });

    log(`✅ Dinleme başladı: ${CONFIG.CONTRACT_ADDRESS}`);
  } catch (error) {
    log("❌ Dinleme başlatma hatası", error);
    setTimeout(startEventListening, 10000);
  }
}

// Uygulamayı başlat
async function initialize() {
  const isConnected = await checkWeb3Connection();
  if (isConnected) {
    startEventListening();
  } else {
    setTimeout(initialize, 10000);
  }
}

initialize();

// Hata yakalayıcılar
process.on('unhandledRejection', (error) => log('⛔ İşlenmemiş hata:', error));
process.on('uncaughtException', (error) => log('⛔ Yakalanmamış hata:', error));
