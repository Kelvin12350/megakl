const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    delay
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const fs = require('fs');
const chalk = require('chalk');
const { Boom } = require('@hapi/boom');

// IMPORT YOUR COMMAND HANDLER
const whatsappHandler = require('./case'); 

async function startpairing(phoneNumber, tgBot, tgChatId) {
    const { version } = await fetchLatestBaileysVersion();
    console.log(chalk.yellowBright(`[System] Starting Baileys v${version.join('.')}`));

    const sessionFolder = './mega_sessions/' + phoneNumber;
    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

    const sock = makeWASocket({
        logger: pino({ level: "fatal" }), 
        printQRInTerminal: false,
        auth: state,
        version: version,
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        connectTimeoutMs: 60000,
        getMessage: async (key) => {
            return { conversation: 'hello' };
        }
    });

    // --- PAIRING CODE LOGIC ---
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                if(tgBot) await tgBot.telegram.sendMessage(tgChatId, `⏳ *Requesting Code...*`);
                const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
                let code = await sock.requestPairingCode(cleanNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(chalk.cyanBright('[CODE] ' + code));
                
                if(tgBot) {
                    await tgBot.telegram.sendMessage(tgChatId, `✅ *YOUR CODE:*`);
                    await tgBot.telegram.sendMessage(tgChatId, `\`${code}\``, { parse_mode: 'Markdown' });
                }
            } catch(err) {
                console.log("Pairing Error:", err.message);
                if(tgBot) await tgBot.telegram.sendMessage(tgChatId, `❌ Error: ${err.message}`);
            }
        }, 5000);
    }

    // --- CONNECTION HANDLER ---
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.log(chalk.redBright(`Connection closed: ${reason}`));

            if (reason !== DisconnectReason.loggedOut) {
                console.log("Reconnecting...");
                startpairing(phoneNumber, tgBot, tgChatId);
            } else {
                if(tgBot) await tgBot.telegram.sendMessage(tgChatId, `❌ Session Logged Out.`);
            }
        } 
        else if (connection === "open") {
            console.log(chalk.bgBlue(`✅ Connected: ${phoneNumber}`));
            if(tgBot) await tgBot.telegram.sendMessage(tgChatId, `🎉 *Connected Successfully!*`);
        }
    });

    // --- 🚨 CRITICAL: THIS LISTENS FOR COMMANDS ---
    sock.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            // Get the first message from the array
            const m = chatUpdate.messages[0];
            // Ignore if it's not a real message or sent by the bot itself (optional)
            if (!m.message) return;
            
            // Send to case.js
            await whatsappHandler(sock, m);
        } catch (err) {
            console.log("Message Error:", err);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

module.exports = startpairing;
