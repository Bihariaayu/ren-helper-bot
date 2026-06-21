# ☁️ Ren Helper - Advanced Discord Utility Bot

Ren Helper is a premium, enterprise-level Discord bot built specifically for the **Ren Cloud** ecosystem. It provides advanced invite tracking, server boost management, auto-responders, an interactive embed builder, owner-only administrative tools, and an advanced support ticket system.

> 🛠️ **Developer:** Made by **Bihariaayu_**
> 💬 **Support Discord:** [discord.rencloud.dpdns.org](https://discord.rencloud.dpdns.org)
> 🌐 **Website:** [www.rencloud.dpdns.org](http://www.rencloud.dpdns.org)

Featuring a professional hosting company aesthetic, the bot supports both prefix commands and fully integrated Slash (/) commands.

━━━━━━━━━━━━━━━━━━━━━━

## 📌 Prefix Guide
* **📊 Invite System Commands Prefix:** `-i` (e.g. `-i invites`, `-i stats`)
* **⚙️ Utility & Management Commands Prefix:** `r?` (e.g. `r?help`, `r?ticket setup`, `r?ban`)
* **💎 Slash Commands:** `/` (e.g. `/invites`, `/ticket setup`)

━━━━━━━━━━━━━━━━━━━━━━

## 🚀 Key Features

1. **Advanced Invite Tracking System**
   - Precise join/leave tracking with invite code analysis.
   - Recognizes vanity URLs and OAuth joins.
   - Detects fake accounts (created within <24 hours).
   - Milestone Invite Rewards: Automatically rewards members with roles on reaching invite goals, and revokes them if counts drop.
   
2. **Auto Response System**
   - Customizable triggers with plain text or embed replies.
   - Supports regular expressions, case-insensitive matches, channel whitelists, and cooldowns to prevent spam.
   
3. **Advanced Interactive Embed Builder**
   - High-fidelity UI using buttons and modals to create rich embed designs without code.
   - Save and send custom embeds to specific channels or via webhooks.

4. **Advanced Ticket System**
   - **Ticket Panels**: Deploy button-based panels for support tickets.
   - **Toggles Configuration**: Tweak permissions, channel naming conventions, limits, and claimable statuses using a visual config menu.
   - **Support Actions**: Claim, unclaim, transfer, rename, add/remove members, and close tickets.
   - **Detailed Logging**: Sends comprehensive log details and HTML transcripts to the logs channel upon closure.
   - **Satisfaction Surveys**: Prompts creators in DMs with star buttons (⭐ to ⭐⭐⭐⭐⭐) to rate support quality.

5. **Server Boost Tracker**
   - Welcomes boosters and displays boost count/server level.
   - Automatic Booster Role: Automatically grants a custom role when a user boosts and removes it when it expires.
   - Booster leaderboard and statistics.

6. **Owner-Only Global DM System**
   - Whitelisted DM broadcast tool that sends message/embed to all server members.
   - Includes real-time progress monitoring, rate-limit protection (1.5s delay), and an interactive cancel button.

7. **Premium Styling & UI**
   - Beautiful embed designs themed with Ren Cloud Red (`#E74C3C`) and Green (`#2ECC71`).
   - Consistent footer: `☁️ Ren Helper • Ren Cloud`.

━━━━━━━━━━━━━━━━━━━━━━

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
│   │       ├── TicketConfig.js
│   │       ├── TicketInstance.js
│   │       ├── TicketReview.js
│   │       └── TicketStaffStats.js
│   ├── handlers/
│   │   ├── commandHandler.js     # Prefix & Slash Command Loader
│   │   └── eventHandler.js       # Discord Events Loader
│   ├── utils/
│   │   ├── inviteCache.js        # In-Memory Invite Tracker Cache
│   │   ├── embedBuilder.js       # Ren Cloud Embed Visual Themes
│   │   ├── transcriptGenerator.js # HTML Transcript Compiler
│   │   └── logger.js             # Logging Utility
│   ├── commands/                 # Bot Commands (Prefix & Slash)
│   │   ├── config/               # Setup & configuration
│   │   ├── invite/               # Invite tracking & rewards
│   │   ├── autoresponse/         # Auto responders
│   │   ├── embed/                # Embed Builder
│   │   ├── booster/              # Boost tracking
│   │   ├── ticket/               # Support tickets
│   │   └── owner/                # DM broadcast (Owner only)
│   └── events/                   # Discord Events
│       ├── client/               # ready, interactionCreate
│       ├── guild/                # guildMemberAdd, messageCreate, etc.
│       └── logs/                 # Logging events handler
├── .env.example                  # Environment Variables Template
├── .env                          # Configuration Variables
├── .gitignore                    # Git Ignored Files
├── package.json                  # Dependencies Configuration
└── README.md                     # Documentation
```

━━━━━━━━━━━━━━━━━━━━━━

## 🛠️ Prerequisites

- **Node.js**: v16.9.0 or higher
- **MongoDB**: Active MongoDB database instance
- **Discord Bot Token**: A registered bot from the Discord Developer Portal with the following Gateway Intents enabled:
  - `Guild Members` (Server Members Intent)
  - `Message Content` (Message Content Intent)
  - `Guild Invites`

━━━━━━━━━━━━━━━━━━━━━━

## 🔧 Installation & Configuration

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Bihariaayu/ren-helper-bot.git
   cd ren-helper-bot
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in the values:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   MONGO_URI=mongodb+srv://...
   OWNER_IDS=your_discord_id_here
   DEFAULT_PREFIX=-i
   ```

━━━━━━━━━━━━━━━━━━━━━━

## 🚀 Running the Bot

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```
Or via PM2:
```bash
npm install pm2 -g
pm2 start src/index.js --name "Ren Helper"
```

━━━━━━━━━━━━━━━━━━━━━━

## 💬 Command Reference

Prefix commands for Invite/Booster tracking use `-i`, and all other commands use `r?`. Slash commands can be typed directly with `/`.

### ⚙️ Configuration & Setup Commands
| Command | Prefix Usage | Slash Usage | Description | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Config** | `r?config` | `/config` | Views the current server settings | Administrator |
| **Setup** | `r?setup <args>` | `/setup <subcommand>` | Set log/invite/welcome/boost channels & booster role | Administrator |

### 📊 Invite Tracking Commands
| Command | Prefix Usage | Slash Usage | Description | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Invites** | `-i invites [@user]` | `/invites [user]` | Check invite counts (net, total, left, fake, bonus) | Everyone |
| **Inviter** | `-i inviter [@user]` | `/inviter [user]` | Checks who invited the target member | Everyone |
| **Leaderboard**| `-i leaderboard [page]`| `/leaderboard [page]` | View server top inviters rankings (supports buttons) | Everyone |
| **Stats** | `-i stats` | `/stats` | Shows server member and invite counts | Everyone |
| **Analytics** | `-i analytics` | `/analytics` | View charts/retention analytics for server joins | Everyone |
| **Rewards** | `-i rewards` | `/rewards list` | Lists all configured invite reward roles | Everyone |
| **Add Reward** | `-i addreward <n> <@role>`| `/rewards add <n> <role>`| Configures a reward role milestone | Administrator |
| **Remove Reward**| `-i removereward <n>`| `/rewards remove <n>`| Removes a reward role milestone | Administrator |
| **Reset Invites**| `-i resetinvites <@user/all>`| `/resetinvites` | Resets invite counts | Administrator |
| **Set Channel** | `-i setinvitechannel #c`| `/setinvitechannel` | Sets invite join/leave tracking channel | Administrator |
| **Remove Channel**| `-i removeinvitechannel`| `/removeinvitechannel`| Disables the invite tracking channel | Administrator |

### 🤖 Auto Response Commands
| Command | Prefix Usage | Slash Usage | Description | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Create AR** | `r?ar create <trig> \| <resp> [cd]` | `/autoresponse create` | Configures a text trigger response | Administrator |
| **Delete AR** | `r?ar delete <trig>` | `/autoresponse delete` | Deletes an auto-response trigger | Administrator |
| **List ARs** | `r?ar list` | `/autoresponse list` | Lists all auto-responses in the server | Administrator |

### 🎨 Embed Builder Commands
| Command | Prefix Usage | Slash Usage | Description | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Create Embed**| `r?embed create` | `/embed create` | Launches the interactive visual embed builder panel| Authorized |
| **Send Embed** | `r?embed send <id> #chan`| `/embed send <id> <chan>`| Sends a saved custom embed to a channel | Authorized |
| **Delete Embed**| `r?embed delete <id>` | *N/A* | Deletes a saved custom embed from the database | Authorized |

### 🎫 Ticket System Commands
| Command | Prefix Usage | Slash Usage | Description | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Ticket Setup** | `r?ticket setup` | `/ticket setup` | Interactive button panel configuration for tickets | Administrator |
| **Ticket Config**| `r?ticket config` | `/ticket config` | Access toggle configuration panel (red/green buttons) | Administrator |
| **Set Ticket Logs**| `r?setticketlogs #c`| `/setticketlogs <c>`| Set the ticket log channel for transcripts/close logs | Administrator |
| **Ticket Logs** | `r?ticketlogs` | `/ticketlogs` | View the currently configured ticket log channel | Administrator |
| **Create Ticket**| `r?ticket create` | `/ticket create` | Manually open a new ticket channel for yourself | Everyone |
| **Close Ticket** | `r?ticket close [r]`| `/ticket close [r]` | Initiates close sequence with reason and transcript | Authorized |
| **Claim Ticket** | `r?ticket claim` | `/ticket claim` | Claim the ticket to assist the creator | Support Staff |
| **Unclaim Ticket**| `r?ticket unclaim`| `/ticket unclaim`| Release a claimed ticket | Support Staff |
| **Transfer Ticket**| `r?ticket transfer @s`| `/ticket transfer <s>`| Reassign ticket to another staff member | Support Staff |
| **Add Member** | `r?ticket add @u` | `/ticket add <u>` | Give a user view and write permissions in ticket | Support Staff |
| **Remove Member**| `r?ticket remove @u`| `/ticket remove <u>`| Revoke a user's permissions in the ticket | Support Staff |
| **Rename Ticket**| `r?ticket rename <n>`| `/ticket rename <n>`| Rename the ticket channel | Support Staff |
| **Transcript** | `r?ticket transcript`| `/ticket transcript`| Generate and send current ticket HTML transcript | Support Staff |
| **Ticket Info** | `r?ticket info` | `/ticket info` | Show metadata, creator, and staff info of ticket | Everyone |
| **Ticket Stats** | `r?ticket stats` | `/ticket stats` | View general ticket counts (open, closed, claimed) | Everyone |
| **Leaderboard** | `r?ticket leaderboard`| `/ticket leaderboard`| View top support staff ticket rankings | Everyone |
| **Reviews** | `r?ticket reviews` | `/ticket reviews` | View user satisfaction ratings (1-5 stars) | Everyone |

### 🚀 Booster Tracking Commands
| Command | Prefix Usage | Slash Usage | Description | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Boosts** | `-i boosts [@user]` | `/boosts [user]` | View active/total boost counts and duration | Everyone |
| **Boost Leaderboard**| `-i boostleaderboard [page]`| `/boostleaderboard` | View ranking of server boosters | Everyone |
| **Set Role** | `-i setboosterrole @role`| `/boosterrole set <role>`| Configures booster role given automatically | Administrator |
| **Remove Role** | `-i removeboosterrole`| `/boosterrole remove` | Disables automated booster role feature | Administrator |
| **Set Channel** | `-i setboostchannel #chan`| `/setboostchannel <chan>`| Sets channel for booster notification cards | Administrator |

### 👮 Moderation Commands
| Command | Prefix Usage | Slash Usage | Description | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Ban** | `r?ban @user [reason]` | `/ban <user> [reason]` | Bans a member from the server | Ban Members |
| **Unban** | `r?unban <userId> [reason]`| `/unban <userid> [reason]`| Unbans a user using their ID | Ban Members |
| **Kick** | `r?kick @user [reason]` | `/kick <user> [reason]` | Kicks a member from the server | Kick Members |
| **Timeout** | `r?timeout @user <min> [r]`| `/timeout <user> <min> [r]`| Times out a member | Moderate Members |
| **Untimeout**| `r?untimeout @user [r]` | `/untimeout <user> [r]` | Removes a member timeout | Moderate Members |
| **Mute** | `r?mute @user [reason]` | `/mute <user> [reason]` | Mutes a member using Muted role | Manage Roles |
| **Unmute** | `r?unmute @user [reason]` | `/unmute <user> [reason]` | Unmutes a member | Manage Roles |
| **Warn** | `r?warn @user <reason>` | `/warn <user> <reason>` | Warns a member and saves case | Moderate Members |
| **Warnings** | `r?warnings [@user]` | `/warnings list/clear` | Views/clears user warning cases | Moderate Members |
| **Clear** | `r?clear <1-100>` | `/clear <1-100>` | Clears messages from channel | Manage Messages |
| **Lock** | `r?lock [reason]` | `/lock [reason]` | Locks the current channel | Manage Channels |
| **Unlock** | `r?unlock [reason]` | `/unlock [reason]` | Unlocks the current channel | Manage Channels |
| **Give Role**| `r?giverole @user @role` | `/giverole <user> <role>` | Grants a role to a member | Manage Roles |
| **Remove Role**| `r?removerole @user @role` | `/removerole <user> <role>`| Removes a role from a member | Manage Roles |
| **Nickname** | `r?nickname @user [nick]` | `/nickname <user> [nick]` | Sets or resets a user nickname | Manage Nicknames |
| **User Info**| `r?userinfo [@user]` | `/userinfo [user]` | Displays detailed user profile | Everyone |

### 👑 Owner Only Commands
| Command | Prefix Usage | Slash Usage | Description | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **DM All** | `r?dmall <msg>` / `embed:<id>` | `/dmall [msg] [embed_id]`| Broadcast message/embed to everyone (supports Cancel) | Bot Owners |
| **Set Status** | `r?setstatus <st> <ty> <name>`| `/setstatus <st> <ty> <name>`| Changes bot presence and status globally | Bot Owners |
