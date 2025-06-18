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

// Telegram Bot (POLLING AKTİF)
const bot = new TelegramBot(CONFIG.TELEGRAM_API_KEY, {
  polling: true,
  onlyFirstMatch: true
});

// Web3 bağlantısı
const web3 = new Web3(CONFIG.BSC_NODE_URL);

// Kontrat ABI (Güncellenmiş versiyon)
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
  },
  {
    "inputs": [],
    "name": "TokensPurchased",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Kontrat instance'ı
const contract = new web3.eth.Contract(contractABI, CONFIG.CONTRACT_ADDRESS);

// Bağlantıyı test et
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

// Event dinleme
function startEventListening() {
  try {
    const event = contract.events.TokensPurchased({
      fromBlock: 'latest'
    });

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
      .on('error', (error) => {
        log("Event dinleme hatası", error);
        setTimeout(startEventListening, 5000);
      });

    log(`👂 Dinleme başladı: ${CONFIG.CONTRACT_ADDRESS}`);
  } catch (error) {
    log("Dinleme başlatma hatası", error);
    setTimeout(startEventListening, 10000);
  }
}

// Bot komutları
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🤖 Presale Bot Aktif!\nBSC bağlantısı: " + CONFIG.BSC_NODE_URL);
});

bot.onText(/\/status/, async (msg) => {
  const isConnected = await checkConnection();
  bot.sendMessage(msg.chat.id, isConnected ? "✅ BSC bağlantısı aktif" : "❌ BSC bağlantı hatası");
});

// Uygulamayı başlat
async function initialize() {
  const isConnected = await checkConnection();
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
