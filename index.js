const Web3 = require('web3');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_API_KEY, { polling: true });
const chatId = process.env.CHAT_ID;

// Web3 ve Sözleşme Ayarları
const web3 = new Web3(process.env.BSC_NODE_URL);
const contractAddress = process.env.CONTRACT_ADDRESS;
const contractABI = [
  // ABI’ni buraya kopyala (verdiğin JSON’dan)
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "bnbAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "tokenAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
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
  // Diğer ABI girişlerini ekleyebilirsin, ama şimdilik bu yeter
];

const contract = new web3.eth.Contract(contractABI, contractAddress);

// Wei’den BNB’ye çevirme
const toBNB = (wei) => web3.utils.fromWei(wei, 'ether');

// TokensPurchased event’ini dinle
contract.events.TokensPurchased({ fromBlock: 'latest' })
  .on('data', async (event) => {
    const { buyer, bnbAmount, tokenAmount, timestamp } = event.returnValues;
    const bnb = toBNB(bnbAmount);
    const tokens = web3.utils.fromWei(tokenAmount, 'ether'); // Tokenın decimal’ına göre ayarla
    const message = `
🚀 Yeni Alım!
👤 Alıcı: ${buyer}
💰 BNB: ${bnb} BNB
🎟️ Token: ${tokens} TOKEN
🕒 Zaman: ${new Date(timestamp * 1000).toLocaleString()}
    `;
    await bot.sendMessage(chatId, message);
  })
  .on('error', (error) => console.error('Event dinleme hatası:', error));

// /status komutu
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const totalBNB = await contract.methods.getTotalBNB().call();
    const remainingTokens = await contract.methods.getRemainingTokens().call();
    const message = `
📊 Presale Durumu
💰 Toplam Biriken: ${toBNB(totalBNB)} BNB
🎟️ Kalan Token: ${web3.utils.fromWei(remainingTokens, 'ether')} TOKEN
    `;
    await bot.sendMessage(chatId, message);
  } catch (error) {
    await bot.sendMessage(chatId, 'Hata oluştu, lütfen tekrar deneyin.');
    console.error('Status hatası:', error);
  }
});

// Botun çalıştığını logla
console.log('Bot çalışıyor...');
