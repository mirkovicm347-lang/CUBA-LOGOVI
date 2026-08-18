const { Client, GatewayIntentBits, AuditLogEvent, EmbedBuilder } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json());

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// MAPIRANJE KANALA IZ ENVIRONMENT VARIJABLI
const LOG_CHANNELS = {
    // DISCORD LOGS
    joinDiscord: process.env.DISCORD_JOIN_CHANNEL,
    leaveDiscord: process.env.DISCORD_LEAVE_CHANNEL,
    joinVoice: process.env.DISCORD_VOICE_JOIN_CHANNEL,
    disconnectVoice: process.env.DISCORD_VOICE_DISCONNECT_CHANNEL,
    moveVoice: process.env.DISCORD_VOICE_MOVE_CHANNEL,
    addRole: process.env.ADD_ROLE_CHANNEL,
    removeRole: process.env.REMOVE_ROLE_CHANNEL,
    createRole: process.env.CREATE_ROLE_CHANNEL,
    deleteRole: process.env.DELETE_ROLE_CHANNEL,
    createChannel: process.env.CREATE_CHANNEL_CHANNEL,
    deleteChannel: process.env.DELETE_CHANNEL_CHANNEL,
    discordBan: process.env.DISCORD_BAN_CHANNEL,
    discordKick: process.env.DISCORD_KICK_CHANNEL,
    discordTimeout: process.env.DISCORD_TIMEOUT_CHANNEL,
    changeNickname: process.env.DISCORD_NICK_CHANNEL,
    createTicket: process.env.CREATE_TICKET_CHANNEL,

    // TX LOGS
    serverStart: process.env.SERVER_START_CHANNEL,
    serverStop: process.env.SERVER_STOP_CHANNEL,
    connect: process.env.CONNECT_CHANNEL,
    disconnect: process.env.DISCONNECT_CHANNEL,
    ban: process.env.BAN_CHANNEL,
    kick: process.env.KICK_CHANNEL,
    warn: process.env.WARN_CHANNEL,
    resourceStart: process.env.RESOURCE_START_CHANNEL,
    resourceStop: process.env.RESOURCE_STOP_CHANNEL,
    txAdmins: process.env.TX_ADMINS_CHANNEL,
    addAdmins: process.env.ADD_ADMINS_CHANNEL,

    // ING LOGS
    goto: process.env.GOTO_CHANNEL,
    aduty: process.env.ADUTY_CHANNEL,
    bring: process.env.BRING_CHANNEL,
    kill: process.env.KILL_CHANNEL,
    tpm: process.env.TPM_CHANNEL,
    revive: process.env.REVIVE_CHANNEL,
    setjob: process.env.SETJOB_CHANNEL,
    setgroup: process.env.SETGROUP_CHANNEL,
    giveitem: process.env.GIVEITEM_CHANNEL,
    noclip: process.env.NOCLIP_CHANNEL
};

async function sendToLogs(channelId, embedData) {
    try {
        if (!channelId) return;
        const channel = await client.channels.fetch(channelId);
        if (channel) {
            await channel.send({ embeds: [embedData] });
        }
    } catch (err) {
        console.error(`[GRESKA] Problem pri slanju u kanal ID ${channelId}:`, err);
    }
}

// ====================================================
// DISCORD EVENT LOGOVI
// ====================================================

// Join Discord
client.on('guildMemberAdd', member => {
    const embed = new EmbedBuilder()
        .setTitle('📥 Ulazak na Discord')
        .setDescription(`Korisnik **${member.user.tag}** (${member.user.id}) se pridružio serveru.`)
        .setColor(0x2ecc71)
        .setTimestamp();
    sendToLogs(LOG_CHANNELS.joinDiscord, embed);
});

// Leave Discord & Kick
client.on('guildMemberRemove', async member => {
    const logs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
    const entry = logs.entries.first();

    if (entry && entry.target.id === member.id && (Date.now() - entry.createdTimestamp) < 5000) {
        const embed = new EmbedBuilder()
            .setTitle('🥾 Discord Kick Izvršen')
            .setColor(0xe67e22)
            .addFields(
                { name: 'Izbačeni korisnik:', value: `${member.user.tag} (${member.id})`, inline: false },
                { name: 'Izbacio ga:', value: entry.executor.tag, inline: true },
                { name: 'Razlog:', value: entry.reason || 'Nije naveden razlog', inline: false }
            )
            .setTimestamp();
        sendToLogs(LOG_CHANNELS.discordKick, embed);
    } else {
        const embed = new EmbedBuilder()
            .setTitle('📤 Izlazak s Discorda')
            .setDescription(`Korisnik **${member.user.tag}** je napustio server.`)
            .setColor(0xe74c3c)
            .setTimestamp();
        sendToLogs(LOG_CHANNELS.leaveDiscord, embed);
    }
});

// Discord Ban
client.on('guildBanAdd', async ban => {
    try {
        const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
        const entry = logs.entries.first();
        const bannedBy = entry ? entry.executor.tag : "Nepoznato";
        const reason = entry && entry.reason ? entry.reason : "Nije naveden razlog";

        const embed = new EmbedBuilder()
            .setTitle('🔨 Discord Ban Izvršen')
            .setColor(0xe74c3c)
            .addFields(
                { name: 'Banirani korisnik:', value: `${ban.user.tag} (${ban.user.id})`, inline: false },
                { name: 'Banirao ga:', value: bannedBy, inline: true },
                { name: 'Razlog:', value: reason, inline: false }
            )
            .setTimestamp();

        sendToLogs(LOG_CHANNELS.discordBan, embed);
    } catch (err) {
        console.error('[GRESKA] Problem pri dohvaćanju Discord ban loga:', err);
    }
});

// Change Nickname, Add/Remove Role, Timeout
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // 1. Change Nickname
    if (oldMember.nickname !== newMember.nickname) {
        const logs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
        const entry = logs.entries.first();
        let changedBy = newMember.user.tag;
        if (entry && entry.target.id === newMember.id && (Date.now() - entry.createdTimestamp) < 5000) {
            changedBy = entry.executor.tag;
        }

        const embed = new EmbedBuilder()
            .setTitle('✏️ Promjena Nadimka')
            .setColor(0xf1c40f)
            .addFields(
                { name: 'Korisnik:', value: newMember.user.tag, inline: true },
                { name: 'Promijenio mu:', value: changedBy, inline: true },
                { name: 'Stari nadimak:', value: oldMember.nickname || oldMember.user.username, inline: false },
                { name: 'Novi nadimak:', value: newMember.nickname || newMember.user.username, inline: false }
            )
            .setTimestamp();
        sendToLogs(LOG_CHANNELS.changeNickname, embed);
    }

    // 2. Add / Remove Role
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
        const logs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
        const entry = logs.entries.first();
        let actionBy = "System / Bot";
        if (entry && entry.target.id === newMember.id && (Date.now() - entry.createdTimestamp) < 5000) {
            actionBy = entry.executor.tag;
        }

        addedRoles.forEach(role => {
            const embed = new EmbedBuilder()
                .setTitle('➕ Dodana Rola')
                .setColor(0x2ecc71)
                .addFields(
                    { name: 'Korisnik:', value: newMember.user.tag, inline: true },
                    { name: 'Dodao:', value: actionBy, inline: true },
                    { name: 'Rola:', value: role.name, inline: false }
                ).setTimestamp();
            sendToLogs(LOG_CHANNELS.addRole, embed);
        });

        removedRoles.forEach(role => {
            const embed = new EmbedBuilder()
                .setTitle('➖ Skinuta Rola')
                .setColor(0xe74c3c)
                .addFields(
                    { name: 'Korisnik:', value: newMember.user.tag, inline: true },
                    { name: 'Skinuo:', value: actionBy, inline: true },
                    { name: 'Rola:', value: role.name, inline: false }
                ).setTimestamp();
            sendToLogs(LOG_CHANNELS.removeRole, embed);
        });
    }

    // 3. Timeout Event
    if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
        const logs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
        const entry = logs.entries.first();
        const executor = entry ? entry.executor.tag : "Nepoznato";
        const reason = entry && entry.reason ? entry.reason : "Nije naveden razlog";

        const embed = new EmbedBuilder()
            .setTitle('⏳ Korisnik Utišan (Timeout)')
            .setColor(0xe67e22)
            .addFields(
                { name: 'Korisnik:', value: newMember.user.tag, inline: true },
                { name: 'Utišao ga:', value: executor, inline: true },
                { name: 'Traje do:', value: new Date(newMember.communicationDisabledUntil).toLocaleString('hr-HR'), inline: false },
                { name: 'Razlog:', value: reason, inline: false }
            )
            .setTimestamp();
        sendToLogs(LOG_CHANNELS.discordTimeout, embed);
    }
});

// Voice Events (Join, Disconnect, Move)
client.on('voiceStateUpdate', async (oldState, newState) => {
    // Join Voice
    if (!oldState.channelId && newState.channelId) {
        const embed = new EmbedBuilder()
            .setTitle('🎙️ Ulazak u Voice')
            .setColor(0x2ecc71)
            .addFields(
                { name: 'Korisnik:', value: newState.member.user.tag, inline: true },
                { name: 'Kanal:', value: newState.channel.name, inline: true }
            )
            .setTimestamp();
        sendToLogs(LOG_CHANNELS.joinVoice, embed);
    }

    // Disconnect Voice
    if (oldState.channelId && !newState.channelId) {
        const embed = new EmbedBuilder()
            .setTitle('🔇 Izlazak iz Voice-a')
            .setColor(0xe74c3c)
            .addFields(
                { name: 'Korisnik:', value: oldState.member.user.tag, inline: true },
                { name: 'Kanal:', value: oldState.channel.name, inline: true }
            )
            .setTimestamp();
        sendToLogs(LOG_CHANNELS.disconnectVoice, embed);
    }

    // Move Voice
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        const logs = await newState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberMove });
        const entry = logs.entries.first();
        let movedBy = 'Sam je prešao';
        if (entry && (Date.now() - entry.createdTimestamp) < 5000) {
            movedBy = entry.executor.tag;
        }

        const embed = new EmbedBuilder()
            .setTitle('🔀 Premješten u Voice-u')
            .setColor(0x3498db)
            .addFields(
                { name: 'Korisnik:', value: newState.member.user.tag, inline: true },
                { name: 'Premjestio:', value: movedBy, inline: true },
                { name: 'Iz kanala:', value: oldState.channel.name, inline: false },
                { name: 'U kanal:', value: newState.channel.name, inline: false }
            )
            .setTimestamp();
        sendToLogs(LOG_CHANNELS.moveVoice, embed);
    }
});

// Create Ticket Event (Sluša poruke ili nove kanale od "Balkan Cuba Roleplay" bota)
client.on('channelCreate', async channel => {
    if (channel.name.includes('ticket') || channel.name.includes('tikets') || channel.name.includes('prijava')) {
        setTimeout(async () => {
            try {
                const messages = await channel.messages.fetch({ limit: 5 });
                const firstMsg = messages.last();
                let openedBy = "Nepoznato";

                if (firstMsg && firstMsg.mentions.users.size > 0) {
                    openedBy = firstMsg.mentions.users.first().tag;
                }

                const embed = new EmbedBuilder()
                    .setTitle('🎫 Otvoren Novi Ticket')
                    .setColor(0x9b59b6)
                    .addFields(
                        { name: 'Kanal:', value: `<#${channel.id}> (${channel.name})`, inline: true },
                        { name: 'Otkrio/Otvorio:', value: openedBy, inline: true }
                    )
                    .setTimestamp();
                sendToLogs(LOG_CHANNELS.createTicket, embed);
            } catch (e) {
                console.error("Greška pri dohvaćanju poruka u ticket kanalu:", e);
            }
        }, 2000);
    }
});

// ====================================================
// HTTP API RUTE (Sluša logove s FiveM servera & UptimeRobot)
// ====================================================

app.get('/', (req, res) => {
    res.send('Cuba Logs Bot je Online i aktivan 24/7!');
});

app.post('/api/log', (req, res) => {
    const { type, title, fields, color } = req.body;
    const channelId = LOG_CHANNELS[type];

    if (!channelId) {
        return res.status(400).send({ error: `Kanal za tip '${type}' nije postavljen u Environment Variables.` });
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color || 0x3447003)
        .addFields(fields || [])
        .setTimestamp();

    sendToLogs(channelId, embed);
    res.send({ status: "success" });
});

// ====================================================
// POKRETANJE SERVERA & BOTA
// ====================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Render Log API sluša na portu ${PORT}`);
});

client.login(process.env.BOT_TOKEN);
