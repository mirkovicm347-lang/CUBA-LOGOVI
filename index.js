const { Client, GatewayIntentBits, AuditLogEvent, EmbedBuilder } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json());

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// ID-OVI KANALA NA "Cuba Logs" SERVERU
const LOG_CHANNELS = {
    // Discord logs
    joinDiscord: process.env.DISCORD_JOIN_CHANNEL,
    leaveDiscord: process.env.DISCORD_LEAVE_CHANNEL,
    changeNickname: process.env.DISCORD_NICK_CHANNEL,
    moveVoice: process.env.DISCORD_VOICE_CHANNEL,
    
    // Tx & Ing logs
    warn: process.env.WARN_CHANNEL,
    ban: process.env.BAN_CHANNEL,
    goto: process.env.GOTO_CHANNEL,
    bring: process.env.BRING_CHANNEL,
    revive: process.env.REVIVE_CHANNEL,
    kill: process.env.KILL_CHANNEL,
    setjob: process.env.SETJOB_CHANNEL,
    aduty: process.env.ADUTY_CHANNEL
};

async function sendToLogs(channelId, embedData) {
    try {
        if (!channelId) return;
        const channel = await client.channels.fetch(channelId);
        if (channel) {
            await channel.send({ embeds: [embedData] });
        }
    } catch (err) {
        console.error(`[GRESKA] Slanje u kanal: ${channelId}`, err);
    }
}

// DISCORD EVENTI (Glavni Server)
client.on('guildMemberAdd', member => {
    const embed = new EmbedBuilder()
        .setTitle('📥 Ulazak na Discord')
        .setDescription(`Korisnik **${member.user.tag}** se pridružio serveru.`)
        .setColor(0x2ecc71)
        .setTimestamp();
    sendToLogs(LOG_CHANNELS.joinDiscord, embed);
});

client.on('guildMemberRemove', member => {
    const embed = new EmbedBuilder()
        .setTitle('📤 Izlazak s Discorda')
        .setDescription(`Korisnik **${member.user.tag}** je napustio server.`)
        .setColor(0xe74c3c)
        .setTimestamp();
    sendToLogs(LOG_CHANNELS.leaveDiscord, embed);
});

// API RUTA ZA FIVEM LOGOVE
app.post('/api/log', (req, res) => {
    const { type, title, fields, color } = req.body;
    const channelId = LOG_CHANNELS[type];
    
    if (!channelId) {
        return res.status(400).send({ error: "Kanal nije definiran" });
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color || 0x3447003)
        .addFields(fields || [])
        .setTimestamp();

    sendToLogs(channelId, embed);
    res.send({ status: "success" });
});

// Render automatski daje PORT preko process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Render Web Service sluša na portu ${PORT}`);
});

client.login(process.env.BOT_TOKEN);