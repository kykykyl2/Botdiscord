# 🎌 Bot Discord Anime VOSTFR/VF

Bot Discord personnel qui envoie des notifications automatiques pour les nouveaux épisodes d'animés en **VOSTFR** et **VF**, via l'**AniList API**.

## ✨ Fonctionnalités

- 🔔 **Notifications automatiques** toutes les heures pour les épisodes de ta watchlist
- 📺 **Embeds stylés** avec image, heure de diffusion, badge VOSTFR/VF
- 🔍 **5 commandes slash** pour gérer tes animés

## 📋 Commandes

| Commande | Description |
|---|---|
| `/search <titre>` | Rechercher un animé sur AniList |
| `/add <titre>` | Ajouter un animé à ta watchlist |
| `/remove <titre>` | Retirer un animé de ta watchlist |
| `/list` | Voir tous tes animés suivis |
| `/next <titre>` | Voir le countdown du prochain épisode |

## 🚀 Installation

### 1. Prérequis
- [Node.js](https://nodejs.org/) v18 ou supérieur
- Un bot Discord ([Discord Developer Portal](https://discord.com/developers/applications))

### 2. Configuration du bot Discord
1. Va sur le [Discord Developer Portal](https://discord.com/developers/applications)
2. Crée une application → Bot → Active les intents `applications.commands`
3. Invite le bot sur ton serveur avec les permissions `Send Messages`, `Embed Links`, `Use Slash Commands`

### 3. Variables d'environnement
Copie `.env.example` en `.env` et remplis les valeurs :

```env
DISCORD_TOKEN=ton_token_bot
CLIENT_ID=id_de_ton_application
GUILD_ID=id_de_ton_serveur
NOTIF_CHANNEL_ID=id_du_channel_de_notifs
```

### 4. Installer les dépendances

```bash
npm install
```

### 5. Lancer le bot

```bash
npm start
```

## 📁 Structure

```
src/
├── index.js          # Point d'entrée + enregistrement des commandes
├── config.js         # Variables d'environnement
├── scheduler.js      # Cron job notifications (toutes les heures)
├── api/
│   └── anilist.js    # Client AniList GraphQL
├── db/
│   └── watchlist.js  # Watchlist locale (JSON)
├── embeds/
│   └── animeEmbed.js # Constructeurs d'embeds Discord
└── commands/
    ├── search.js
    ├── add.js
    ├── remove.js
    ├── list.js
    └── next.js
data/
└── watchlist.json    # Données de la watchlist (auto-géré)
```

## ℹ️ Comment les notifications fonctionnent

Le bot vérifie chaque heure via l'API AniList si un épisode des animés de ta watchlist aire dans la prochaine heure. Si c'est le cas, il envoie un embed dans le channel configuré avec les détails de l'épisode.

> Les plateformes de diffusion (ADN, Crunchyroll, Netflix) publient généralement les épisodes VOSTFR dans l'heure suivant la diffusion japonaise.
