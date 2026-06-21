# ☁️ Ren Helper — Advanced Discord Utility Bot

<div align="center">

![Ren Helper](https://img.shields.io/badge/Ren%20Helper-Discord%20Bot-E74C3C?style=for-the-badge&logo=discord&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-v16.9%2B-2ECC71?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

**Premium Discord bot built for the Ren Cloud ecosystem.**

[🌐 Website](http://www.rencloud.dpdns.org) • [💬 Support Server](https://discord.rencloud.dpdns.org) • [🐙 GitHub](https://github.com/Bihariaayu/ren-helper-bot)

</div>

---

> 🛠️ **Developer:** Made by **Bihariaayu_**
> 💬 **Support Discord:** [discord.rencloud.dpdns.org](https://discord.rencloud.dpdns.org)
> 🌐 **Website:** [www.rencloud.dpdns.org](http://www.rencloud.dpdns.org)

---

## 📌 Prefix Guide

| Prefix | Usage |
|:---|:---|
| `-i` | Invite System & Booster commands (e.g. `-i invites`, `-i boosts`) |
| `r?` | Utility, Moderation & Payment commands (e.g. `r?upi`, `r?ban`) |
| `/` | Slash Commands — all commands have a `/` equivalent |

---

## 🚀 Key Features

### 💳 Automated Payment Verification System (Ren Money)
- **QR Code Generation** for UPI, PayPal, and 8 cryptocurrencies
- **Target user support** — generate QR for another user: `r?upi 100 @user`
- **📸 Upload Payment Proof** button on every QR — opens a Discord modal
- **Screenshot privacy** — automatically removes proof from chat after capture
- **Full payment log embeds** in a designated staff channel showing:
  - Who submitted the proof (payer)
  - Who the QR was generated for (target user)
  - Who generated the QR (staff/admin)
  - Screenshot image embedded directly in the log
- **✅ Approve / ❌ Reject** buttons for staff with one-click verification
- **Auto DM** to the customer on approval or rejection with reason
- **Approval notification** sent to the original channel: *"Your payment got approved. Wait for your order, our staff will message you shortly."*
- Duplicate screenshot detection and double-submission prevention

### 💱 Currency & Crypto Converters
- Real-time fiat conversion: `r?convert 100 USD INR`
- Crypto price lookup: `r?crypto BTC` (live price, market cap, 24h change)
- Crypto-to-fiat conversion: `r?cryptoconvert 0.5 BTC USD`

### 📊 Advanced Invite Tracking System
- Precise join/leave tracking with invite code analysis
- Recognizes vanity URLs and OAuth joins
- Detects fake accounts (created < 24 hours ago)
- **Milestone Invite Rewards** — automatically grants/revokes roles on invite goals

### 🎉 Giveaway System
- Button-based giveaway entry
- Role whitelist & net invite requirements
- Weighted entry multipliers for specific roles
- Auto-scheduler (every 30s) for automatic end, winner selection, and announcements

### 🤖 Auto Response System
- Customizable keyword/phrase triggers
- Plain text or embed replies
- Channel whitelists and cooldown timers

### 🎨 Interactive Embed Builder
- No-code visual embed design using buttons and modals
- Save and deploy embeds to any channel

### 🚀 Server Boost Tracker
- Welcomes boosters with a styled notification card
- Automatic booster role grant/revoke
- Booster leaderboard and statistics

### 👮 Full Moderation Suite
- Ban, Unban, Kick, Mute, Unmute, Timeout, Warn, Clear, Lock, Unlock
- Role management, Nickname management, User Info

### 👑 Owner-Only Tools
- **DM Broadcast** — send a message or embed to every server member
- **Bot Status** — change bot presence globally

---

## 📂 Directory Structure

```
ren-helper/
├── src/
│   ├── index.js                  # Bot Entrypoint
│   ├── config.js                 # Environment Config Loader
│   ├── database/
│   │   ├── connect.js            # Mongoose MongoDB Connection
│   │   └── models/               # MongoDB Database Schemas
│   │       ├── GuildConfig.js
│   │       ├── MemberInvite.js
│   │       ├── MemberJoinInfo.js
│   │       ├── AutoResponse.js
│   │       ├── CustomEmbed.js
│   │       ├── BoosterStats.js
│   │       ├── Payment.js        # Payment records with target/requester tracking
│   │       ├── PaymentConfig.js
│   │       ├── Warning.js
│   │       └── Giveaway.js
│   ├── handlers/
│   │   ├── commandHandler.js     # Prefix & Slash Command Loader
│   │   └── eventHandler.js       # Discord Events Loader
│   ├── utils/
│   │   ├── inviteCache.js        # In-Memory Invite Tracker Cache
│   │   ├── embedBuilder.js       # Ren Cloud Embed Visual Themes
│   │   ├── giveawayManager.js    # Giveaway Schedulers & Winner Pickers
│   │   └── logger.js             # Logging Utility
│   ├── commands/
│   │   ├── config/               # Setup & configuration
│   │   ├── invite/               # Invite tracking & rewards
│   │   ├── autoresponse/         # Auto responders
│   │   ├── embed/                # Embed Builder
│   │   ├── booster/              # Boost tracking
│   │   ├── money/                # Payment QRs, configs, conversions (Ren Money)
│   │   ├── giveaway/             # Giveaway commands
│   │   └── owner/                # DM broadcast (Owner only)
│   └── events/
│       ├── client/               # ready, interactionCreate
│       └── guild/                # guildMemberAdd, messageCreate, reactions, etc.
├── .env.example                  # Environment Variables Template
├── .env                          # Configuration Variables (not committed)
├── .gitignore
├── package.json
└── README.md
```

---

## 🛠️ Prerequisites

- **Node.js** v16.9.0 or higher
- **MongoDB** — active Atlas or local instance
- **Discord Bot Token** from the [Discord Developer Portal](https://discord.com/developers/applications) with the following Gateway Intents enabled:
  - ✅ `Server Members Intent`
  - ✅ `Message Content Intent`
  - ✅ `Guild Invites`
  - ✅ `Guild Message Reactions`

---

## 🔧 Installation & Configuration

**1. Clone the repository:**
```bash
git clone https://github.com/Bihariaayu/ren-helper-bot.git
cd ren-helper-bot
```

**2. Install Dependencies:**
```bash
npm install
```

**3. Configure Environment Variables:**

Copy `.env.example` to `.env` and fill in your values:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/ren-helper
OWNER_IDS=your_discord_user_id_here
```

---

## 🚀 Running the Bot

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Production with PM2 (recommended)
```bash
npm install pm2 -g
pm2 start src/index.js --name "Ren Helper"
pm2 save
```

---

## 💬 Command Reference

### ⚙️ Configuration & Setup
| Command | Prefix | Slash | Description | Permission |
|:---|:---|:---|:---|:---|
| Config | `r?config` | `/config` | View current server settings | Administrator |
| Setup | `r?setup` | `/setup` | Set log/welcome/boost channels | Administrator |
| Help | `r?help` | `/help` | Interactive dropdown help menu | Everyone |
| Ping | `r?ping` | `/ping` | Check bot latency | Everyone |
| Server Info | `r?serverinfo` | `/serverinfo` | View server details | Everyone |
| Member Count | `r?membercount` | `/membercount` | View member statistics | Everyone |

---

### 💳 Payment System (Ren Money)

> **New:** All payment commands support generating a QR for another user with `@mention`.

| Command | Prefix | Slash | Description | Permission |
|:---|:---|:---|:---|:---|
| UPI Payment | `r?upi [amount] [@user]` | `/upi` | Generate UPI QR (optionally for another user) | Everyone |
| PayPal Payment | `r?paypal [amount] [@user]` | `/paypal` | Generate PayPal.me QR | Everyone |
| Crypto Payment | `r?cryptopay <coin> <amt> [@user]` | `/cryptopay` | Generate crypto wallet QR | Everyone |
| Setup UPI | `r?setupupi <upi-id> [name]` | `/setupupi` | Configure merchant UPI ID | Administrator |
| Setup PayPal | `r?setuppaypal <username>` | `/setuppaypal` | Configure PayPal.me handle | Administrator |
| Setup Crypto | `r?setupcrypto <coin> <address>` | `/setupcrypto` | Configure crypto wallet address | Administrator |
| Set Pay Channel | `r?setpaymentchannel #chan` | `/paymentchannel set` | Set staff payment review channel | Administrator |
| Payment History | `r?payments` / `r?paymenthistory` | `/payments history` | View payment submission history | Everyone |
| Payment Info | `r?paymentinfo <id>` | `/payments info` | Look up a specific payment by ID | Everyone |
| Payment Stats | `r?paymentstats` | `/paymentstats` | View revenue analytics | Manage Server |

**Payment Flow:**
```
r?upi 100 @Ayu
  └─► QR embed with 📸 Confirm Payment button
        └─► Modal (Tx ID, Notes — amount pre-filled, non-editable)
              └─► Bot asks user to upload screenshot
                    └─► Screenshot downloaded → user message deleted for privacy
                          └─► Rich log embed sent to staff channel with screenshot
                                ├─► 📸 Submitted By: payer
                                ├─► 🎯 Payment For: @Ayu
                                ├─► 🧑‍💼 QR Generated By: requester
                                └─► ✅ Approve / ❌ Reject buttons
                                      └─► Customer DM + channel notification on result
```

---

### 💱 Currency & Crypto Commands
| Command | Prefix | Slash | Description | Permission |
|:---|:---|:---|:---|:---|
| Convert | `r?convert <amt> <from> <to>` | `/convert` | Live fiat currency conversion | Everyone |
| Crypto Price | `r?crypto <coin>` | `/crypto` | Live crypto price & market info | Everyone |
| Crypto Convert | `r?cryptoconvert <amt> <coin> <to>` | `/cryptoconvert` | Convert crypto to fiat | Everyone |

---

### 📊 Invite Tracking
| Command | Prefix | Slash | Description | Permission |
|:---|:---|:---|:---|:---|
| Invites | `-i invites [@user]` | `/invites` | View invite counts | Everyone |
| Inviter | `-i inviter [@user]` | `/inviter` | Who invited this member | Everyone |
| Leaderboard | `-i leaderboard` | `/leaderboard` | Top inviters ranking | Everyone |
| Stats | `-i stats` | `/stats` | Server join/invite metrics | Everyone |
| Analytics | `-i analytics` | `/analytics` | Join/leave retention charts | Everyone |
| Rewards | `-i rewards` | `/rewards list` | List invite reward milestones | Everyone |
| Add Reward | `-i addreward <n> @role` | `/rewards add` | Create invite reward milestone | Administrator |
| Remove Reward | `-i removereward <n>` | `/rewards remove` | Delete a milestone | Administrator |
| Reset Invites | `-i resetinvites <@user/all>` | `/resetinvites` | Reset invite data | Administrator |
| Set Channel | `-i setinvitechannel #chan` | `/setinvitechannel` | Join/leave log channel | Administrator |

---

### 🎉 Giveaways
| Command | Prefix | Slash | Description | Permission |
|:---|:---|:---|:---|:---|
| Start | `r?giveaway start <dur> <winners> <prize>` | `/ga start` | Start a giveaway | Manage Server |
| End | `r?giveaway end <msgId>` | `/ga end` | Force-end a giveaway | Manage Server |
| Reroll | `r?giveaway reroll <msgId>` | `/ga reroll` | Pick new winners | Manage Server |
| Delete | `r?giveaway delete <msgId>` | — | Delete a giveaway | Manage Server |

---

### 🚀 Booster Tracking
| Command | Prefix | Slash | Description | Permission |
|:---|:---|:---|:---|:---|
| Boosts | `-i boosts [@user]` | `/boosts` | View boost count & duration | Everyone |
| Boost Leaderboard | `-i boostleaderboard` | `/boostleaderboard` | Top boosters ranking | Everyone |
| Set Boost Role | `-i setboosterrole @role` | `/boosterrole set` | Auto booster role | Administrator |
| Remove Boost Role | `-i removeboosterrole` | `/boosterrole remove` | Disable booster role | Administrator |
| Set Boost Channel | `-i setboostchannel #chan` | `/setboostchannel` | Boost notification channel | Administrator |

---

### 🤖 Auto Response
| Command | Prefix | Slash | Description | Permission |
|:---|:---|:---|:---|:---|
| Create | `r?ar create <trigger> \| <response>` | `/autoresponse create` | Add a text trigger | Administrator |
| Edit | `r?ar edit <trigger> \| <response>` | `/autoresponse edit` | Edit a trigger response | Administrator |
| Delete | `r?ar delete <trigger>` | `/autoresponse delete` | Remove a trigger | Administrator |
| List | `r?ar list` | `/autoresponse list` | List all triggers | Administrator |

---

### 🎨 Embed Builder
| Command | Prefix | Slash | Description | Permission |
|:---|:---|:---|:---|:---|
| Create | `r?embed create` | `/embed create` | Launch visual embed designer | Authorized |
| Send | `r?embed send <id> #chan` | `/embed send` | Deploy saved embed to channel | Authorized |
| Delete | `r?embed delete <id>` | — | Remove saved embed | Authorized |

---

### 👮 Moderation
| Command | Prefix | Slash | Permission |
|:---|:---|:---|:---|
| Ban | `r?ban @user [reason]` | `/ban` | Ban Members |
| Unban | `r?unban <userId>` | `/unban` | Ban Members |
| Kick | `r?kick @user [reason]` | `/kick` | Kick Members |
| Timeout | `r?timeout @user <duration> [reason]` | `/timeout` | Moderate Members |
| Untimeout | `r?untimeout @user` | `/untimeout` | Moderate Members |
| Mute | `r?mute @user [reason]` | `/mute` | Manage Roles |
| Unmute | `r?unmute @user` | `/unmute` | Manage Roles |
| Warn | `r?warn @user <reason>` | `/warn` | Moderate Members |
| Warnings | `r?warnings [@user]` | `/warnings` | Moderate Members |
| Clear | `r?clear <1-100>` | `/clear` | Manage Messages |
| Lock | `r?lock` | `/lock` | Manage Channels |
| Unlock | `r?unlock` | `/unlock` | Manage Channels |
| Give Role | `r?giverole @user @role` | `/giverole` | Manage Roles |
| Remove Role | `r?removerole @user @role` | `/removerole` | Manage Roles |
| Nickname | `r?nickname @user [nick]` | `/nickname` | Manage Nicknames |
| User Info | `r?userinfo [@user]` | `/userinfo` | Everyone |

---

### 👑 Owner Only
| Command | Prefix | Slash | Description |
|:---|:---|:---|:---|
| DM All | `r?dmall <msg>` | `/dmall` | Broadcast to all server members |
| Set Status | `r?setstatus <status> <type> <name>` | `/setstatus` | Change bot presence globally |

---

## 🎨 Design Theme

| Element | Value |
|:---|:---|
| 🔴 Ren Cloud Red | `#E74C3C` |
| 🟢 Ren Cloud Green | `#2ECC71` |
| ⬛ Dark Background | `#1A1A2E` |
| Footer | `☁️ Ren Helper • Ren Cloud` |

---

## 📄 License

This project is private and proprietary to **Ren Cloud**. All rights reserved.

---

<div align="center">
Made with ❤️ by <b>Bihariaayu_</b> for <b>Ren Cloud</b>
</div>
