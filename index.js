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
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || '0x42395Db998595DC7256aF2a6f10DC7b2E6006993',
  BSC_NODES,
  RECONNECT_INTERVAL: 5000,
  POLLING_INTERVAL: 300,
  POLLING_TIMEOUT: 10,
  MAX_POLLING_RETRIES: 3,
  EVENT_POLLING_INTERVAL: 60000, // Olay tarama sıklığı (60 saniye)
  MAX_BLOCK_RANGE: 2, // Tek seferde taranacak maksimum blok sayısı
  RETRY_DELAY: 15000, // Limit aşımı sonrası yeniden deneme gecikmesi (15 saniye)
  MAX_RETRIES: 3 // Limit aşımı için maksimum yeniden deneme sayısı
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
let lastProcessedBlock = BigInt(0); // BigInt olarak tanımla
const TOKEN_DECIMALS = 18; // Tokenın ondalık basamak sayısı (BSCScan'de doğrulayın!)

const initializeWeb3 = () => {
  try {
    const nodeUrl = CONFIG.BSC_NODES[currentNodeIndex];
    web3 = new Web3(nodeUrl);
    log(`Web3 başlatıldı, düğüm: ${nodeUrl}`);
    return true;
  } catch (error) {
    log("Web3 başlatma hatası", error);
    currentNodeIndex = (currentNodeIndex + 1) % CONFIG.BSC_NODES.length;
    log(`Düğüm değiştiriliyor: ${CONFIG.BSC_NODES[currentNodeIndex]}`);
    return initializeWeb3(); // Tekrar dene
  }
};

// 6. SÖZLEŞME ABI
const contractABI = [
  {
    "inputs": [{"internalType": "address", "name": "_token", "type": "address"}],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [],
    "name": "SaleEnded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [],
    "name": "SalePaused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [],
    "name": "SalePlayed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [],
    "name": "SaleStarted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "buyer", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "bnbAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "tokenAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "TokensPurchased",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "buyTokens",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "endSale",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getRemainingTokens",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalBNB",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "hardCap",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pauseSale",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "playSale",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "saleEnded",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "salePaused",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "saleToken",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "_token", "type": "address"}],
    "name": "setTokenAddress",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_price", "type": "uint256"}],
    "name": "setTokenPrice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_amount", "type": "uint256"}],
    "name": "setTokensPerUnit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "softCap",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "startSale",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "tokenPrice",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "tokensPerUnit",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalRaised",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "_token", "type": "address"}],
    "name": "withdrawForeignTokens",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdrawRaisedBNB",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdrawUnsoldTokens",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
];

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
    // ABI'deki olayları kontrol et
    const events = contract.options.jsonInterface.filter(item => item.type === 'event');
    const eventNames = events.map(event => event.name);
    log(`Sözleşmede mevcut olaylar: ${eventNames.join(', ') || 'Yok'}`);
    if (!eventNames.includes('TokensPurchased')) {
      throw new Error(`TokensPurchased olayı ABI'de mevcut değil.`);
    }
    // Son bloğu al ve başlangıç noktası olarak ayarla
    lastProcessedBlock = BigInt(await web3.eth.getBlockNumber());
    log(`Son işlenen blok: ${lastProcessedBlock}`);
    log(`Sözleşme başlatıldı: ${CONFIG.CONTRACT_ADDRESS}`);
    return true;
  } catch (error) {
    log("Sözleşme başlatma hatası", error);
    return false;
  }
}

// 9. OLAY TARAMA (POLLING)
async function startEventPolling() {
  try {
    if (!contract) throw new Error("Sözleşme nesnesi başlatılmadı.");
    log("Olay tarama başlatılıyor (web3.eth.getPastLogs)...");

    // TokensPurchased olayının topic'ini hesapla
    const eventSignature = web3.eth.abi.encodeEventSignature(
      contract.options.jsonInterface.find(item => item.name === 'TokensPurchased')
    );

    // Düzenli aralıklarla olayları tara
    setInterval(async () => {
      try {
        const currentBlock = BigInt(await web3.eth.getBlockNumber());
        if (currentBlock <= lastProcessedBlock) {
          log(`Yeni blok yok. Son işlenen blok: ${lastProcessedBlock}`);
          return;
        }

        // Blok aralığını sınırla
        const fromBlock = lastProcessedBlock + BigInt(1);
        const toBlock = currentBlock - lastProcessedBlock > BigInt(CONFIG.MAX_BLOCK_RANGE)
          ? lastProcessedBlock + BigInt(CONFIG.MAX_BLOCK_RANGE)
          : currentBlock;

        log(`Olaylar taranıyor, blok aralığı: ${fromBlock} - ${toBlock}`);
        let logs;
        let retries = 0;
        while (retries < CONFIG.MAX_RETRIES) {
          try {
            logs = await web3.eth.getPastLogs({
              address: CONFIG.CONTRACT_ADDRESS,
              topics: [eventSignature],
              fromBlock: fromBlock,
              toBlock: toBlock
            });
            break; // Başarılıysa döngüden çık
          } catch (error) {
            if (error.message.includes('limit exceeded')) {
              retries++;
              log(`Limit aşımı hatası, yeniden deneme ${retries}/${CONFIG.MAX_RETRIES}...`);
              await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            } else {
              throw error; // Diğer hatalarda döngüden çık
            }
          }
        }

        if (!logs) {
          log("Limit aşımı hatası, tüm denemeler başarısız. Düğüm değiştiriliyor...");
          currentNodeIndex = (currentNodeIndex + 1) % CONFIG.BSC_NODES.length;
          initializeWeb3();
          return;
        }

        for (const logData of logs) {
          try {
            // Olay verilerini çöz
            const decodedLog = web3.eth.abi.decodeLog(
              contract.options.jsonInterface.find(item => item.name === 'TokensPurchased').inputs,
              logData.data,
              logData.topics.slice(1)
            );

            const bnbAmount = web3.utils.fromWei(decodedLog.bnbAmount, 'ether');
            const tokenAmount = web3.utils.fromWei(decodedLog.tokenAmount, 'ether'); // Tokenı sadeleştir
            const message = `🚀 Yeni Satın Alma!\n👤 ${decodedLog.buyer}\n💰 ${bnbAmount} BNB\n🪙 ${tokenAmount} Token\n🕒 ${new Date(Number(decodedLog.timestamp) * 1000).toISOString()}`;
            await bot.sendMessage(CONFIG.CHAT_ID, message);
            log(`Bildirim gönderildi: ${message}`);
          } catch (error) {
            log("Olay işleme hatası", error);
          }
        }

        lastProcessedBlock = toBlock;
        log(`Son işlenen blok güncellendi: ${lastProcessedBlock}`);
      } catch (error) {
        log("Olay tarama hatası", error);
      }
    }, CONFIG.EVENT_POLLING_INTERVAL);
  } catch (error) {
    log("Olay tarama başlatma hatası", error);
    setTimeout(startEventPolling, CONFIG.RECONNECT_INTERVAL);
  }
}

// 10. SÖZLEŞME DURUM SORGULAMA (/info KOMUTU)
bot.onText(/\/info/, async (msg) => {
  try {
    if (!contract) throw new Error("Sözleşme nesnesi başlatılmadı.");
    const totalRaised = BigInt(await contract.methods.totalRaised().call());
    const remainingTokens = BigInt(await contract.methods.getRemainingTokens().call());
    const salePaused = await contract.methods.salePaused().call();
    const saleEnded = await contract.methods.saleEnded().call();
    const hardCap = BigInt(await contract.methods.hardCap().call());
    const softCap = BigInt(await contract.methods.softCap().call());
    const tokenPrice = BigInt(await contract.methods.tokenPrice().call());
    const tokensPerUnit = BigInt(await contract.methods.tokensPerUnit().call());

    const message = `📊 Sözleşme Durumu\n` +
      `💰 Toplam Toplanan: ${web3.utils.fromWei(totalRaised, 'ether')} BNB\n` +
      `🪙 Kalan Tokenlar: ${web3.utils.fromWei(remainingTokens, 'ether')} Token\n` +
      `⏸ Satış Durduruldu mu: ${salePaused ? 'Evet' : 'Hayır'}\n` +
      `🏁 Satış Bitti mi: ${saleEnded ? 'Evet' : 'Hayır'}\n` +
      `🎯 Hard Cap: ${web3.utils.fromWei(hardCap, 'ether')} BNB\n` +
      `🎯 Soft Cap: ${web3.utils.fromWei(softCap, 'ether')} BNB\n` +
      `💸 Token Fiyatı: ${web3.utils.fromWei(tokenPrice, 'ether')} BNB\n` +
      `📈 Birim Başına Token: ${Number(tokensPerUnit)}`; // tokensPerUnit için sadeleştirme kaldırıldı
    await bot.sendMessage(msg.chat.id, message);
    log(`Durum bilgisi gönderildi: ${message}`);
  } catch (error) {
    log("Durum sorgulama hatası", error);
    await bot.sendMessage(msg.chat.id, "❌ Durum sorgulanırken hata oluştu.");
  }
});

// 11. TELEGRAM POLLING YÖNETIMI
let pollingRetries = 0;

bot.on('polling_error', async (error) => {
  log("Telegram polling hatası", error);
  if (error.message.includes('409 Conflict')) {
    log("Çoklu bot örneği algılandı. Polling durduruluyor...");
    await bot.stopPolling();
    pollingRetries++;
    if (pollingRetries < CONFIG.MAX_POLLING_RETRIES) {
      log(`Yeniden deneme ${pollingRetries}/${CONFIG.MAX_POLLING_RETRIES}...`);
      setTimeout(async () => {
        try {
          await bot.startPolling();
          log("Telegram bot polling yeniden başlatıldı");
          pollingRetries = 0; // Başarılı olursa sıfırla
        } catch (retryError) {
          log("Polling yeniden başlatma hatası", retryError);
        }
      }, CONFIG.RECONNECT_INTERVAL);
    } else {
      log("Maksimum yeniden deneme sayısına ulaşıldı. Çıkılıyor...");
      process.exit(1);
    }
  } else {
    log("Polling hatası, yeniden başlatılıyor...");
    await bot.stopPolling();
    setTimeout(async () => {
      try {
        await bot.startPolling();
        log("Telegram bot polling yeniden başlatıldı");
      } catch (retryError) {
        log("Polling yeniden başlatma hatası", retryError);
      }
    }, CONFIG.RECONNECT_INTERVAL);
  }
});

// 12. BOT KOMUTLARI
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🤖 Presale Bot Aktif!");
});

bot.onText(/\/check/, async (msg) => {
  const isConnected = await checkConnection();
  bot.sendMessage(msg.chat.id, isConnected ? "✅ BSC bağlantısı aktif" : "❌ BSC bağlantı hatası");
});

// 13. BAŞLATMA
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

    // Olay taramayı başlat
    await startEventPolling();
    log(`🤖 Bot başlatıldı. Kontrat dinleniyor: ${CONFIG.CONTRACT_ADDRESS}`);
  } catch (error) {
    log("Başlatma hatası", error);
    setTimeout(initialize, CONFIG.RECONNECT_INTERVAL);
  }
}

// 14. HATA YAKALAYICILAR
process.on('unhandledRejection', (error) => {
  log('İşlenmemiş hata:', error);
});

process.on('uncaughtException', (error) => {
  log('Yakalanmamış hata:', error);
  process.exit(1);
});

// 15. ZARİF KAPATMA
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

// 16. UYGULAMAYI BAŞLAT
initialize();
