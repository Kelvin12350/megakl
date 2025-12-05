const fs = require('fs');
// ⚠️ IMPORTS: needed for .vv, .delete, and channel features
const { downloadContentFromMessage, generateWAMessageFromContent, proto } = require("@whiskeysockets/baileys");

// --- CONFIGURATION ---
const MENU_VIDEO = "https://files.catbox.moe/6qk009.mp4"; 
const DB_PATH = './database.json';

// 👇 REPLACE WITH YOUR TELEGRAM BOT LINK
const TELEGRAM_LINK = "https://t.me/Megabjbot"; 

// Helper to read database
function readDB() {
    if (!fs.existsSync(DB_PATH)) {
        const defaultData = { 
            owners: [], 
            mode: 'public',
            banned: [],       
            limited: [],
            monitored: [],    
            storage: {}       
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    return JSON.parse(fs.readFileSync(DB_PATH));
}

// Helper to write database
function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = async (sock, m) => {
    try {
        // 1. Extract Message Details
        const messageType = Object.keys(m.message)[0];
        const text = (messageType === 'conversation') ? m.message.conversation :
                     (messageType === 'extendedTextMessage') ? m.message.extendedTextMessage.text :
                     (messageType === 'videoMessage') ? m.message.videoMessage.caption :
                     (messageType === 'imageMessage') ? m.message.imageMessage.caption : 
                     (messageType === 'viewOnceMessageV2') ? m.message.viewOnceMessageV2.message.imageMessage?.caption || m.message.viewOnceMessageV2.message.videoMessage?.caption : '';

        if (!text && messageType !== 'viewOnceMessageV2') return; 

        // 2. Define Command Info
        const from = m.key.remoteJid;
        const isCmd = text ? text.startsWith('.') : false;
        const command = isCmd ? text.slice(1).trim().split(' ')[0].toLowerCase() : '';
        const args = text ? text.trim().split(/ +/).slice(1) : [];
        const q = args.join(' ');
        
        // 3. Define Sender & Owner Logic
        const sender = m.key.fromMe ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : (m.key.participant || from);
        const senderNumber = sender.split('@')[0];
        const botNumber = sock.user.id.split(':')[0];
        
        // Load Database
        const db = readDB();
        
        const isCreator = (senderNumber === botNumber) || db.owners.includes(senderNumber);

        // --- GLOBAL CHECKS ---

        if (db.banned && db.banned.includes(senderNumber) && !isCreator) return;
        if (db.limited && db.limited.includes(senderNumber) && !isCreator) return;

        // Monitor (.securitysave)
        if (db.monitored && db.monitored.includes(senderNumber)) {
            if (!db.storage) db.storage = {};
            if (!db.storage[senderNumber]) db.storage[senderNumber] = [];
            const time = new Date().toLocaleTimeString();
            db.storage[senderNumber].push(`[${time}] ${text || 'Media File'}`);
            writeDB(db);
        }

        if (db.mode === 'private' && !isCreator) return;

        // 4. Switch Commands
        switch (command) {
            
            // --- MAIN MENU ---
            case 'menu':
            case 'help':
                const menuText = `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃ ⚡ *ULTRALIGHT v2.0* ⚡
┃━━━━━━━━━━━━━━━━━━━━━━━━━━
┃
┃ 👋 *Hi @${senderNumber}*
┃ 🤖 *Mode:* ${db.mode.toUpperCase()}
┃
┃ ┌──〔 *MAIN* 〕
┃ ┃ ⚡ *.ping*
┃ ┃ 📜 *.menu*
┃ ┃ 🔗 *.repo*
┃ ┃ 🤝 *.pair*
┃ ┗━━━━━━━━━━━━━━━━━━━━
┃
┃ ┌──〔 *OWNER* 〕
┃ ┃ 🔒 *.private* | *.public*
┃ ┃ ➕ *.addowner* | *.removeowner*
┃ ┃ 👥 *.viewowner*
┃ ┃ 🏙️ *.viewgroup* | *.join* | *.exitgroup*
┃ ┃ 🚫 *.ban* | *.unban*
┃ ┃ ⏳ *.limited*
┃ ┃ 🧱 *.block* | *.unblock*
┃ ┃ 🕵️ *.securitysave*
┃ ┃ 💾 *.save* | *.deletesave* | *.see*
┃ ┃ 📩 *.dm*
┃ ┃ 🗑️ *.delete*
┃ ┃ 🤡 *.react*
┃ ┃ 📢 *.channel* (Fake Context)
┃ ┃ 👁️ *.vv* (Anti-View Once)
┃ ┗━━━━━━━━━━━━━━━━━━━━
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

                await sock.sendMessage(from, { 
                    video: { url: MENU_VIDEO }, 
                    caption: menuText,
                    gifPlayback: true,
                    mentions: [sender]
                }, { quoted: m });
                break;

            case 'ping':
                const msgTimestamp = typeof m.messageTimestamp === 'number' ? m.messageTimestamp : m.messageTimestamp.low;
                const latency = Date.now() - (msgTimestamp * 1000);
                await sock.sendMessage(from, { text: `⚡ *SPEED:* ${latency}ms` }, { quoted: m });
                break;

            // --- INFO & UTILS ---
            case 'repo':
                await sock.sendMessage(from, { text: `🔗 *Telegram Bot:* ${TELEGRAM_LINK}` }, { quoted: m });
                break;
            
            case 'pair':
                await sock.sendMessage(from, { text: `🤝 *To pair a new number, go here:* ${TELEGRAM_LINK}\n\nType /connect <number> in the Telegram bot.` }, { quoted: m });
                break;

            case 'delete':
            case 'del':
                if (!isCreator) return;
                if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) return;
                let msgKey = {
                    remoteJid: from,
                    fromMe: false,
                    id: m.message.extendedTextMessage.contextInfo.stanzaId,
                    participant: m.message.extendedTextMessage.contextInfo.participant
                };
                await sock.sendMessage(from, { delete: msgKey });
                break;

            case 'react':
                if (!args[0]) return sock.sendMessage(from, { text: '⚠️ usage: .react 🤡' }, { quoted: m });
                const reactionEmoji = args[0];
                const reactionMessage = {
                    react: {
                        text: reactionEmoji,
                        key: m.message.extendedTextMessage?.contextInfo?.stanzaId ? {
                            remoteJid: from,
                            fromMe: false, // Assume reacting to others
                            id: m.message.extendedTextMessage.contextInfo.stanzaId,
                            participant: m.message.extendedTextMessage.contextInfo.participant
                        } : m.key
                    }
                };
                await sock.sendMessage(from, reactionMessage);
                break;

            // --- FAKE CHANNEL MESSAGE (The "1.7k" trick) ---
            case 'channel':
                if (!isCreator) return;
                if (!q) return sock.sendMessage(from, { text: '⚠️ Usage: .channel Hello World' }, { quoted: m });
                
                // We create a fake "Forwarded" context from WhatsApp's official channel
                const channelMsg = generateWAMessageFromContent(from, {
                    extendedTextMessage: {
                        text: q,
                        contextInfo: {
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: "12036306387667394@newsletter", // Official WhatsApp Channel JID
                                newsletterName: "WhatsApp",
                                serverMessageId: 100
                            }
                        }
                    }
                }, { quoted: m });
                
                await sock.relayMessage(from, channelMsg.message, {});
                break;

            // --- MEDIA TOOLS (FIXED VV) ---
            case 'vv': 
                if (!isCreator) return;
                
                let quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                if (!quoted) return sock.sendMessage(from, { text: '⚠️ Reply to ViewOnce.' }, { quoted: m });

                let viewOnce = quoted.viewOnceMessageV2 || quoted.viewOnceMessage;
                if (!viewOnce) return sock.sendMessage(from, { text: '⚠️ Not a ViewOnce.' }, { quoted: m });

                // Robust Content Detection
                let content = viewOnce.message.imageMessage || viewOnce.message.videoMessage;
                let type = viewOnce.message.imageMessage ? 'image' : 'video';
                
                try {
                    let stream = await downloadContentFromMessage(content, type);
                    let buffer = Buffer.from([]);
                    for await(const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                    if (type === 'image') await sock.sendMessage(from, { image: buffer, caption: '👁️ *Recovered*' }, { quoted: m });
                    else await sock.sendMessage(from, { video: buffer, caption: '👁️ *Recovered*' }, { quoted: m });

                } catch (e) {
                    console.log(e);
                    await sock.sendMessage(from, { text: '❌ Failed to download.' }, { quoted: m });
                }
                break;

            // --- GROUP MANAGEMENT ---
            case 'exitgroup':
            case 'leave':
                if (!isCreator) return;
                if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '⚠️ Not a group.' }, { quoted: m });
                await sock.sendMessage(from, { text: '👋 *Goodbye!*' });
                await sock.groupLeave(from);
                break;

            case 'viewgroup':
                if (!isCreator) return;
                let getGroups = await sock.groupFetchAllParticipating();
                let groups = Object.entries(getGroups).map(entry => entry[1]);
                let groupList = groups.map(v => `🏙️ *${v.subject}*\nID: ${v.id}`).join('\n\n');
                await sock.sendMessage(from, { text: `📜 *GROUPS:*\n\n${groupList}` }, { quoted: m });
                break;

            case 'join':
                if (!isCreator) return;
                let code = args[0]?.match(/chat.whatsapp.com\/([0-9A-Za-z]{20,24})/);
                if (!code) return sock.sendMessage(from, { text: '❌ Invalid link.' }, { quoted: m });
                try {
                    await sock.groupAcceptInvite(code[1]);
                    await sock.sendMessage(from, { text: '✅ *Joined!*' }, { quoted: m });
                } catch (e) {
                    await sock.sendMessage(from, { text: '❌ Failed.' }, { quoted: m });
                }
                break;

            // --- OWNER MANAGEMENT ---
            case 'addowner':
                if (!isCreator) return;
                let newOwner = getTarget(m, args);
                if (!newOwner) return;
                if (db.owners.includes(newOwner)) return sock.sendMessage(from, { text: '⚠️ Exists.' }, { quoted: m });
                db.owners.push(newOwner);
                writeDB(db);
                await sock.sendMessage(from, { text: `👑 *Added @${newOwner}*`, mentions: [`${newOwner}@s.whatsapp.net`] }, { quoted: m });
                break;

            case 'removeowner':
                if (!isCreator) return;
                let remOwner = getTarget(m, args);
                if (!remOwner) return;
                db.owners = db.owners.filter(x => x !== remOwner);
                writeDB(db);
                await sock.sendMessage(from, { text: `🗑️ *Removed @${remOwner}*`, mentions: [`${remOwner}@s.whatsapp.net`] }, { quoted: m });
                break;

            case 'viewowner':
                if (!isCreator) return;
                let ownerList = db.owners.map((o, i) => `${i+1}. @${o}`).join('\n');
                await sock.sendMessage(from, { text: `👑 *OWNERS:*\n\n${ownerList}`, mentions: db.owners.map(o => `${o}@s.whatsapp.net`) }, { quoted: m });
                break;

            // --- USER RESTRICTIONS ---
            case 'limited':
                if (!isCreator) return;
                let limitUser = getTarget(m, args);
                if (!limitUser) return;
                if (!db.limited) db.limited = [];
                if (db.limited.includes(limitUser)) {
                    db.limited = db.limited.filter(x => x !== limitUser);
                    writeDB(db);
                    await sock.sendMessage(from, { text: `✅ *Un-Limited @${limitUser}*`, mentions: [`${limitUser}@s.whatsapp.net`] }, { quoted: m });
                } else {
                    db.limited.push(limitUser);
                    writeDB(db);
                    await sock.sendMessage(from, { text: `⏳ *Limited @${limitUser}*`, mentions: [`${limitUser}@s.whatsapp.net`] }, { quoted: m });
                }
                break;

            case 'ban':
                if (!isCreator) return;
                let banUser = getTarget(m, args);
                if (!banUser) return;
                if (!db.banned) db.banned = [];
                if (!db.banned.includes(banUser)) {
                    db.banned.push(banUser);
                    writeDB(db);
                    await sock.sendMessage(from, { text: `🚫 *Banned @${banUser}*`, mentions: [`${banUser}@s.whatsapp.net`] }, { quoted: m });
                }
                break;

            case 'unban':
                if (!isCreator) return;
                let unbanUser = getTarget(m, args);
                if (!unbanUser) return;
                if (db.banned) {
                    db.banned = db.banned.filter(x => x !== unbanUser);
                    writeDB(db);
                    await sock.sendMessage(from, { text: `✅ *Unbanned @${unbanUser}*`, mentions: [`${unbanUser}@s.whatsapp.net`] }, { quoted: m });
                }
                break;

            // --- SAVE / SPY TOOLS ---
            case 'securitysave':
                if (!isCreator) return;
                let spyUser = getTarget(m, args);
                if (!spyUser) return;
                if (!db.monitored) db.monitored = [];
                if (args[1] === 'off') {
                    db.monitored = db.monitored.filter(x => x !== spyUser);
                    writeDB(db);
                    await sock.sendMessage(from, { text: `🛑 *Stopped monitoring @${spyUser}*`, mentions: [`${spyUser}@s.whatsapp.net`] }, { quoted: m });
                } else {
                    if (!db.monitored.includes(spyUser)) db.monitored.push(spyUser);
                    writeDB(db);
                    await sock.sendMessage(from, { text: `🕵️ *Monitoring @${spyUser}*`, mentions: [`${spyUser}@s.whatsapp.net`] }, { quoted: m });
                }
                break;

            case 'save':
                if (!isCreator) return;
                if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) return sock.sendMessage(from, { text: '⚠️ Reply to save.' }, { quoted: m });
                let targetSaved = m.message.extendedTextMessage.contextInfo.participant.split('@')[0];
                let msgContent = m.message.extendedTextMessage.contextInfo.quotedMessage.conversation || m.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text || "Media/Other";
                if (!db.storage) db.storage = {};
                if (!db.storage[targetSaved]) db.storage[targetSaved] = [];
                db.storage[targetSaved].push(`[Saved Manually] ${msgContent}`);
                writeDB(db);
                await sock.sendMessage(from, { text: `💾 *Saved.*`, mentions: [`${targetSaved}@s.whatsapp.net`] }, { quoted: m });
                break;

            case 'see':
                if (!isCreator) return;
                let seeUser = getTarget(m, args);
                if (!seeUser) return;
                if (!db.storage || !db.storage[seeUser]) return sock.sendMessage(from, { text: `📭 Empty.` }, { quoted: m });
                let msgs = db.storage[seeUser].join('\n\n');
                await sock.sendMessage(from, { text: `📂 *SAVED FOR @${seeUser}:*\n\n${msgs}`, mentions: [`${seeUser}@s.whatsapp.net`] }, { quoted: m });
                break;

            case 'deletesave':
                if (!isCreator) return;
                let delUser = getTarget(m, args);
                if (!delUser) return;
                if (db.storage && db.storage[delUser]) {
                    delete db.storage[delUser];
                    writeDB(db);
                    await sock.sendMessage(from, { text: `🗑️ *Deleted saved messages for @${delUser}*`, mentions: [`${delUser}@s.whatsapp.net`] }, { quoted: m });
                } else {
                    await sock.sendMessage(from, { text: '⚠️ No data found.' }, { quoted: m });
                }
                break;

            case 'public':
                if (!isCreator) return;
                db.mode = 'public';
                writeDB(db);
                await sock.sendMessage(from, { text: '🔓 *Public Mode*' }, { quoted: m });
                break;

            case 'private':
                if (!isCreator) return;
                db.mode = 'private';
                writeDB(db);
                await sock.sendMessage(from, { text: '🔒 *Private Mode*' }, { quoted: m });
                break;

            case 'block':
                if (!isCreator) return;
                let blockUser = getTarget(m, args);
                if (!blockUser) return;
                await sock.updateBlockStatus(`${blockUser}@s.whatsapp.net`, 'block');
                await sock.sendMessage(from, { text: `🧱 *Blocked*` }, { quoted: m });
                break;

            case 'unblock':
                if (!isCreator) return;
                let unblockUser = getTarget(m, args);
                if (!unblockUser) return;
                await sock.updateBlockStatus(`${unblockUser}@s.whatsapp.net`, 'unblock');
                await sock.sendMessage(from, { text: `✅ *Unblocked*` }, { quoted: m });
                break;

            case 'dm':
                if (!isCreator) return;
                let dmUser = getTarget(m, args);
                let dmText = q.replace(dmUser, '').trim(); 
                if (args[0].includes(dmUser)) dmText = args.slice(1).join(' ');
                if (!dmUser || !dmText) return sock.sendMessage(from, { text: '⚠️ Usage: .dm @user text' }, { quoted: m });
                await sock.sendMessage(`${dmUser}@s.whatsapp.net`, { text: `📩 *Owner:* ${dmText}` });
                await sock.sendMessage(from, { text: '✅ Sent.' }, { quoted: m });
                break;

            default:
                break;
        }

    } catch (err) {
        console.error("Error in case.js:", err);
    }
};

function getTarget(m, args) {
    if (m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) return m.message.extendedTextMessage.contextInfo.mentionedJid[0].split('@')[0];
    if (m.message.extendedTextMessage?.contextInfo?.participant) return m.message.extendedTextMessage.contextInfo.participant.split('@')[0];
    if (args[0]) return args[0].replace(/[^0-9]/g, '');
    return null;
}
