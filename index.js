const { Client, GatewayIntentBits, AuditLogEvent, EmbedBuilder } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json());

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildBans,    
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// MAPIRANJE KANALA IZ ENVIRONMENT VARIJABLI (Usklađeno s tvojim Render postavkama)
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
    createTicket: process.env.CREATE_TICKET_CHANNEL,
    discordBan: process.env.DISCORD_BAN_CHANNEL,
    discordKick: process.env.DISCORD_KICK_CHANNEL,
    discordTimeout: process.env.DISCORD_TIMEOUT_CHANNEL,
    changeNickname: process.env.DISCORD_NICK_CHANNEL,

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
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) {
            await channel.send({ embeds: [embedData] });
        }
    } catch (err) {
        console.error(`[GRESKA] Problem pri slanju u kanal ID ${channelId}:`, err);
    }
}

// Pomoćna funkcija za sigurno dohvaćanje Audit Loga
async function getAuditLogEntry(guild, type, targetId) {
    try {
        const logs = await guild.fetchAuditLogs({ limit: 5, type });
        return logs.entries.find(entry => 
            (targetId ? (entry.target && entry.target.id === targetId) : true) && 
            (Date.now() - entry.createdTimestamp) < 10000
        ) || null;
    } catch (e) {
        return null;
    }
}

// ====================================================
// DISCORD EVENT LOGOVI
// ====================================================

// 1. Join Discord
client.on('guildMemberAdd', member => {
    const embed = new EmbedBuilder()
        .setTitle('📥 Ulazak na Discord')
        .setColor(0x2ecc71)
        .addFields(
            { name: '👤 Korisnik:', value: `${member.user.tag} (<@${member.id}>)`, inline: false },
            { name: '🆔 ID Korisnika:', value: `\`${member.id}\``, inline: true }
        )
        .setTimestamp();
    sendToLogs(LOG_CHANNELS.joinDiscord, embed);
});

// 2. Leave Discord & Kick
client.on('guildMemberRemove', async member => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const kickEntry = await getAuditLogEntry(member.guild, AuditLogEvent.MemberKick, member.id);

    if (kickEntry) {
        const embed = new EmbedBuilder()
            .setTitle('🥾 Discord Kick Izvršen')
            .setColor(0xe67e22)
            .addFields(
                { name: '👤 Izbačeni korisnik:', value: `${member.user.tag} (\`${member.id}\`)`, inline: false },
                { name: '🛡️ Izbacio ga:', value: `${kickEntry.executor.tag}`, inline: true },
                { name: '📝 Razlog:', value: kickEntry.reason || 'Nije naveden razlog', inline: false }
            )
            .setTimestamp();
        sendToLogs(LOG_CHANNELS.discordKick, embed);
    } else {
        const embed = new EmbedBuilder()
            .setTitle('📤 Izlazak s Discorda')
            .setColor(0xe74c3c)
            .addFields(
                { name: '👤 Korisnik:', value: `${member.user.tag} (<@${member.id}>)`, inline: false },
                { name: '🆔 ID Korisnika:', value: `\`${member.id}\``, inline: true }
            )
            .setTimestamp();
        sendToLogs(LOG_CHANNELS.leaveDiscord, embed);
    }
});

// 3. Voice Events (Join, Disconnect, Move)
client.on('voiceStateUpdate', async (oldState, newState) => {
    // Join Voice
    if (!oldState.channelId && newState.channelId) {
        const embed = new EmbedBuilder()
            .setTitle('🎙️ Ulazak u Voice')
            .setColor(0x2ecc71)
            .addFields(
                { name: '👤 Korisnik:', value: `${newState.member.user.tag}`, inline: true },
                { name: '🔊 Kanal:', value: `${newState.channel.name}`, inline: true }
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
                { name: '👤 Korisnik:', value: `${oldState.member.user.tag}`, inline: true },
                { name: '🔊 Kanal:', value: `${oldState.channel.name}`, inline: true }
            )
            .setTimestamp();
        sendToLogs(LOG_CHANNELS.disconnectVoice, embed);
    }

    // Move Voice
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        const entry = await getAuditLogEntry(newState.guild, AuditLogEvent.MemberMove, newState.member.id);
        const movedBy = entry ? entry.executor.tag : 'Sam je prešao';

        const embed = new EmbedBuilder()
            .setTitle('🔀 Premješten u Voice-u')
            .setColor(0x3498db)
            .addFields(
                { name: '👤 Korisnik:', value: `${newState.member.user.tag}`, inline: true },
                { name: '🛡️ Premjestio:', value: `${movedBy}`, inline: true },
                { name: '📁 Iz kanala:', value: `${oldState.channel.name}`, inline: false },
                { name: '📂 U kanal:', value: `${newState.channel.name}`, inline: false }
            )
            .setTimestamp();
        sendToLogs(LOG_CHANNELS.moveVoice, embed);
    }
});

// 4. Nickname, Roles, Timeout
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // Promjena nadimka
    if (oldMember.nickname !== newMember.nickname) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const entry = await getAuditLogEntry(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
        
        let changedBy = newMember.user.tag;
        if (entry && entry.executor && entry.executor.id !== newMember.id) {
            changedBy = `${entry.executor.tag} (${entry.executor.id})`;
        } else {
            changedBy = `${newMember.user.tag} (Sam sebi)`;
        }

        const oldNick = oldMember.nickname || oldMember.user.username;
        const newNick = newMember.nickname || newMember.user.username;

        const embed = new EmbedBuilder()
            .setTitle('✏️ Promjena Nadimka')
            .setColor(0xf1c40f)
            .addFields(
                { name: '👤 Kome je promijenjen:', value: `${newMember.user.tag} (<@${newMember.id}>)`, inline: false },
                { name: '🛡️ Tko je promijenio:', value: changedBy, inline: false },
                { name: '👴 Stari nadimak:', value: `\`${oldNick}\``, inline: true },
                { name: '👶 Novi nadimak:', value: `\`${newNick}\``, inline: true }
            )
            .setTimestamp();

        sendToLogs(LOG_CHANNELS.changeNickname, embed);
    }

    // Dodavanje / Skidanje rola
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
        const entry = await getAuditLogEntry(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
        const actionBy = entry ? entry.executor.tag : "System / Bot";

        addedRoles.forEach(role => {
            const embed = new EmbedBuilder()
                .setTitle('➕ Dodana Rola')
                .setColor(0x2ecc71)
                .addFields(
                    { name: '👤 Korisnik:', value: `${newMember.user.tag}`, inline: true },
                    { name: '🛡️ Dodao:', value: actionBy, inline: true },
                    { name: '🎭 Rola:', value: role.name, inline: false }
                ).setTimestamp();
            sendToLogs(LOG_CHANNELS.addRole, embed);
        });

        removedRoles.forEach(role => {
            const embed = new EmbedBuilder()
                .setTitle('➖ Skinuta Rola')
                .setColor(0xe74c3c)
                .addFields(
                    { name: '👤 Korisnik:', value: `${newMember.user.tag}`, inline: true },
                    { name: '🛡️ Skinuo:', value: actionBy, inline: true },
                    { name: '🎭 Rola:', value: role.name, inline: false }
                ).setTimestamp();
            sendToLogs(LOG_CHANNELS.removeRole, embed);
        });
    }

    // Timeout
    if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
        if (newMember.communicationDisabledUntilTimestamp && newMember.communicationDisabledUntilTimestamp > Date.now()) {
            const entry = await getAuditLogEntry(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
            const executor = entry ? entry.executor.tag : "Nepoznato";
            const reason = entry && entry.reason ? entry.reason : "Nije naveden razlog";

            const embed = new EmbedBuilder()
                .setTitle('⏳ Korisnik Utišan (Timeout)')
                .setColor(0xe67e22)
                .addFields(
                    { name: '👤 Korisnik:', value: `${newMember.user.tag}`, inline: true },
                    { name: '🛡️ Utišao ga:', value: executor, inline: true },
                    { name: '📅 Traje do:', value: new Date(newMember.communicationDisabledUntilTimestamp).toLocaleString('hr-HR'), inline: false },
                    { name: '📝 Razlog:', value: reason, inline: false }
                )
                .setTimestamp();
            sendToLogs(LOG_CHANNELS.discordTimeout, embed);
        }
    }
});

// 5. Create Role
client.on('roleCreate', async role => {
    const entry = await getAuditLogEntry(role.guild, AuditLogEvent.RoleCreate, role.id);
    const createdBy = entry ? entry.executor.tag : "Nepoznato";

    const embed = new EmbedBuilder()
        .setTitle('🛠️ Rola Kreirana')
        .setColor(0x2ecc71)
        .addFields(
            { name: '🎭 Naziv role:', value: `${role.name} (\`${role.id}\`)`, inline: true },
            { name: '🛡️ Kreirao:', value: createdBy, inline: true }
        )
        .setTimestamp();
    sendToLogs(LOG_CHANNELS.createRole, embed);
});

// 6. Delete Role
client.on('roleDelete', async role => {
    const entry = await getAuditLogEntry(role.guild, AuditLogEvent.RoleDelete, role.id);
    const deletedBy = entry ? entry.executor.tag : "Nepoznato";

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Rola Obrisana')
        .setColor(0xe74c3c)
        .addFields(
            { name: '🎭 Naziv role:', value: `${role.name}`, inline: true },
            { name: '🛡️ Obrisao:', value: deletedBy, inline: true }
        )
        .setTimestamp();
    sendToLogs(LOG_CHANNELS.deleteRole, embed);
});

// 7. Create Channel & Create Ticket
client.on('channelCreate', async channel => {
    if (!channel.guild) return;

    const entry = await getAuditLogEntry(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    const createdBy = entry ? entry.executor.tag : "Nepoznato";

    const createEmbed = new EmbedBuilder()
        .setTitle('➕ Kanal Kreiran')
        .setColor(0x2ecc71)
        .addFields(
            { name: '📁 Naziv kanala:', value: `${channel.name} (<#${channel.id}>)`, inline: true },
            { name: '🛡️ Kreirao:', value: createdBy, inline: true }
        )
        .setTimestamp();
    sendToLogs(LOG_CHANNELS.createChannel, createEmbed);

    const nameLower = channel.name.toLowerCase();
    if (nameLower.includes('ticket') || nameLower.includes('tikets') || nameLower.includes('prijava')) {
        setTimeout(async () => {
            try {
                const messages = await channel.messages.fetch({ limit: 10 });
                let openedBy = "Nepoznato";

                for (const msg of messages.values()) {
                    if (msg.mentions.users.size > 0) {
                        const user = msg.mentions.users.first();
                        if (!user.bot) {
                            openedBy = `${user.tag} (${user.id})`;
                            break;
                        }
                    }
                }

                const ticketEmbed = new EmbedBuilder()
                    .setTitle('🎫 Otvoren Novi Ticket')
                    .setColor(0x9b59b6)
                    .addFields(
                        { name: '📂 Kanal:', value: `<#${channel.id}> (${channel.name})`, inline: true },
                        { name: '👤 Otvorio korisnik:', value: openedBy, inline: true }
                    )
                    .setTimestamp();
                sendToLogs(LOG_CHANNELS.createTicket, ticketEmbed);
            } catch (e) {
                console.error("Greška pri dohvaćanju poruka u ticket kanalu:", e);
            }
        }, 3000);
    }
});

// 8. Delete Channel
client.on('channelDelete', async channel => {
    if (!channel.guild) return;

    const entry = await getAuditLogEntry(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    const deletedBy = entry ? entry.executor.tag : "Nepoznato";

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Kanal Obrisan')
        .setColor(0xe74c3c)
        .addFields(
            { name: '📂 Naziv obrisanog kanala:', value: `${channel.name}`, inline: true },
            { name: '🛡️ Obrisao:', value: deletedBy, inline: true }
        )
        .setTimestamp();

    sendToLogs(LOG_CHANNELS.deleteChannel, embed);
});

// 9. Ban
client.on('guildBanAdd', async ban => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const entry = await getAuditLogEntry(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    
    const bannedBy = entry ? entry.executor.tag : "Nepoznato / Bot";
    const reason = entry && entry.reason ? entry.reason : "Nije naveden razlog";

    const embed = new EmbedBuilder()
        .setTitle('🔨 Discord Ban Izvršen')
        .setColor(0xe74c3c)
        .addFields(
            { name: '👤 Banirani korisnik:', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: false },
            { name: '🛡️ Banirao ga:', value: bannedBy, inline: true },
            { name: '📝 Razlog:', value: reason, inline: false }
        )
        .setTimestamp();

    sendToLogs(LOG_CHANNELS.discordBan, embed);
});

// ====================================================
// HTTP API RUTE (Za FiveM server)
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
        .setColor(color || 0x3498db)
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
