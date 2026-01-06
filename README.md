# Guild API Server

A Node.js Express API server that fetches and processes World of Warcraft guild data from the Battle.net API.
Project created by Scott Jones (Holybarry-sylvanas) of scottjones.nl

## Version 2.0 Changelog 🆕

### Major Features
- **Dynamic Join/Recruitment Content API**: Complete system for managing guild recruitment page content
- **Guided Installation System**: Complete installation wizard with step-by-step configuration
- **Admin Authentication System**: Secure admin authentication for protected routes
- **Database-Based Configuration**: App settings stored in MongoDB instead of environment variables
- **Settings Management API**: Admin-only endpoints for viewing and updating app settings
- **Database Reset Functionality**: Ability to reset database collections while preserving critical settings
- **Protected Fields**: Guild name, realm, and API credentials protected from modification

### New Endpoints
- **GET `/api/jointext`** - Get join page content (public endpoint)
- **PUT `/api/jointext`** - Update join page content (admin only, Basic Auth required)
- **POST `/api/jointext/seed`** - Seed database with example join content (admin only)
- **GET `/api/install`** - Check installation status and get default configuration
- **POST `/api/install`** - Save app settings with Battle.net API validation
- **POST `/api/install/login`** - Admin authentication for protected routes
- **POST `/api/install/admin`** - Create admin account with password strength validation
- **GET `/api/settings`** - Get app settings (admin only, includes sensitive data)
- **PUT `/api/settings`** - Update app settings (admin only, protected fields excluded)
- **POST `/api/reset`** - Reset database collections (admin only)
- **GET `/api/reset/info`** - Get information about what will be reset

### Configuration Changes
- **Database Storage**: App settings now stored in MongoDB `AppSettings` collection
- **Environment Variables**: Reduced reliance on environment variables for configuration
- **app.config.js**: Now serves as fallback/default values source
- **Protected Fields**: Guild name, realm, and API credentials cannot be changed after initial setup
- **Runtime Configuration**: Settings loaded from database at runtime with fallback to app.config.js

### Installation Process
- **Step-by-Step Wizard**: Guided installation through frontend interface
- **API Validation**: Real-time Battle.net API credential validation
- **Guild Verification**: Automatic verification of guild name and realm
- **Admin Account Creation**: Secure admin account setup with password requirements
- **Installation Status Tracking**: Track installation progress and completion

### Security Enhancements
- **Admin Authentication**: Basic Auth for protected endpoints
- **Password Hashing**: bcrypt password hashing for admin accounts
- **Security Logging**: Failed authentication attempts logged
- **Field Protection**: Server-side protection of critical configuration fields
- **Session Management**: Client-side session storage for authentication state

### Join/Recruitment Content Management
- **Flexible Content Structure**: Section-based system with nested blocks for maximum flexibility
- **Hero Section**: Customizable hero with title, subtitle, and colored badges (gold/blue/green)
- **Block Types**:
  - **Text Blocks**: Rich text content with title and body
  - **List Blocks**: Bullet-pointed lists for requirements, schedules, benefits
  - **Contact Blocks**: Discord and email contact information
- **Layout System**: Each block can be positioned as full-width, left-half, or right-half
- **Content Validation**: Server-side validation of all content structure and required fields
- **Seed Data**: Default example content provided for new installations
- **Database Integration**: All content stored in MongoDB with efficient retrieval
- **Caching Strategy**: No-cache headers ensure fresh content delivery
- **Content Structure**:
  ```json
  {
    "hero": {
      "title": "Join Our Guild",
      "subtitle": "Description text",
      "badges": [
        { "label": "Active Community", "color": "gold" }
      ]
    },
    "sections": [
      {
        "id": "section-1",
        "order": 0,
        "blocks": [
          {
            "id": "block-1",
            "order": 0,
            "type": "text|list|contact",
            "layout": "full|left|right",
            "title": "Block Title",
            "content": "...",  // for text blocks
            "items": [...],     // for list blocks
            "discord": {...},   // for contact blocks
            "email": {...}      // for contact blocks
          }
        ]
      }
    ]
  }
  ```

### Database Collections
- **JoinText Collection**: Stores guild recruitment/join page content with section/block structure
- **AppSettings Collection**: Stores all application configuration
- **Admin Collection**: Stores admin user accounts with hashed passwords
- **Reset Functionality**: Preserves AppSettings, Admin, and JoinText collections during reset

### Migration from v1.5.0
- **No Breaking Changes**: All existing endpoints remain functional
- **Optional Migration**: Can continue using environment variables, but database storage is recommended
- **Gradual Adoption**: Installation wizard can be used to migrate existing configurations

## Version 1.5.0 Changelog

### New Features
- **Comprehensive Seasonal Statistics System**: Complete Mythic+ seasonal data processing and analysis
- **Individual Character Seasonal Stats**: New `/api/seasonal-stats/character/:realm/:character` endpoint for detailed character seasonal performance
- **Seasonal Leaderboards**: New `/api/seasonal-stats/leaderboard` endpoint with player, dungeon, and role-based rankings
- **Enhanced Character Fetch Endpoint**: Improved `/api/fetch/:realm/:character` with raid lockout tracking and season activity detection
- **Seasonal Data Processing**: Advanced algorithms for processing Mythic+ runs, dungeon statistics, and team play analysis

### New Endpoints
- **GET `/api/seasonal-stats`** - Get latest seasonal statistics with optional season filtering
- **GET `/api/seasonal-stats/all`** - Get all seasonal statistics across all seasons
- **GET `/api/seasonal-stats/character/:realm/:character`** - Get detailed seasonal statistics for a specific character
- **GET `/api/seasonal-stats/leaderboard`** - Get seasonal leaderboards (players, dungeons, roles)
- **GET `/api/seasonal-stats/status`** - Check seasonal statistics availability and status

### Enhanced Character Data
- **Raid Lockout Tracking**: Automatic detection of raid lockout status across all difficulties
- **Season Activity Detection**: Smart detection of character activity since season start
- **Processed Statistics**: Pre-calculated role assignments, ratings, and gear status
- **Gear Analysis**: Enhanced enchantment and tier set detection with detailed status reporting

### Database Improvements
- **Seasonal Statistics Collection**: New MongoDB collection for storing processed seasonal data
- **Advanced Data Processing**: Sophisticated algorithms for analyzing Mythic+ runs and team compositions
- **Performance Optimizations**: Efficient data storage and retrieval for seasonal statistics

### Environment Variables
- **NEW**: `TOP_SEASONAL_COLLECTION_NAME` - MongoDB collection name for seasonal statistics (required)

### Technical Improvements
- **Modular Code Architecture**: Separated seasonal statistics processing into dedicated modules
- **Enhanced Error Handling**: Comprehensive error logging for all seasonal statistics operations
- **Data Validation**: Robust validation for character data and seasonal statistics
- **Performance Monitoring**: Detailed logging and performance tracking for seasonal data processing

## Version 1.4 Changelog

### New Features
- **Comprehensive Error Logging System**: Complete error tracking and management system with MongoDB storage
- **Error Management API**: New `/api/errors` endpoints for viewing, filtering, and managing error logs
- **Error Analytics**: Statistics and insights into error patterns and trends
- **Production-Ready Error Handling**: Non-blocking error logging that won't crash your application
- **Environment Variable Configuration**: Added `ERRORS_COLLECTION_NAME` for MongoDB error collection

### New Endpoints
- **GET `/api/errors`** - View error logs with filtering options (type, endpoint, severity, resolved status)
- **GET `/api/errors/stats`** - Get comprehensive error statistics and analytics
- **PUT `/api/errors/:id/resolve`** - Mark specific errors as resolved
- **DELETE `/api/errors/:id`** - Delete individual error logs
- **DELETE `/api/errors`** - Bulk delete errors with filtering options

### Error Logging Coverage
- **Guild Fetch Process**: Authentication, roster fetching, character processing, and database operations
- **API Endpoints**: All endpoints now log detailed error information with request context
- **Global Error Handler**: Catches and logs all unhandled errors with full request details
- **Character Fetch Endpoints**: Both main and transmog endpoints with comprehensive error tracking

### Environment Variables
- **NEW**: `ERRORS_COLLECTION_NAME` - MongoDB collection name for error logs (required)

### Technical Improvements
- **Fixed Production URLs**: Replaced hardcoded localhost URLs with environment variable configuration
- **Enhanced Error Context**: Full request details, process IDs, character information, and stack traces
- **Severity Classification**: Automatic error severity based on HTTP status codes (high/medium/low)
- **Resolution Tracking**: Track which errors have been addressed and when

## Version 1.3 Changelog

### New Features
- **Individual Character Updates**: New `POST /update/:realm/:character` endpoint to update single characters
- **Update Status Monitoring**: New `GET /update/status` endpoint to check if guild updates are running
- **Concurrency Control**: Prevents multiple simultaneous guild updates with proper error handling

### Breaking Changes ⚠️
- **POST `/update`**: Now returns `409 Conflict` when an update is already running
- **Process IDs**: Changed format from `"1234567890"` to `"guild-update-1234567890"`
- **Response Format**: Enhanced responses with additional fields for better status tracking
- **GET `/data`**: Now always applies filtering and pagination (merged with `/data/filtered`)
- **GET `/data/filtered`**: Deprecated, redirects to `/data`
- **Data Response Format**: Changed from `statistics` object to `pagination` object

### Migration Required
Existing clients must be updated to handle the new concurrency control and response formats. See the [Migration Guide](#migration-guide-v12--v13) below for detailed instructions.

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

#### Local Development (v2.0+)

1. **Install Prerequisites**
   - Install [Node.js 20+](https://nodejs.org/en/download/)
   - Install [MongoDB Community Edition](https://www.mongodb.com/try/download/community) or set up [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

2. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd world-of-warcraft-api
   yarn install
   # or
   npm install
   ```

3. **Configure Environment**
   - Create a `.env` file in the project root
   - Set MongoDB connection and collection names:
     ```bash
     MONGODB=mongodb://localhost:27017
     DATABASE_NAME=warcraft_guild
     SIGNUP_COLLECTION=season3_signup
     MEMBERS_COLLECTION_NAME=members
     ERRORS_COLLECTION_NAME=error_logs
     TOP_SEASONAL_COLLECTION_NAME=topSeasonal
     PORT=8000
     HOST=localhost  # Use 'localhost' for local development
     ```

4. **Start the Server**
   ```bash
   yarn dev
   # or
   npm run dev
   ```

5. **Run Installation Wizard**
   - Start your frontend application
   - Navigate to `/install` page
   - Follow the guided installation process:
     - Configure Battle.net API credentials
     - Set guild information
     - Fetch guild data
     - Create admin account

**Note**: In v2.0+, you can configure most settings through the installation wizard. Environment variables for API credentials are optional and serve as fallback values.

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

### Required Variables

```
# MongoDB Configuration
MONGODB=mongodb://localhost:27017
DATABASE_NAME=warcraft_guild
SIGNUP_COLLECTION=season3_signup
MEMBERS_COLLECTION_NAME=members
ERRORS_COLLECTION_NAME=error_logs
TOP_SEASONAL_COLLECTION_NAME=topSeasonal
JOIN_TEXT_COLLECTION_NAME=jointext  # v2.0+ Join/Recruitment page content

# Server Configuration
PORT=8000
HOST=0.0.0.0
```

### Optional Variables (v2.0+)

Starting with version 2.0, most application configuration is managed through the database via the installation wizard. The following environment variables are **optional** and serve as fallback values:

```
# Battle.net API (Optional - can be set via installation wizard)
API_BATTLENET_KEY=xxxxx
API_BATTLENET_SECRET=xxxxx
GUILD_NAME=xxxxx
GUILD_REALM=xxxxx
REGION=eu
API_PARAM_REQUIREMENTGS=namespace=profile-eu&locale=en_US
```

**Note**: In v2.0+, these values can be configured through the `/install` page and will be stored in the database. Environment variables are only used as fallback if database settings don't exist.

## Configuration: Database-Based (v2.0+)

Starting with version 2.0, application configuration is primarily managed through the database via the installation wizard. The `app.config.js` file serves as a fallback and default values source.

### Configuration Flow

1. **Initial Setup**: Use the frontend `/install` page to configure all settings
2. **Database Storage**: Settings are saved to MongoDB `AppSettings` collection
3. **Runtime Loading**: Application loads settings from database at runtime
4. **Fallback**: If database settings don't exist, falls back to `app.config.js` defaults

### Configuration File: `app.config.js` (Fallback/Defaults)

This file provides default values and fallback configuration. In v2.0+, it's primarily used when database settings don't exist.

```js
const data = {
  // The following values can be loaded from environment variables or set via installation wizard
  API_BATTLENET_KEY: process.env.API_BATTLENET_KEY || '',
  API_BATTLENET_SECRET: process.env.API_BATTLENET_SECRET || '',
  GUILD_NAME: process.env.GUILD_NAME || '',
  GUILD_REALM: process.env.GUILD_REALM || '',
  REGION: process.env.REGION || 'eu',
  API_PARAM_REQUIREMENTGS: process.env.API_PARAM_REQUIREMENTGS || 'namespace=profile-eu&locale=en_US',

  // Default settings that can be customized via installation wizard or settings page
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
  GUILLD_RANKS: [
    "Guild Lead",
    "Officer",
    "Officer Alt",
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

### Updating Configuration

- **Most Settings**: Update via `/settings` API endpoint (admin only)
- **Protected Settings**: Guild Name, Realm, API Key can only be changed via `/install` endpoint with overwrite flag
- **Database Reset**: Use `/api/reset` endpoint to reset all data while preserving AppSettings

## API Endpoints

All endpoints are modular and documented with JSDoc in the codebase. Here are the main endpoints and their responses:

### GET `/data` ⚠️ **BREAKING CHANGE v1.3**
Returns filtered and paginated guild data. **Note:** This endpoint has been merged with `/data/filtered` and now always applies filtering and pagination.

**Query Parameters:**
- `filter` - Filter type: `all`, `missing-enchants`, `locked-normal`, `locked-heroic`, `locked-mythic`, `missing-tier`, `not-ready`, `active-season2`, `has-pvp-rating`, `has-mplus-score`
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 30)
- `search` - Search by character name
- `rankFilter` - Filter by rank: `all`, `mains`, `alts`
- `classFilter` - Filter by class (comma-separated)
- `specFilter` - Filter by spec: `all`, `tanks`, `healers`, `dps`
- `minItemLevel` - Minimum item level filter

**v1.3+ Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
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

**Legacy Response (v1.2 and below):**
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

### GET `/data/filtered` ⚠️ **DEPRECATED v1.3**
This endpoint is now deprecated and redirects to `/data`. Use `/data` instead for all data requests.

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

### POST `/update` ⚠️ **BREAKING CHANGE v1.3**
Starts a guild data update process with concurrency control to prevent multiple simultaneous updates.

**Request Body:**
```json
{
  "dataTypes": ["raid", "mplus", "pvp"]
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Guild update started successfully",
  "processId": "guild-update-1234567890",
  "dataTypes": ["raid", "mplus", "pvp"]
}
```

**Conflict Response (409) - When update is already running:**
```json
{
  "success": false,
  "error": "Guild update already in progress",
  "processId": "guild-update-1234567890",
  "message": "Another guild update is currently running. Please wait for it to complete."
}
```

### POST `/update/:realm/:character` 🆕 **NEW v1.3**
Updates a single character by realm and character name.

**URL Parameters:**
- `realm` - The realm name (e.g., "sylvanas")
- `character` - The character name (e.g., "holybarry")

**Request Body:**
```json
{
  "dataTypes": ["raid", "mplus", "pvp"]
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Character holybarry-sylvanas updated successfully",
  "character": { ... },
  "action": "updated"
}
```

**Error Responses:**
- `400` - Missing required parameters
- `404` - Character not found
- `500` - Database or fetch error

### GET `/update/status` 🆕 **NEW v1.3**
Returns the current status of guild update processes.

**Response:**
```json
{
  "success": true,
  "isRunning": false,
  "processId": null,
  "message": "No guild update is currently running"
}
```

**When update is running:**
```json
{
  "success": true,
  "isRunning": true,
  "processId": "guild-update-1234567890",
  "message": "Guild update is currently running (Process ID: guild-update-1234567890)"
}
```

### GET `/status` ⚠️ **BREAKING CHANGE v1.3**
Returns the status of active update processes. **Note:** This endpoint has been updated in v1.3.

**v1.3+ Response:**
```json
{
  "success": true,
  "activeProcesses": 1,
  "processes": ["guild-update-1234567890"]
}
```

**Legacy Response (v1.2 and below):**
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

### GET `/api/seasonal-stats` 🆕 **NEW v1.5.0**
Returns latest seasonal statistics with optional season filtering.

**Query Parameters:**
- `season` - Optional season number to filter by

**Response:**
```json
{
  "success": true,
  "data": {
    "season": 15,
    "lastUpdated": "2024-01-01T00:00:00.000Z",
    "topPlayers": [
      {
        "name": "Player1",
        "server": "sylvanas",
        "highestKey": 25,
        "highestTimedKey": 24,
        "totalRuns": 150,
        "completionRate": 85.5,
        "averageRating": 2850
      }
    ],
    "dungeonLeaderboard": {
      "Dungeon Name": {
        "highestKey": 25,
        "totalRuns": 45,
        "averageRating": 2800
      }
    },
    "roleStats": {
      "TANK": { "averageRating": 2700, "totalPlayers": 5 },
      "HEALER": { "averageRating": 2750, "totalPlayers": 8 },
      "DPS": { "averageRating": 2800, "totalPlayers": 17 }
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET `/api/seasonal-stats/all` 🆕 **NEW v1.5.0**
Returns all seasonal statistics across all seasons.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "season": 15,
      "lastUpdated": "2024-01-01T00:00:00.000Z",
      "topPlayers": [ ... ],
      "dungeonLeaderboard": { ... },
      "roleStats": { ... }
    },
    {
      "season": 14,
      "lastUpdated": "2023-12-01T00:00:00.000Z",
      "topPlayers": [ ... ],
      "dungeonLeaderboard": { ... },
      "roleStats": { ... }
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET `/api/seasonal-stats/character/:realm/:character` 🆕 **NEW v1.5.0**
Returns detailed seasonal statistics for a specific character.

**URL Parameters:**
- `realm` - The realm name (e.g., "sylvanas")
- `character` - The character name (e.g., "holybarry")

**Response:**
```json
{
  "success": true,
  "character": {
    "name": "holybarry",
    "server": "sylvanas",
    "spec": "Holy",
    "class": "Priest",
    "currentRating": 2850
  },
  "seasonalStats": {
    "highestTimedKey": 24,
    "highestKeyOverall": 25,
    "totalRuns": 150,
    "completedRuns": 128,
    "averageRating": 2850,
    "completionRate": 85.3,
    "topPlayedMembers": [
      {
        "name": "Player1",
        "spec": "Protection",
        "server": "sylvanas",
        "count": 45
      }
    ],
    "dungeonStats": {
      "Dungeon Name": {
        "totalRuns": 25,
        "timedRuns": 22,
        "highestKey": 25,
        "averageRating": 2800
      }
    },
    "affixStats": {
      "Fortified": { "runs": 75, "averageRating": 2800 },
      "Tyrannical": { "runs": 75, "averageRating": 2900 }
    },
    "roleStats": {
      "TANK": { "runs": 30, "averageRating": 2750 },
      "HEALER": { "runs": 120, "averageRating": 2850 }
    },
    "totalPlaytime": 45000
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET `/api/seasonal-stats/leaderboard` 🆕 **NEW v1.5.0**
Returns seasonal leaderboards with different ranking types.

**Query Parameters:**
- `type` - Leaderboard type: `players`, `dungeons`, `roles` (default: `players`)
- `limit` - Number of results to return (default: 10)

**Response (Players):**
```json
{
  "success": true,
  "type": "players",
  "limit": 10,
  "data": [
    {
      "name": "Player1",
      "server": "sylvanas",
      "highestKey": 25,
      "highestTimedKey": 24,
      "totalRuns": 150,
      "averageRating": 2850
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Response (Dungeons):**
```json
{
  "success": true,
  "type": "dungeons",
  "limit": 10,
  "data": [
    {
      "name": "Dungeon Name",
      "highestKey": 25,
      "totalRuns": 45,
      "averageRating": 2800
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Response (Roles):**
```json
{
  "success": true,
  "type": "roles",
  "limit": 10,
  "data": [
    {
      "name": "TANK",
      "averageRating": 2700,
      "totalPlayers": 5,
      "totalRuns": 150
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET `/api/seasonal-stats/status` 🆕 **NEW v1.5.0**
Checks seasonal statistics availability and status.

**Response:**
```json
{
  "success": true,
  "hasData": true,
  "season": 15,
  "lastUpdated": "2024-01-01T00:00:00.000Z",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Installation & Settings API 🆕 **NEW v2.0**

### GET `/api/install`
Returns installation status and default configuration values.

**Response:**
```json
{
  "success": true,
  "installed": false,
  "hasAdmin": false,
  "hasGuildData": false,
  "suggestedStep": 0,
  "defaults": {
    "LEVEL_REQUIREMENT": 80,
    "ITEM_LEVEL_REQUIREMENT": 440
  }
}
```

### POST `/api/install`
Saves app settings with Battle.net API validation.

**Request Body:**
```json
{
  "API_BATTLENET_KEY": "your-client-id",
  "API_BATTLENET_SECRET": "your-client-secret",
  "GUILD_NAME": "guild-name-slug",
  "GUILD_REALM": "realm-slug",
  "REGION": "eu",
  "API_PARAM_REQUIREMENTGS": "namespace=profile-eu&locale=en_US",
  "overwrite": false
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "App settings saved successfully",
  "validation": {
    "isValid": true,
    "guildMembers": 150
  }
}
```

### POST `/api/install/login`
Authenticates admin user for protected routes.

**Request Body:**
```json
{
  "username": "admin",
  "password": "secure-password"
}
```

### POST `/api/install/admin`
Creates admin account with password strength validation.

**Request Body:**
```json
{
  "username": "admin",
  "password": "SecurePassword123!"
}
```

### GET `/api/settings`
Returns app settings (admin only, Basic Auth required).

**Headers:**
```
Authorization: Basic base64(username:password)
```

### PUT `/api/settings`
Updates app settings (admin only, protected fields excluded).

**Headers:**
```
Authorization: Basic base64(username:password)
```

### POST `/api/reset`
Resets database collections (admin only, preserves AppSettings).

**Request Body:**
```json
{
  "username": "admin",
  "password": "secure-password"
}
```

### GET `/api/reset/info`
Returns information about what will be reset.

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

## Join/Recruitment Content API 🆕 **NEW v2.0**

### GET `/api/jointext`
Returns guild recruitment/join page content. **Public endpoint** - no authentication required.

**Response:**
```json
{
  "success": true,
  "joinText": {
    "hero": {
      "title": "Join Our Guild",
      "subtitle": "Embark on epic adventures with skilled players.",
      "badges": [
        { "label": "Mythic Raiding", "color": "gold" },
        { "label": "PvP Arenas", "color": "blue" },
        { "label": "Mythic+ Dungeons", "color": "green" }
      ]
    },
    "sections": [
      {
        "id": "section-1",
        "order": 0,
        "blocks": [
          {
            "id": "block-1",
            "order": 0,
            "type": "text",
            "layout": "full",
            "title": "Welcome to Our Guild",
            "content": "GUILD NAME is a semi-hardcore guild..."
          },
          {
            "id": "block-2",
            "order": 1,
            "type": "list",
            "layout": "left",
            "title": "Requirements",
            "items": [
              "Item Level: 628+",
              "Raid Experience: 8/8 Heroic",
              "Good logs and performance"
            ]
          },
          {
            "id": "block-3",
            "order": 2,
            "type": "contact",
            "layout": "full",
            "title": "Ready to Join Us?",
            "discord": {
              "label": "Join our Discord",
              "url": "https://discord.gg/yourguild"
            },
            "email": {
              "label": "Contact Officers",
              "url": "mailto:officers@yourguild.com"
            }
          }
        ]
      }
    ],
    "lastUpdated": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Failed to fetch join text",
  "message": "Database connection failed"
}
```

**Notes:**
- Returns default content if no custom content exists in database
- No authentication required
- Content structure includes hero section and multiple sections with blocks
- Each block can be `text`, `list`, or `contact` type
- Layout options: `full` (full-width), `left` (left half), `right` (right half)
- Badge colors: `gold`, `blue`, `green`

### PUT `/api/jointext`
Updates guild recruitment/join page content. **Admin only** - requires Basic Auth.

**Authentication:**
- Basic Auth required
- Username and password from admin account

**Request Body:**
```json
{
  "hero": {
    "title": "Join Our Guild",
    "subtitle": "Description text",
    "badges": [
      { "label": "Active Community", "color": "gold" }
    ]
  },
  "sections": [
    {
      "id": "section-1",
      "order": 0,
      "blocks": [
        {
          "id": "block-1",
          "order": 0,
          "type": "text",
          "layout": "full",
          "title": "Block Title",
          "content": "Block content..."
        }
      ]
    }
  ]
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Join text updated successfully"
}
```

**Validation Errors:**
```json
{
  "success": false,
  "error": "Invalid data structure",
  "message": "Missing required field: hero"
}
```

**Authentication Errors:**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid credentials"
}
```

**Validation Rules:**
- `hero` object required with `title`, `subtitle`, and `badges` array
- `sections` array required
- Each section must have `id`, `order`, and `blocks` array
- Each block must have `id`, `order`, `type`, `layout`, and `title`
- Text blocks require `content` field
- List blocks require `items` array
- Contact blocks require `discord` and/or `email` objects with `label` and `url`
- Layout must be one of: `full`, `left`, `right`
- Block type must be one of: `text`, `list`, `contact`
- Badge color must be one of: `gold`, `blue`, `green`

### POST `/api/jointext/seed`
Seeds the database with example/default join page content. **Admin only** - requires Basic Auth.

**Authentication:**
- Basic Auth required
- Username and password from admin account

**Response:**
```json
{
  "success": true,
  "message": "Join text seeded successfully with default content"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid credentials"
}
```

**Notes:**
- Replaces existing content with default example content
- Useful for resetting to default state or initial setup
- Includes hero section with title, subtitle, and badges
- Includes example sections for welcome, requirements, benefits, schedule, and contact
- All content is fully editable after seeding via PUT endpoint

## Error Management API 🆕 **NEW v1.4**

### GET `/api/errors`
Returns error logs with optional filtering.

**Query Parameters:**
- `type` - Filter by error type (e.g., 'api', 'guild-fetch', 'database')
- `endpoint` - Filter by endpoint
- `resolved` - Filter by resolved status (true/false)
- `severity` - Filter by severity (high/medium/low)
- `limit` - Limit number of results (default: 100, max: 1000)

**Response:**
```json
{
  "success": true,
  "errors": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "type": "api",
      "endpoint": "/api/fetch/sylvanas/holybarry",
      "error": {
        "name": "TypeError",
        "message": "Cannot read property 'name' of undefined",
        "stack": "TypeError: Cannot read property...",
        "code": null,
        "status": 500,
        "statusCode": 500
      },
      "context": {
        "method": "GET",
        "url": "/api/fetch/sylvanas/holybarry",
        "query": { "dataTypes": "raid,mplus,pvp" },
        "params": { "realm": "sylvanas", "character": "holybarry" },
        "userAgent": "Mozilla/5.0...",
        "ip": "127.0.0.1",
        "processId": "guild-update-1234567890",
        "character": "holybarry-sylvanas"
      },
      "severity": "high",
      "resolved": false
    }
  ],
  "count": 1,
  "filters": {
    "type": null,
    "endpoint": null,
    "resolved": null,
    "severity": null,
    "limit": 100
  }
}
```

### GET `/api/errors/stats`
Returns comprehensive error statistics and analytics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "overview": {
      "total": 150,
      "resolved": 45,
      "unresolved": 105,
      "highSeverity": 12,
      "mediumSeverity": 89,
      "lowSeverity": 49
    },
    "byType": [
      { "_id": "api", "count": 95 },
      { "_id": "guild-fetch", "count": 35 },
      { "_id": "database", "count": 20 }
    ],
    "byEndpoint": [
      { "_id": "/api/fetch/sylvanas/holybarry", "count": 25 },
      { "_id": "/api/update", "count": 15 },
      { "_id": "/api/data", "count": 10 }
    ]
  }
}
```

### PUT `/api/errors/:id/resolve`
Marks a specific error as resolved.

**URL Parameters:**
- `id` - MongoDB ObjectId of the error

**Response:**
```json
{
  "success": true,
  "message": "Error marked as resolved",
  "result": {
    "matchedCount": 1,
    "modifiedCount": 1,
    "acknowledged": true
  }
}
```

### DELETE `/api/errors/:id`
Deletes a specific error log.

**URL Parameters:**
- `id` - MongoDB ObjectId of the error

**Response:**
```json
{
  "success": true,
  "message": "Error deleted successfully",
  "result": {
    "deletedCount": 1,
    "acknowledged": true
  }
}
```

### DELETE `/api/errors`
Deletes multiple error logs with optional filtering.

**Query Parameters:**
- `type` - Delete only errors of specific type
- `resolved` - Delete only resolved/unresolved errors (true/false)
- `severity` - Delete only errors of specific severity

**Response:**
```json
{
  "success": true,
  "message": "Deleted 25 error logs",
  "result": {
    "deletedCount": 25,
    "acknowledged": true
  },
  "filters": {
    "type": "api",
    "resolved": true,
    "severity": null
  }
}
```

## Installation Guide (v2.0+)

### Quick Start

1. **Set up MongoDB**
   - Ensure MongoDB is running and accessible
   - Create a database (or use existing)
   - Update `.env` with your MongoDB connection string

2. **Start the API Server**
   ```bash
   yarn install
   yarn dev
   # or
   npm install
   npm run dev
   ```

3. **Run Installation Wizard**
   - Navigate to your frontend application
   - Go to `/install` page
   - Follow the guided installation process:
     
     **Step 1: App Settings**
     - Enter Battle.net API credentials
     - Configure guild name and realm
     - Set region and API parameters
     - Configure guild requirements
     - Settings are validated against Battle.net API
     
     **Step 2: Fetch Guild Data**
     - Automatically fetches all guild member data
     - Real-time progress updates via WebSocket
     - Can be skipped and run later
     
     **Step 3: Create Admin Account**
     - Create admin username and password
     - Password must meet strength requirements
     - After creation, installation is complete

4. **Access Settings**
   - Navigate to `/settings` in frontend (requires admin login)
   - View and update app configuration
   - Reset database if needed

### Manual Configuration (Legacy)

If you prefer to configure via environment variables (v1.x style):

1. Set all required environment variables in `.env`
2. Settings will be loaded from environment variables
3. Can later migrate to database storage via installation wizard

## Migration Guide: v1.5.0 → v2.0

### New Features (No Breaking Changes)

#### Installation System
- **New Installation Endpoints**: `/api/install` endpoints for guided setup
- **Database Configuration**: Settings now stored in MongoDB
- **Admin Authentication**: Secure admin account system

#### Settings Management
- **Settings API**: New `/api/settings` endpoints for configuration management
- **Protected Fields**: Guild name, realm, and API credentials protected
- **Runtime Updates**: Update settings without restarting server

#### Database Reset
- **Reset Endpoint**: `/api/reset` for database cleanup
- **Selective Reset**: Preserves AppSettings and Admin collections

### Migration Steps

1. **Update Dependencies**
   ```bash
   yarn install
   # or
   npm install
   ```

2. **Optional: Migrate to Database Configuration**
   - Use the installation wizard to migrate existing settings
   - Or continue using environment variables (still supported)

3. **Create Admin Account**
   - Use `/install` page to create admin account
   - Or use `POST /api/install/admin` endpoint directly

4. **Update Frontend**
   - Ensure frontend is updated to v2.0+
   - New installation wizard will guide you through setup

### Backward Compatibility

- **All existing endpoints remain functional**
- **Environment variables still supported as fallback**
- **No data migration required**
- **Can continue using existing configuration methods**

## Migration Guide: v1.4 → v1.5.0

### New Requirements

#### Environment Variables
- **NEW**: `TOP_SEASONAL_COLLECTION_NAME` - Add this to your `.env` file for seasonal statistics
- **Example**: `TOP_SEASONAL_COLLECTION_NAME=seasonal_stats`

#### MongoDB Setup
- Create a new MongoDB collection for seasonal statistics (name specified in `TOP_SEASONAL_COLLECTION_NAME`)
- No data migration required - the seasonal statistics system will create the collection automatically

### New Features (No Breaking Changes)
- **Seasonal Statistics**: Comprehensive Mythic+ seasonal data processing and analysis
- **Character Seasonal Stats**: Individual character seasonal performance tracking
- **Enhanced Character Fetch**: Improved character data with raid lockouts and season activity
- **Seasonal Leaderboards**: Player, dungeon, and role-based rankings

### Optional Upgrades
- **Seasonal Data Monitoring**: Consider setting up monitoring for seasonal statistics endpoints
- **Character Detail Pages**: Use the new character seasonal stats for detailed character profiles
- **Leaderboard Integration**: Implement seasonal leaderboards in your frontend applications

## Migration Guide: v1.3 → v1.4

### New Requirements

#### Environment Variables
- **NEW**: `ERRORS_COLLECTION_NAME` - Add this to your `.env` file for error logging
- **Example**: `ERRORS_COLLECTION_NAME=error_logs`

#### MongoDB Setup
- Create a new MongoDB collection for error logs (name specified in `ERRORS_COLLECTION_NAME`)
- No data migration required - the error logging system will create the collection automatically

### New Features (No Breaking Changes)
- **Error Logging**: Automatically logs all errors to MongoDB
- **Error Management API**: New endpoints for viewing and managing error logs
- **Production URL Fix**: Hardcoded localhost URLs now use environment variables

### Optional Upgrades
- **Error Monitoring**: Consider setting up monitoring for the new error endpoints
- **Error Cleanup**: Implement periodic cleanup of old resolved errors
- **Error Analytics**: Use the new stats endpoint for error trend analysis

## Migration Guide: v1.2 → v1.3

### Breaking Changes

#### 1. POST `/update` Endpoint Changes

**Before (v1.2):**
- No concurrency control
- Could start multiple simultaneous updates
- Simple success/error responses

**After (v1.3):**
- **Concurrency control implemented** - prevents multiple simultaneous updates
- Returns `409 Conflict` when update is already running
- Enhanced response with `processId` field
- Process IDs now prefixed with `guild-update-`

**Migration Steps:**
1. Update your client code to handle `409` responses
2. Check for `isRunning` status before attempting updates
3. Use the new `/update/status` endpoint to check if updates are running

#### 2. Process ID Format Changes

**Before (v1.2):**
```json
{
  "processId": "1234567890"
}
```

**After (v1.3):**
```json
{
  "processId": "guild-update-1234567890"
}
```

#### 3. Data Endpoint Changes

**Before (v1.2):**
- `/data` - Returned unfiltered data with statistics
- `/data/filtered` - Returned filtered and paginated data

**After (v1.3):**
- `/data` - **Now always applies filtering and pagination** (merged with `/data/filtered`)
- `/data/filtered` - **Deprecated**, redirects to `/data`
- Response format changed from `statistics` object to `pagination` object

#### 4. New Endpoints Added

- `POST /update/:realm/:character` - Update individual characters
- `GET /update/status` - Check update status

### Client Code Migration Examples

#### JavaScript/Node.js Example

**Before (v1.2):**
```javascript
// Old way - no concurrency handling
const response = await fetch('/api/update', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dataTypes: ['raid', 'mplus', 'pvp'] })
});

const result = await response.json();
if (result.success) {
  console.log('Update started');
} else {
  console.error('Update failed:', result.error);
}
```

**After (v1.3):**
```javascript
// New way - with concurrency handling
async function startGuildUpdate() {
  // Check if update is already running
  const statusResponse = await fetch('/api/update/status');
  const status = await statusResponse.json();
  
  if (status.isRunning) {
    console.log('Update already running:', status.processId);
    return;
  }
  
  // Start update
  const response = await fetch('/api/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataTypes: ['raid', 'mplus', 'pvp'] })
  });
  
  const result = await response.json();
  
  if (response.status === 409) {
    console.log('Update already in progress:', result.processId);
  } else if (result.success) {
    console.log('Update started:', result.processId);
  } else {
    console.error('Update failed:', result.error);
  }
}

// Update individual character
async function updateCharacter(realm, character) {
  const response = await fetch(`/api/update/${realm}/${character}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataTypes: ['raid', 'mplus', 'pvp'] })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log(`Character ${character}-${realm} ${result.action}`);
  } else {
    console.error('Character update failed:', result.error);
  }
}

// Data endpoint migration
async function fetchGuildData() {
  // v1.2 way - separate endpoints
  // const unfilteredResponse = await fetch('/api/data');
  // const filteredResponse = await fetch('/api/data/filtered?page=1&limit=30');
  
  // v1.3 way - unified endpoint with filtering
  const response = await fetch('/api/data?page=1&limit=30&filter=all');
  const result = await response.json();
  
  if (result.success) {
    console.log('Data:', result.data);
    console.log('Pagination:', result.pagination); // New in v1.3
    console.log('Filter:', result.filter);
  } else {
    console.error('Failed to fetch data:', result.error);
  }
}
```

#### Python Example

**Before (v1.2):**
```python
import requests

response = requests.post('/api/update', json={'dataTypes': ['raid', 'mplus', 'pvp']})
result = response.json()

if result['success']:
    print('Update started')
else:
    print('Update failed:', result['error'])
```

**After (v1.3):**
```python
import requests

def start_guild_update():
    # Check if update is already running
    status_response = requests.get('/api/update/status')
    status = status_response.json()
    
    if status['isRunning']:
        print('Update already running:', status['processId'])
        return
    
    # Start update
    response = requests.post('/api/update', json={'dataTypes': ['raid', 'mplus', 'pvp']})
    result = response.json()
    
    if response.status_code == 409:
        print('Update already in progress:', result['processId'])
    elif result['success']:
        print('Update started:', result['processId'])
    else:
        print('Update failed:', result['error'])

def update_character(realm, character):
    response = requests.post(f'/api/update/{realm}/{character}', 
                            json={'dataTypes': ['raid', 'mplus', 'pvp']})
    result = response.json()
    
    if result['success']:
        print(f"Character {character}-{realm} {result['action']}")
    else:
        print('Character update failed:', result['error'])

def fetch_guild_data():
    # v1.2 way - separate endpoints
    # unfiltered_response = requests.get('/api/data')
    # filtered_response = requests.get('/api/data/filtered?page=1&limit=30')
    
    # v1.3 way - unified endpoint with filtering
    response = requests.get('/api/data?page=1&limit=30&filter=all')
    result = response.json()
    
    if result['success']:
        print('Data:', result['data'])
        print('Pagination:', result['pagination'])  # New in v1.3
        print('Filter:', result['filter'])
    else:
        print('Failed to fetch data:', result['error'])
```

### WebSocket Events

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
