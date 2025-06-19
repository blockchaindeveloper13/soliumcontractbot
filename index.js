const { Web3 } = require('web3');
const TelegramBot = require('node-telegram-bot-api');

// 1. CONFIGURATION
const CONFIG = {
  TELEGRAM_API_KEY: "7786040626:AAGYSMfTy7xbZ_x6uyNOOBi-e7PUsMJ-28Y",
  CHAT_ID: "1616739367",
  BSC_NODE_URL: "https://bsc-dataseed.binance.org/",
  CONTRACT_ADDRESS: "0x42395Db998595DC7256aF2a6f10DC7b2E6006993",
  RECONNECT_INTERVAL: 5000,
  POLLING_INTERVAL: 300,
  POLLING_TIMEOUT: 10
};

// 2. LOGGING
const log = (message, error = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (error) console.error(`[${timestamp}] [ERROR] ${error.message}`);
};

// 3. TELEGRAM BOT SETUP
const bot = new TelegramBot(CONFIG.TELEGRAM_API_KEY, {
  polling: {
    interval: CONFIG.POLLING_INTERVAL,
    autoStart: false, // We'll start polling manually
    params: { timeout: CONFIG.POLLING_TIMEOUT }
  }
});

// 4. WEB3 SETUP
const web3 = new Web3(CONFIG.BSC_NODE_URL);
let contract;

// 5. CONTRACT ABI
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

// 6. CONNECTION CHECK
async function checkConnection() {
  try {
    const block = await web3.eth.getBlockNumber();
    log(`✅ Connected to BSC. Latest block: ${block}`);
    return true;
  } catch (error) {
    log("❌ BSC connection failed", error);
    return false;
  }
}

// 7. EVENT LISTENER
async function startEventListener() {
  try {
    if (!contract) {
      contract = new web3.eth.Contract(contractABI, CONFIG.CONTRACT_ADDRESS);
    }

    contract.events.TokensPurchased({
      fromBlock: 'latest'
    })
      .on('data', async (event) => {
        try {
          const bnbAmount = web3.utils.fromWei(event.returnValues.bnbAmount, 'ether');
          const message = `🚀 New Purchase!\n👤 ${event.returnValues.buyer}\n💰 ${bnbAmount} BNB`;
          await bot.sendMessage(CONFIG.CHAT_ID, message);
          log(`Notification sent: ${message}`);
        } catch (error) {
          log("Failed to process event", error);
        }
      })
      .on('error', (error) => {
        log("Event listener error", error);
        setTimeout(startEventListener, CONFIG.RECONNECT_INTERVAL);
      })
      .on('connected', (subscriptionId) => {
        log(`Event listener connected with subscription ID: ${subscriptionId}`);
      });
  } catch (error) {
    log("Failed to start event listener", error);
    setTimeout(startEventListener, CONFIG.RECONNECT_INTERVAL);
  }
}

// 8. BOT COMMANDS
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🤖 Presale Bot Active!");
});

bot.onText(/\/check/, async (msg) => {
  const isConnected = await checkConnection();
  bot.sendMessage(msg.chat.id, isConnected ? "✅ BSC connection active" : "❌ BSC connection error");
});

// 9. INITIALIZATION
async function initialize() {
  try {
    // Start polling
    await bot.startPolling();
    log("Telegram bot polling started");

    // Check connection and start event listener
    const isConnected = await checkConnection();
    if (isConnected) {
      await startEventListener();
      log(`🤖 Bot initialized. Listening to contract: ${CONFIG.CONTRACT_ADDRESS}`);
    } else {
      log("Initial connection failed, retrying...");
      setTimeout(initialize, CONFIG.RECONNECT_INTERVAL);
    }
  } catch (error) {
    log("Initialization failed", error);
    setTimeout(initialize, CONFIG.RECONNECT_INTERVAL);
  }
}

// 10. ERROR HANDLING
process.on('unhandledRejection', (error) => {
  log('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  log('Uncaught exception:', error);
  process.exit(1); // Exit with failure code
});

// 11. GRACEFUL SHUTDOWN
process.on('SIGTERM', async () => {
  log('Received SIGTERM. Performing cleanup...');
  try {
    await bot.stopPolling();
    log('Bot polling stopped');
    process.exit(0);
  } catch (error) {
    log('Error during shutdown', error);
    process.exit(1);
  }
});

// 12. START THE BOT
initialize();
