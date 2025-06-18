const Web3 = require('web3');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_API_KEY, { polling: false });
const chatId = process.env.CHAT_ID;

// Web3 ve Sözleşme Ayarları
const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.BSC_NODE_URL));
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
  },
  {
    "inputs": [],
    "name": "getTotalBNB",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getRemainingTokens",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const contract = new web3.eth.Contract(contractABI, contractAddress);

// Wei’den BNB’ye çevirme
const toBNB = (wei) => web3.utils.fromWei(wei, 'ether');

// TokensPurchased event’ini dinle
contract.events.TokensPurchased({ fromBlock: 'latest' })
  .on('data', async (event) => {
    const { buyer, bnbAmount, tokenAmount, timestamp } = event.returnValues;
    const bnb = toBNB(bnbAmount);
    const tokens = toBNB(tokenAmount); // Token decimal’ına göre ayarla (genelde 18)
    const message = `
🚀 Yeni Alım!
👤 Alıcı: ${buyer}
💰 BNB: ${bnb} BNB
🎟️ Token: ${tokens} TOKEN
🕒 Zaman: ${new Date(timestamp * 1000).toLocaleString()}
    `;
    try {
      await bot.sendMessage(chatId, message);
      console.log('Bildirim gönderildi:', message);
    } catch (error) {
      console.error('Telegram bildirim hatası:', error);
    }
  })
  .on('error', (error) => {
    console.error('Event dinleme hatası:', error);
  });

// Botun çalıştığını logla
console.log('Bot çalışıyor...');

// Hata durumunda bağlantıyı yeniden kur
web3.eth.net.isListening()
  .catch(() => {
    console.log('WebSocket bağlantısı koptu, yeniden bağlanıyor...');
    process.exit(1); // Heroku otomatik yeniden başlatır
  });
