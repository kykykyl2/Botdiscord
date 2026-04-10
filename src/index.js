const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { startScheduler } = require('./scheduler');
const { searchAnime, getAnimeById } = require('./api/anilist');
const { getAll, add, remove, exists, getIds } = require('./db/watchlist');
const { buildSearchEmbed, buildWatchlistEmbed, buildNextEmbed } = require('./embeds/animeEmbed');

// ─── Création du client Discord ───────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// ─── Chargement des commandes slash ───────────────────────────────────────────
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
    }
}

// ─── Enregistrement des slash commands auprès de Discord ──────────────────────
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(config.token);
    const commands = [...client.commands.values()].map(c => c.data.toJSON());

    // Essai 1 : commandes guild (instantanées)
    try {
        console.log(`[Commands] Enregistrement guild de ${commands.length} commande(s)...`);
        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );
        console.log('[Commands] ✅ Commandes guild enregistrées !');
        return;
    } catch (err) {
        if (err.code === 50001 || (err.message && err.message.includes('Missing Access'))) {
            console.warn('[Commands] ⚠️  Missing Access — réinvite le bot avec ce lien :');
            console.warn(`           https://discord.com/oauth2/authorize?client_id=${config.clientId}&permissions=2147485696&scope=bot+applications.commands`);
        } else {
            console.error('[Commands] ❌ Erreur guild:', err.message);
        }
    }

    // Essai 2 : commandes globales (fallback, ~1h de propagation)
    try {
        console.log('[Commands] Tentative enregistrement global (propagation ~1h)...');
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands }
        );
        console.log('[Commands] ✅ Commandes globales enregistrées (actives dans ~1h) !');
    } catch (err) {
        console.error('[Commands] ❌ Erreur globale:', err.message);
    }
}

// ─── Handler commandes préfixe ! ──────────────────────────────────────────────
async function handlePrefixCommand(message) {
    if (!message.content.startsWith(config.prefix) || message.author.bot) return;

    const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    const query = args.join(' ');

    try {
        // !search <titre>
        if (commandName === 'search') {
            if (!query) return message.reply('❌ Usage : `!search <titre>`');
            const results = await searchAnime(query);
            if (!results || results.length === 0) return message.reply(`❌ Aucun résultat pour **${query}**.`);
            const embed = buildSearchEmbed(results);
            return message.reply({ embeds: [embed] });
        }

        // !add <titre>
        if (commandName === 'add') {
            if (!query) return message.reply('❌ Usage : `!add <titre>`');
            const results = await searchAnime(query, 1, 1);
            if (!results || results.length === 0) return message.reply(`❌ Aucun animé trouvé pour **${query}**.`);
            const anime = results[0];
            const title = anime.title.english || anime.title.romaji;
            if (exists(anime.id)) return message.reply(`⚠️ **${title}** est déjà dans ta watchlist !`);
            add({
                id: anime.id,
                title,
                titleRomaji: anime.title.romaji,
                siteUrl: anime.siteUrl,
                addedAt: new Date().toISOString(),
                nextAiringEpisode: anime.nextAiringEpisode || null,
            });
            return message.reply(`✅ **${title}** ajouté à ta watchlist !\n🔔 Tu seras notifié des nouveaux épisodes.`);
        }

        // !remove <titre>
        if (commandName === 'remove') {
            if (!query) return message.reply('❌ Usage : `!remove <titre>`');
            const results = await searchAnime(query, 1, 1);
            if (!results || results.length === 0) return message.reply(`❌ Aucun animé trouvé pour **${query}**.`);
            const anime = results[0];
            const title = anime.title.english || anime.title.romaji;
            if (!exists(anime.id)) return message.reply(`⚠️ **${title}** n'est pas dans ta watchlist.`);
            remove(anime.id);
            return message.reply(`🗑️ **${title}** retiré de ta watchlist.`);
        }

        // !list
        if (commandName === 'list') {
            const watchlist = getAll();
            const enriched = await Promise.all(
                watchlist.map(async (a) => {
                    try {
                        const fresh = await getAnimeById(a.id);
                        return { ...a, nextAiringEpisode: fresh.nextAiringEpisode };
                    } catch { return a; }
                })
            );
            const embed = buildWatchlistEmbed(enriched);
            return message.reply({ embeds: [embed] });
        }

        // !next <titre>
        if (commandName === 'next') {
            if (!query) return message.reply('❌ Usage : `!next <titre>`');
            const results = await searchAnime(query, 1, 5); // Chercher les 5 meilleures correspondances
            if (!results || results.length === 0) return message.reply(`❌ Aucun animé trouvé pour **${query}**.`);
            
            // On cherche LA saison qui est en cours de parution (celle qui possède un prochain épisode)
            let targetAnime = results.find(r => r.nextAiringEpisode) || results[0];
            
            const anime = await getAnimeById(targetAnime.id);
            const embed = buildNextEmbed(anime, anime.nextAiringEpisode);
            return message.reply({ embeds: [embed] });
        }

        // !simuler
        if (commandName === 'simuler') {
            const channel = message.client.channels.cache.get(config.notifChannelId);
            if (!channel) return message.reply("❌ Impossible de trouver le channel de notification spécifié dans la configuration.");
            
            // Récupérer le rôle pour le ping
            const role = message.guild.roles.cache.find(r => r.name === config.animeNewsRoleName);
            const roleMention = role ? `<@&${role.id}> ` : '';

            message.reply("⏳ Déclenchement d'une simulation grandeur nature (récupération de vrais épisodes sortis aujourd'hui)...");

            // --- 1. Simulation AniList (Vrai anime d'aujourd'hui) ---
            const { buildNotifEmbed } = require('./embeds/animeEmbed');
            const axios = require('axios');
            try {
                const now = Math.floor(Date.now() / 1000);
                const from = now - (24 * 3600); // 24h en arrière
                const queryAniList = `
                    query ($from: Int, $to: Int) {
                        Page(perPage: 20) {
                            airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME_DESC) {
                                id episode airingAt timeUntilAiring
                                media { id format countryOfOrigin title { romaji english } coverImage { large color } siteUrl }
                            }
                        }
                    }
                `;
                const res = await axios.post('https://graphql.anilist.co', {
                    query: queryAniList, variables: { from, to: now }
                });
                const schedules = res.data.data.Page.airingSchedules.filter(s => s.media.format === 'TV' && s.media.countryOfOrigin === 'JP');
                
                if (schedules.length > 0) {
                    const realSchedule = schedules[0]; // Le plus récent
                    const embed = buildNotifEmbed(realSchedule, realSchedule.media);
                    await channel.send({ content: `${roleMention}📢 **[SIMULATION ANILIST]** Nouvel épisode en approche !`, embeds: [embed] });
                }
            } catch (err) {
                console.error("Erreur simulation AniList:", err.message);
            }

            // --- 2. Simulation Crunchyroll (Vrai dernier item du RSS) ---
            const { getLatestCrunchyroll } = require('./api/crunchyroll');
            const { EmbedBuilder } = require('discord.js');
            try {
                // On met le cooldown à 0 temporairement juste pour être sûr que ça passe pour le test
                const items = await getLatestCrunchyroll();
                if (items.length > 0) {
                    const item = items[0];
                    const embed = new EmbedBuilder()
                        .setColor(0xF47521)
                        .setAuthor({ name: '🟠 Crunchyroll — Simulation !' })
                        .setTitle(item.title)
                        .setURL(item.link)
                        .addFields(
                            { name: '🕐 Disponible depuis', value: `<t:${Math.floor(item.pubDate.getTime() / 1000)}:R>`, inline: true },
                            { name: '🇫🇷 Format', value: 'VOSTFR', inline: true },
                        )
                        .setTimestamp(item.pubDate);
                    if (item.image) embed.setImage(item.image);
                    
                    await channel.send({ content: `${roleMention}🟠 Crunchyroll — **[SIMULATION]** Disponible maintenant !`, embeds: [embed] });
                } else {
                    await channel.send("🟠 *Crunchyroll n'a retourné aucun item ou est bloqué (429).*");
                }
            } catch (err) {
                console.error("Erreur simulation Crunchyroll:", err.message);
            }
            return;
        }

        // !help
        if (commandName === 'help') {
            return message.reply(
                '📋 **Commandes disponibles :**\n' +
                '`!search <titre>` — Rechercher un animé\n' +
                '`!add <titre>` — Ajouter à ta watchlist\n' +
                '`!remove <titre>` — Retirer de ta watchlist\n' +
                '`!list` — Voir ta watchlist\n' +
                '`!next <titre>` — Prochain épisode countdown'
            );
        }

    } catch (err) {
        console.error(`[Prefix] Erreur sur !${commandName}:`, err.message);
        message.reply('❌ Une erreur est survenue. Réessaie dans un instant.');
    }
}

// ─── Événements ───────────────────────────────────────────────────────────────
client.once('ready', async () => {
    console.log(`\n✅ Bot connecté en tant que ${client.user.tag}`);
    console.log(`📡 Serveur ID : ${config.guildId}`);
    console.log(`📢 Channel notif : ${config.notifChannelId}`);
    console.log(`⌨️  Préfixe actif : ${config.prefix}\n`);

    await registerCommands();
    startScheduler(client, config.notifChannelId);
});

// Slash commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (err) {
        console.error(`[Interaction] Erreur sur /${interaction.commandName}:`, err.message);
        const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(msg);
        } else {
            await interaction.reply(msg);
        }
    }
});

// Commandes préfixe !
client.on('messageCreate', handlePrefixCommand);

// ─── Connexion ────────────────────────────────────────────────────────────────
client.login(config.token).catch(err => {
    console.error('❌ Impossible de se connecter à Discord:', err.message);
    process.exit(1);
});

// ─── Serveur HTTP keep-alive (requis pour le déploiement Replit) ───────────────
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is running.');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`[HTTP] Keep-alive server listening on port ${PORT}`);
});
