const { Web3 } = require('web3');
const TelegramBot = require('node-telegram-bot-api');

// 1. KONFIGÜRASYON
const BSC_NODES = [
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.defibit.io/',
  'https://bsc-dataseed1.ninicoin.io/'
];

const CONFIG = {
  TELEGRAM_API_KEY: process.env.TELEGRAM_API_KEY,
  CHAT_ID: process.env.CHAT_ID,
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS,
  BSC_NODES,
  RECONNECT_INTERVAL: 5000,
  POLLING_INTERVAL: 300,
  POLLING_TIMEOUT: 10,
  MAX_POLLING_RETRIES: 3
};

// 2. LOGLAMA
const log = (message, error = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (error) console.error(`[${timestamp}] [ERROR] ${error.message || error}`);
};

// 3. ÇEVRE DEĞIŞKENLERI KONTROLÜ
function validateConfig() {
  const required = ['TELEGRAM_API_KEY', 'CHAT_ID', 'CONTRACT_ADDRESS'];
  const missing = required.filter(key => !CONFIG[key]);
  if (missing.length > 0) {
    throw new Error(`Eksik çevre değişkenleri: ${missing.join(', ')}`);
  }
}

// 4. TELEGRAM BOT KURULUMU
let bot;
try {
  bot = new TelegramBot(CONFIG.TELEGRAM_API_KEY, {
    polling: {
      interval: CONFIG.POLLING_INTERVAL,
      autoStart: false,
      params: { timeout: CONFIG.POLLING_TIMEOUT }
    }
  });
  log("Telegram bot nesnesi oluşturuldu.");
} catch (error) {
  log("Telegram bot başlatma hatası", error);
  process.exit(1);
}

// 5. WEB3 KURULUMU
let web3;
let contract;
let currentNodeIndex = 0;

const initializeWeb3 = () => {
  try {
    const nodeUrl = CONFIG.BSC_NODES[currentNodeIndex];
    web3 = new Web3(nodeUrl);
    log(`Web3 başlatıldı, düğüm: ${nodeUrl}`);
    return true;
  } catch (error) {
    log("Web3 başlatma hatası", error);
    return false;
  }
};

// 6. SÖZLEŞME ABI
const contractABI = [{
  anonymous: false,
  inputs: [
    { indexed: true, name: "buyer", type: "address" },
    { indexed: false, name: "bnbAmount", type: "uint256" },
    { indexed: false, name: "tokenAmount", type: "uint256" },
    { indexed: false, name: "timestamp", type: "uint256" }
  ],
  name: "TokensPurchased",
  type: "event"
}];

// 7. BAĞLANTI KONTROLÜ
async function checkConnection() {
  try {
    if (!web3) throw new Error("Web3 nesnesi başlatılmadı.");
    const block = await web3.eth.getBlockNumber();
    log(`✅ BSC bağlantısı başarılı. Son blok: ${block}`);
    return true;
  } catch (error) {
    log(`❌ BSC bağlantı hatası (düğüm: ${CONFIG.BSC_NODES[currentNodeIndex]})`, error);
    currentNodeIndex = (currentNodeIndex + 1) % CONFIG.BSC_NODES.length;
    log(`Düğüm değiştiriliyor: ${CONFIG.BSC_NODES[currentNodeIndex]}`);
    return false;
  }
}

// 8. SÖZLEŞME BAŞLATMA
async function initializeContract() {
  try {
    if (!web3) throw new Error("Web3 nesnesi başlatılmadı.");
    contract = new web3.eth.Contract(contractABI, CONFIG.CONTRACT_ADDRESS);
    const code = await web3.eth.getCode(CONFIG.CONTRACT_ADDRESS);
    if (code === '0x') {
      throw new Error("Geçersiz sözleşme adresi: Sözleşme bulunamadı.");
    }
    // ABI'deki olayın mevcut olduğunu kontrol et
    const eventExists = contract.events.TokensPurchased;
    if (!eventExists) {
      throw new Error("TokensPurchased olayı sözleşmede mevcut değil veya ABI yanlış.");
    }
    log(`Sözleşme başlatıldı: ${CONFIG.CONTRACT_ADDRESS}`);
    return true;
  } catch (error) {
    log("Sözleşme başlatma hatası", error);
    return false;
  }
}

// 9. OLAY DİNLEYİCİ
async function startEventListener() {
  try {
    if (!contract) throw new Error("Sözleşme nesnesi başlatılmadı.");
    log("Olay dinleyici başlatılıyor...");
    contract.events.TokensPurchased({ fromBlock: 'latest' })
      .on('data', async (event) => {
        try {
          const bnbAmount = web3.utils.fromWei(event.returnValues.bnbAmount, 'ether');
          const message = `🚀 Yeni Satın Alma!\n👤 ${event.returnValues.buyer}\n💰 ${bnbAmount} BNB`;
          await bot.sendMessage(CONFIG.CHAT_ID, message);
          log(`Bildirim gönderildi: ${message}`);
        } catch (error) {
          log("Olay işleme hatası", error);
        }
      })
      .on('error', (error) => {
        log("Olay dinleyici hatası", error);
        setTimeout(startEventListener, CONFIG.RECONNECT_INTERVAL);
      })
      .on('connected', (subscriptionId) => {
        log(`Olay dinleyici bağlandı, abonelik ID: ${subscriptionId}`);
      });
  } catch (error) {
    log("Olay dinleyici başlatma hatası", error);
    setTimeout(startEventListener, CONFIG.RECONNECT_INTERVAL);
  }
}

// 10. TELEGRAM POLLING YÖNETIMI
let pollingRetries = 0;

bot.on('polling_error', async (error) => {
  log("Telegram polling hatası", error);
  if (error.message.includes('409 Conflict')) {
    log("Çoklu bot örneği algılandı. Polling durduruluyor...");
    await bot.stopPolling();
    pollingRetries++;
    if (pollingRetries < CONFIG.MAX_POLLING_RETRIES) {
      log(`Yeniden deneme ${pollingRetries}/${CONFIG.MAX_POLLING_RETRIES}...`);
      setTimeout(() => bot.startPolling(), CONFIG.RECONNECT_INTERVAL);
    } else {
      log("Maksimum yeniden deneme sayısına ulaşıldı. Çıkılıyor...");
      process.exit(1);
    }
  }
});

// 11. BOT KOMUTLARI
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🤖 Presale Bot Aktif!");
});

bot.onText(/\/check/, async (msg) => {
  const isConnected = await checkConnection();
  bot.sendMessage(msg.chat.id, isConnected ? "✅ BSC bağlantısı aktif" : "❌ BSC bağlantı hatası");
});

// 12. BAŞLATMA
async function initialize() {
  try {
    // Çevre değişkenlerini kontrol et
    validateConfig();

    // Web3'ü başlat
    if (!initializeWeb3()) {
      log("Web3 başlatma başarısız, tekrar deneniyor...");
      setTimeout(initialize, CONFIG.RECONNECT_INTERVAL);
      return;
    }

    // Telegram bot polling başlat
    pollingRetries = 0;
    await bot.startPolling();
    log("Telegram bot polling başlatıldı");

    // BSC bağlantısını kontrol et
    const isConnected = await checkConnection();
    if (!isConnected) {
      log("BSC bağlantısı başarısız, tekrar deneniyor...");
      setTimeout(initialize, CONFIG.RECONNECT_INTERVAL);
      return;
    }

    // Sözleşmeyi başlat
    const isContractInitialized = await initializeContract();
    if (!isContractInitialized) {
      log("Sözleşme başlatma başarısız, tekrar deneniyor...");
      setTimeout(initialize, CONFIG.RECONNECT_INTERVAL);
      return;
    }

    // Olay dinleyiciyi başlat
    await startEventListener();
    log(`🤖 Bot başlatıldı. Kontrat dinleniyor: ${CONFIG.CONTRACT_ADDRESS}`);
  } catch (error) {
    log("Başlatma hatası", error);
    setTimeout(initialize, CONFIG.RECONNECT_INTERVAL);
  }
}

// 13. HATA YAKALAYICILAR
process.on('unhandledRejection', (error) => {
  log('İşlenmemiş hata:', error);
});

process.on('uncaughtException', (error) => {
  log('Yakalanmamış hata:', error);
  process.exit(1);
});

// 14. ZARİF KAPATMA
process.on('SIGTERM', async () => {
  log('SIGTERM alındı. Temizlik yapılıyor...');
  try {
    await bot.stopPolling();
    log('Bot polling durduruldu');
    process.exit(0);
  } catch (error) {
    log('Kapatma sırasında hata', error);
    process.exit(1);
  }
});

// 15. UYGULAMAYI BAŞLAT
initialize();
