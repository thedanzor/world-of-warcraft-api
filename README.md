# Guild API Server

A Node.js Express API server that fetches and processes World of Warcraft guild data from the Battle.net API.
Project created by Scott Jones (Holybarry-sylvanas) of scottjones.nl

## License

This project is licensed under the Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License (CC BY-NC-ND 4.0).

You are free to use and adapt the code for personal and non-commercial purposes, but you may not redistribute, sublicense, or use it for commercial purposes. No derivative works or modifications may be distributed.

See [LICENSE](https://creativecommons.org/licenses/by-nc-nd/4.0/) for full details. 

## Requirements

### Core Requirements

- **Node.js**: Version 20 or higher is required. [Download Node.js](https://nodejs.org/en/download/)
- **npm** or **Yarn**: Comes with Node.js, but you can also [install Yarn](https://classic.yarnpkg.com/en/docs/install/) if preferred.
- **ExpressJS**: Installed automatically via dependencies, but see [Express documentation](https://expressjs.com/).
- **MongoDB**: You need access to a MongoDB instance (local or cloud). [Install MongoDB locally](https://www.mongodb.com/try/download/community) or use [MongoDB Atlas (cloud)](https://www.mongodb.com/cloud/atlas).

### Additional Dependencies

- **dotenv**: For environment variable management (auto-installed)
- **ws**: For WebSocket support (auto-installed)
- **Other dependencies**: See `package.json` for a full list.

### Setting Up for Different Environments

#### Local Development
1. Install [Node.js 20+](https://nodejs.org/en/download/).
2. Install [MongoDB Community Edition](https://www.mongodb.com/try/download/community) and ensure it is running locally, or set up a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster.
3. Clone this repository and run:
   ```bash
   yarn install
   # or
   npm install
   ```
4. Create a `.env` file in the project root (see the example in this README).
5. Start the server:
   ```bash
   yarn dev
   # or
   npm dev
   ```
6. For local developement change the host to 'localhost' instead of '0.0.0.0'

#### Production Deployment
- Use a process manager like [PM2](https://pm2.keymetrics.io/) for running in production.
- Ensure environment variables are set securely.
- Use a production-ready MongoDB instance (Atlas or managed service).

#### Windows, macOS, Linux
- The project is cross-platform. Follow the [Node.js installation guide](https://nodejs.org/en/download/) and [MongoDB installation guide](https://www.mongodb.com/docs/manual/installation/) for your OS.

---

## Features

- **REST API Endpoints** for guild data management
- **Real-time WebSocket Updates** for progress monitoring
- ~~Docker Containerization with persistent storage~~
- **Battle.net API Integration** for guild roster and character data
- **Comprehensive Data Collection** (Raid, Mythic+, PvP)
- **Modular Codebase**: Endpoints and utilities are split into separate files for maintainability

> **Note:** We do advise using docker if you're composing this service with another.

## Environment Variables (.env)

Create a `.env` file in your project root with the following keys:

```
MONGODB=mongodb://
DATABASE_NAME=xxxxx
SIGNUP_COLLECTION=xxxxx
MEMBERS_COLLECTION_NAME=xxxxx

PORT=8000
HOST=0.0.0.0

API_BATTLENET_KEY=xxxxx
API_BATTLENET_SECRET=xxxxx
GUILD_NAME=xxxxx
GUILD_REALM=xxxxx
REGION=xxxxx
API_PARAM_REQUIREMENTGS=xxxxx
```

## Configuration File: `app.config.js`

This is the application config file, this allows you to specify specifics for your guild, such as name, realm, item level, rank named and more.

```js
const data = {
  // The following values are loaded from environment variables for your safety
  API_BATTLENET_KEY: process.env.API_BATTLENET_KEY,
  API_BATTLENET_SECRET: process.env.API_BATTLENET_SECRET,
  GUILD_NAME: process.env.GUILD_NAME,
  GUILD_REALM: process.env.GUILD_REALM,
  REGION: process.env.REGION,
  API_PARAM_REQUIREMENTGS: process.env.API_PARAM_REQUIREMENTGS,

  // Change the below settings that are specific to your guild and needs
  LEVEL_REQUIREMENT: 80,
  GUILD_RANK_REQUIREMENT: [0,1,2,3,4,5,6,7,8,9,10],
  ITEM_LEVEL_REQUIREMENT: 440,
  MIN_CHECK_CAP: 640,
  MAX_CHECK_CAP: 720,
  MIN_TIER_ITEMLEVEL: 640,
  ENCHANTABLE_PIECES: ["WRIST", "LEGS", "FEET", "CHEST", "MAIN_HAND", "FINGER_1", "FINGER_2"],
  MAIN_RANKS: [0,1,2,3,4,5,6,7],
  ALT_RANKS: [8,9,10],
  TANKS: ["Blood", "Vengeance", "Guardian", "Brewmaster", "Protection"],
  HEALERS: ["Preservation", "Mistweaver", "Holy", "Discipline", "Restoration"],
  DIFFICULTY: ["Mythic", "Heroic", "Normal"],
  _DRAFT_DIFFICULTY: ["LFR", "Raid Finder", "Mythic", "Heroic", "Normal"],
  GUILLD_RANKS: [
    "Guild Lead",
    "Officer",
    "Officer Alt",
    "Cunt",
    "Muppet",
    "Raider",
    "Trial Raider",
    "Member",
    "Alt",
    "New Recruit"
  ],
  CURRENT_SEASON_TIER_SETS: [
    "Cauldron Champion's Encore",
    "Roots of Reclaiming Blight",
    "Fel-Dealer's Contraband",
    "Opulent Treasurescale's Hoard",
    "Tireless Collector's Bounties",
    "Jewels of the Aspectral Emissary",
    "Ageless Serpent's Foresight",
    "Oath of the Aureate Sentry",
    "Confessor's Unshakable Virtue",
    "Spectral Gambler's Last Call",
    "Currents of the Gale Sovereign",
    "Spliced Fiendtrader's Influence",
    "Underpin Strongarm's Muscle"
  ]
};

export default data;
```

## API Endpoints

All endpoints are modular and documented with JSDoc in the codebase. Here are the main endpoints and their responses:

### GET `/data`
Returns the current guild data and statistics.

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "statistics": {
    "totalMembers": 30,
    "missingEnchants": 5,
    "raidLocked": 2,
    "avgTopMplus": 2500,
    "avgTopPvp": 1800,
    "roleCounts": { "tanks": 3, "healers": 5, "dps": 22 },
    "topPvp": [ ... ],
    "topPve": [ ... ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET `/data/filtered`
Returns filtered and paginated guild data.

**Query Parameters:**
- `filter`, `page`, `limit`, `search`, `rankFilter`, `classFilter`, `specFilter`, `minItemLevel`

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "statistics": {
    "totalItems": 30,
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 30,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "filter": "all",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET `/stats/missing-enchants`
Returns statistics for missing enchants.

**Response:**
```json
{
  "success": true,
  "data": {
    "all": 5,
    "mains": 2,
    "alts": 3
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET `/stats/top-pvp`
Returns top 5 PvP players.

**Response:**
```json
{
  "success": true,
  "data": [
    { "name": "Player1", "rating": 2100, ... },
    ...
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET `/stats/top-pve`
Returns top 5 Mythic+ players.

**Response:**
```json
{
  "success": true,
  "data": [
    { "name": "Player1", "score": 3200, ... },
    ...
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET `/stats/role-counts`
Returns role distribution statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "tanks": 3,
    "healers": 5,
    "dps": 22,
    "total": 30
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST `/update`
Starts a guild data update process.

**Request Body:**
```json
{
  "dataTypes": ["raid", "mplus", "pvp"]
}
```
**Response:**
```json
{
  "success": true,
  "message": "Guild update process started",
  "processId": "1234567890",
  "dataTypes": ["raid", "mplus", "pvp"]
}
```

### GET `/status`
Returns the status of active update processes.

**Response:**
```json
{
  "success": true,
  "activeProcesses": 1,
  "processes": ["1234567890"]
}
```

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "success": true,
  "status": "ready",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "cronEnabled": true,
  "nextScheduledUpdate": "2024-01-01T00:30:00.000Z",
  "dataStatus": "ready",
  "hasGuildData": true,
  "memberCount": 30
}
```

### GET `/api/season3/data`
Returns all Season 3 signups.

**Response:**
```json
{
  "success": true,
  "season3": [ ... ],
  "totalMembers": 10,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST `/api/season3/signup`
Handles Season 3 signup submissions.

**Request Body:**
```json
{
  "discordName": "User#1234",
  "currentCharacterName": "Char1",
  "season3CharacterName": "Char2",
  "characterClass": "Mage",
  "mainSpec": "Frost"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Signup submitted successfully",
  "season3": {
    "discordName": "User#1234",
    "currentCharacterName": "Char1",
    "season3CharacterName": "Char2",
    "characterClass": "Mage",
    "mainSpec": "Frost",
    "offSpec": "",
    "returningToRaid": false,
    "season3Goal": "",
    "wantToPushKeys": false,
    "submittedAt": "2024-01-01T00:00:00.000Z",
    "id": "abc123"
  }
}
```

## WebSocket Events

Connect to the WebSocket server to receive real-time progress updates:

```javascript
const socket = io('http://localhost:3000');

socket.on('guild-update-progress', (data) => {
  console.log('Progress update:', data);
  // data contains: { processId, type, data, timestamp }
});
```

### Progress Event Types

- `start` - Process started
- `auth` - Authentication status
- `guild-fetch` - Guild roster fetching
- `member-processing` - Individual member processing
- `final-processing` - Final data processing
- `statistics` - Statistics generation
- `saving` - File saving
- `git` - Git operations
- `complete` - Process completed
- `error` - Error occurred
