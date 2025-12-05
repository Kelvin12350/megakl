const { Telegraf, Markup } = require('telegraf');
const startpairing = require('./pair');
const fs = require('fs');

// ============================================================
// ⚙️ CONFIGURATION
// ============================================================
const BOT_TOKEN = "8491961282:AAHSiAiVPH5IaDOcq_7oliCrCFrzVX4cfrk"; 

// 1. CHAT IDs (Make sure the bot is ADMIN in these chats)
const TELEGRAM_CHANNEL_ID = "@ULTRALIGHTkl"; 
const TELEGRAM_GROUP_ID = "@ULTRALIGHTlm";     

// 2. LINKS
const CHANNEL_LINK = "https://t.me/ULTRALIGHTkl";
const GROUP_LINK = "https://t.me/ULTRALIGHTlm";
const WHATSAPP_CHANNEL_LINK = "https://whatsapp.com/channel/0029VbBaAl61iUxbNURZ3Z2y";

// 3. VIDEO
const START_VIDEO = "https://files.catbox.moe/6qk009.mp4"; 

// ============================================================

const SESSION_DIR = './mega_sessions';
const CONFIG_FILE = './config.json'; 

const bot = new Telegraf(BOT_TOKEN);

// Ensure session directory exists
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

console.log('⚡ MEGA BOT ONLINE...');

// --- HELPER: CHECK MEMBERSHIP ---
async function isUserVerified(ctx) {
    try {
        const userId = ctx.from.id;
        // Check Channel
        const channelMember = await ctx.telegram.getChatMember(TELEGRAM_CHANNEL_ID, userId);
        // Check Group
        const groupMember = await ctx.telegram.getChatMember(TELEGRAM_GROUP_ID, userId);

        const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
        
        const inChannel = validStatuses.includes(channelMember.status);
        const inGroup = validStatuses.includes(groupMember.status);

        return inChannel && inGroup;
    } catch (error) {
        console.log("Verification Error (Bot must be admin):", error.message);
        // Default to false if we can't check
        return false;
    }
}

// --- 1. START COMMAND (Fixed Buttons) ---
bot.start(async (ctx) => {
    const welcomeText = `
👋 *Welcome to ULTRALIGHT Bot!*

To use this bot, you must verify that you have joined our official channels.

1️⃣ Join Telegram Channel
2️⃣ Join Telegram Group
3️⃣ Join WhatsApp Channel

*Click "✅ VERIFY" when done.*
`;

    // 🛠️ FIX: Clean Button Labels
    const buttons = Markup.inlineKeyboard([
        [
            Markup.button.url('📢 Telegram Channel', CHANNEL_LINK),
            Markup.button.url('👥 Telegram Group', GROUP_LINK)
        ],
        [
            Markup.button.url('💚 WhatsApp Channel', WHATSAPP_CHANNEL_LINK)
        ],
        [
            Markup.button.callback('✅ VERIFY & UNLOCK', 'verify_me')
        ]
    ]);

    // Send Video with Fallback
    try {
        await ctx.replyWithVideo(START_VIDEO, {
            caption: welcomeText,
            parse_mode: 'Markdown',
            ...buttons
        });
    } catch (e) {
        // If video fails, send photo/text
        await ctx.reply(welcomeText, {
            parse_mode: 'Markdown',
            ...buttons
        });
    }
});

// --- 2. VERIFY BUTTON ACTION ---
bot.action('verify_me', async (ctx) => {
    const isMember = await isUserVerified(ctx);

    if (isMember) {
        await ctx.answerCbQuery("✅ Verification Successful!");
        await ctx.reply(`
🎉 *You are Verified!*

*AVAILABLE COMMANDS:*
⚡ \`/connect 234801234567\` - _Pair a number_
🗑️ \`/disconnect 234801234567\` - _Delete a session_
        `, { parse_mode: 'Markdown' });
    } else {
        await ctx.answerCbQuery("❌ You haven't joined both Telegram chats yet!", { show_alert: true });
    }
});

// --- 3. AUTO-RESUME FUNCTION ---
async function autoStart() {
    if (!fs.existsSync(CONFIG_FILE)) return;
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE));
    const chatId = config.chatId;

    if (fs.existsSync(SESSION_DIR)) {
        const sessions = fs.readdirSync(SESSION_DIR);
        if (sessions.length > 0) {
            console.log(`♻️ Found ${sessions.length} sessions. Auto-reconnecting...`);
            if(chatId) await bot.telegram.sendMessage(chatId, `♻️ *Panel Restarted.* Auto-connecting...`, { parse_mode: 'Markdown' });

            sessions.forEach(async (phoneNumber) => {
                if(phoneNumber.startsWith('.')) return;
                console.log(`🚀 Resuming: ${phoneNumber}`);
                try {
                    await startpairing(phoneNumber, bot, chatId);
                } catch (error) {
                    console.log(`Failed to resume ${phoneNumber}:`, error);
                }
            });
        }
    }
}

// --- 4. CONNECT COMMAND ---
bot.command('connect', async (ctx) => {
    const isVerified = await isUserVerified(ctx);
    if (!isVerified) return ctx.reply("❌ *Access Denied.*\nPlease type /start and join our channels first.", { parse_mode: 'Markdown' });

    const message = ctx.message.text;
    const args = message.split(' ');

    if (args.length < 2) {
        return ctx.reply("⚠️ *Usage:* `/connect 2348012345678`", { parse_mode: 'Markdown' });
    }

    const phoneNumber = args[1].replace(/[^0-9]/g, '');
    const chatId = ctx.chat.id;

    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ chatId: chatId }));

    const userSessionPath = `${SESSION_DIR}/${phoneNumber}`;
    
    if (fs.existsSync(userSessionPath)) {
        ctx.reply("🧹 detected old session. cleaning it...");
        fs.rmSync(userSessionPath, { recursive: true, force: true });
    }

    ctx.reply(`⚡ *Initializing Connection for ${phoneNumber}...*`, { parse_mode: 'Markdown' });

    try {
        await startpairing(phoneNumber, bot, chatId);
    } catch (e) {
        console.log(e);
        ctx.reply("❌ Script Error: " + e.message);
    }
});

// --- 5. DISCONNECT COMMAND ---
bot.command('disconnect', async (ctx) => {
    const isVerified = await isUserVerified(ctx);
    if (!isVerified) return ctx.reply("❌ *Access Denied.*\nPlease type /start and verify first.", { parse_mode: 'Markdown' });

    const message = ctx.message.text;
    const args = message.split(' ');

    if (args.length < 2) {
        return ctx.reply("⚠️ *Usage:* `/disconnect 2348012345678`", { parse_mode: 'Markdown' });
    }

    const phoneNumber = args[1].replace(/[^0-9]/g, '');
    const userSessionPath = `${SESSION_DIR}/${phoneNumber}`;

    if (fs.existsSync(userSessionPath)) {
        try {
            fs.rmSync(userSessionPath, { recursive: true, force: true });
            ctx.reply(`🗑️ *Successfully disconnected ${phoneNumber}.* \nThe session has been deleted.`, { parse_mode: 'Markdown' });
        } catch (e) {
            ctx.reply(`❌ Error deleting session: ${e.message}`);
        }
    } else {
        ctx.reply(`⚠️ No active session found for *${phoneNumber}*`, { parse_mode: 'Markdown' });
    }
});

bot.launch();

autoStart();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

