# RandomBytes MC Control - Enhancements

This document describes all the enhancements made to the Minecraft server control panel.

## Overview

The control panel has been significantly enhanced with a new dark theme, improved functionality, and several new features including OPs management, chat console, server settings, and more.

## Visual Changes

### Dark Monospace Theme
- **Background**: Dark grey (#1a1a1a / #242424)
- **Text**: Light grey (#e0e0e0)
- **Accents**: Cyan-green (#4a9)
- **Font**: Monospace throughout
- **Borders**: Subtle dark borders (#333)
- **Buttons**: Dark with hover effects

### Navigation Reorganization
The sidebar is now organized into three logical sections:

**# Status**
- Status (formerly "Server Metrics") - Real-time server metrics with shutdown button
- Server Info - Server information and world details
- Plugins - Installed plugin list

**# Player Management**
- Players - Player list with inventory, ban, and OP controls
- Whitelist - Manage whitelisted players
- Blacklist - Manage banned players
- OPs - Manage server operators

**# Server Management**
- Console - PaperMC console output and command execution
- Chat - In-game chat with server message broadcasting
- Server Settings - Configure server.properties and gamerules

## New Features

### 1. Optional UUID for Whitelist/Blacklist/OPs
- UUID field is now optional when adding players
- If not provided, UUID is automatically fetched from Mojang API via backend
- Format: Automatically adds dashes to UUID if needed
- **Implementation**: Backend endpoint `/api/uuid-lookup?username={username}` fetches from Mojang API server-side to avoid CORS issues

### 2. Remove Buttons for Lists
- Whitelist, Blacklist, and OPs now have remove buttons for each entry
- Confirmation prompts before removal
- **API Endpoints**: 
  - `DELETE /api/whitelist/remove?uuid={uuid}`
  - `DELETE /api/blacklist/remove?uuid={uuid}`
  - `DELETE /api/ops/remove?uuid={uuid}`

### 3. OPs Management
- New dedicated page for managing server operators
- Add/remove OPs with optional UUID lookup
- OP/DeOP buttons added to Players page
- **API Endpoints**:
  - `GET /api/ops` - List all operators
  - `POST /api/ops/add` - Add operator
  - `DELETE /api/ops/remove` - Remove operator

### 4. Chat Console
- Separate from PaperMC console
- Shows chat messages, joins, and leaves
- Send messages as "Server" (without /)
- Execute in-game commands (with /)
- **API Endpoints**:
  - `GET /api/chat` - Get chat logs
  - `POST /api/chat` - Send message or command
- **Examples**:
  - "Hello players!" → Broadcasts as "[Server] Hello players!"
  - "/give @a diamond 64" → Executes command

### 5. Server Settings
- Configure server.properties at runtime
- Edit game rules for all worlds
- Settings include:
  - MOTD, max players, online mode
  - Allow flight, nether, end
  - Difficulty, whitelist
  - All game rules (doMobSpawning, keepInventory, etc.)
- **API Endpoints**:
  - `GET /api/settings` - Get current settings
  - `POST /api/settings/properties` - Update server properties
  - `POST /api/settings/gamerules` - Update game rules
- **Note**: Some properties require server restart to take effect

### 6. Server Restart Button
- Located on Status page
- Confirmation prompt before restart
- Executes `/restart` command after 1 second delay
- **API Endpoint**: `POST /api/restart`

### 7. Live Updates
- Whitelist: Auto-refreshes every 5 seconds
- Blacklist: Auto-refreshes every 5 seconds
- OPs: Auto-refreshes every 5 seconds
- Status: Auto-refreshes every 2 seconds
- Console: Auto-refreshes every 2 seconds
- Chat: Auto-refreshes every 2 seconds
- **No server restart required** for list changes

### 8. Server Info Improvements
- Horizontal divider between Info/Settings and Worlds
- Better visual separation of sections
- Shows OP status in player list

### 9. Offline Detection Overlay
- Red "SERVER OFFLINE" overlay appears when backend is unreachable
- Blurred background with backdrop-filter effect
- Auto-detects offline status on every API call
- Periodic check every 5 seconds
- Animated pulsing effect
- Auto-dismisses when connection restored

### 10. Console Log Capture
- Real-time server console output capture
- Shows timestamps, thread names, and log levels
- Format: `[HH:mm:ss] [thread/level]: message`
- Captures player connections, commands, and all server output

## Bug Fixes

### 1. Fixed Unban Functionality
**Problem**: Unban button didn't properly remove players from ban list

**Solution**: 
```java
// Before (didn't work)
player.ban(null, (Date) null, null);

// After (works correctly)
Bukkit.getBanList(BanList.Type.NAME).pardon(player.getName());
Bukkit.getBanList(BanList.Type.IP).pardon(player.getName());
```

### 2. Fixed Player Status
**Problem**: Player status always showed "Online"

**Solution**: Now correctly uses `player.online` property from API, which reflects actual online status from Bukkit

### 3. Fixed UUID CORS Error
**Problem**: Frontend couldn't fetch UUIDs from Mojang API due to CORS restrictions

**Solution**: Moved UUID lookup to backend via `/api/uuid-lookup` endpoint, which fetches from Mojang server-side

### 4. Fixed GameRule Errors
**Problem**: Server errors when accessing unavailable gamerules like 'minecartMaxSpeed'

**Solution**: 
```java
for (GameRule<?> rule : GameRule.values()) {
    try {
        Object value = mainWorld.getGameRuleValue(rule);
        if (value != null) {
            gamerules.addProperty(rule.getName(), value.toString());
        }
    } catch (IllegalArgumentException e) {
        // Skip gamerules that are not available
        plugin.getLogger().fine("GameRule '" + rule.getName() + "' is not available, skipping");
    }
}
```

### 5. Fixed Server Settings Empty List
**Problem**: Server Settings page showed empty lists due to GameRule errors

**Solution**: GameRule error handling now allows settings page to load successfully with only valid gamerules

### 6. Offline Player Inventory
**Limitation**: Minecraft doesn't allow viewing offline player inventory through standard API
**Current Behavior**: Shows "Inventory is empty or unavailable" for offline players
**Note**: This is a Bukkit/Spigot API limitation

## API Changes

### New Backend Endpoints
```
DELETE /api/whitelist/remove?uuid={uuid}
DELETE /api/blacklist/remove?uuid={uuid}
GET    /api/ops
POST   /api/ops/add
DELETE /api/ops/remove?uuid={uuid}
GET    /api/chat
POST   /api/chat
GET    /api/settings
POST   /api/settings/properties
POST   /api/settings/gamerules
POST   /api/restart (renamed to shutdown in UI)
GET    /api/uuid-lookup?username={username}
```

### New Plugin Endpoints
All backend endpoints correspond to plugin endpoints with the same paths.

### Plugin Methods Added
```java
// PlayerDataManager
public void removeFromWhitelist(String uuid)
public void removeFromBlacklist(String uuid)
public JsonObject getOps()
public void addToOps(String name, String uuid)
public void removeFromOps(String uuid)
public JsonObject getChatLogs()
public void addChatLog(String message)
public void sendChatMessage(String message)
public JsonObject getSettings()
public void updateServerProperties(JsonObject properties)
public void updateGameRules(JsonObject gamerules)
```

## Technical Implementation

### Frontend (JavaScript)
- Mojang API integration for UUID lookup
- Auto-refresh intervals with `setInterval()`
- DELETE method support added to API client
- Form validation and error handling

### Backend (Rust)
- New route handlers with DELETE support
- Query parameter parsing for DELETE requests
- Extended `PluginClient` with new methods

### Plugin (Java)
- Extended `APIServer` with new handlers
- Fixed unban using `BanList.pardon()`
- Chat event tracking with `AsyncPlayerChatEvent`
- Game rules management with type-safe updates
- Scheduler integration for async operations

## File Changes Summary

### Modified Files
1. `backend-frontend/frontend/index.html` - New pages and navigation
2. `backend-frontend/frontend/style.css` - Dark theme and new styles
3. `backend-frontend/frontend/app.js` - All new functionality
4. `backend-frontend/src/main.rs` - New routes and handlers
5. `backend-frontend/src/plugin_client.rs` - New API methods
6. `plugin/src/main/java/dev/randombytes/mccontrol/APIServer.java` - New handlers
7. `plugin/src/main/java/dev/randombytes/mccontrol/PlayerDataManager.java` - New methods
8. `plugin/src/main/java/dev/randombytes/mccontrol/PlayerTrackingListener.java` - Chat tracking

## Testing Checklist

- [ ] Dark theme displays correctly
- [ ] Navigation sections work
- [ ] UUID auto-fetch from Mojang API
- [ ] Whitelist add/remove with and without UUID
- [ ] Blacklist add/remove with and without UUID
- [ ] OPs add/remove with and without UUID
- [ ] Player ban/unban (verify unban works correctly)
- [ ] Player OP/DeOP from Players page
- [ ] Chat message broadcasting
- [ ] Chat command execution with /
- [ ] Server settings read/write
- [ ] Game rules update
- [ ] Server restart button
- [ ] Live updates for all lists
- [ ] Player status shows correct Online/Offline
- [ ] Metrics graph displays correctly
- [ ] Server info divider appears

## Known Limitations

1. **Offline Player Inventory**: Cannot view inventory of offline players due to Bukkit API limitations
2. **Server Properties**: Most properties require server restart to take effect
3. **Network Requirement**: UUID lookup requires internet access to Mojang API
4. **Mojang API Rate Limit**: May fail if too many UUID lookups in short time

## Migration Notes

No database migration needed. All features work with existing data structures.

**Important**: Ensure server has `/restart` command available (provided by most server management plugins like EssentialsX or custom restart scripts).

## Future Enhancements

Potential improvements:
- Offline player inventory via NBT file reading
- Batch operations for list management
- Player search/filter functionality
- Export/import player lists
- Custom ban reasons and durations
- Scheduled server restarts
- Backup management
- Plugin enable/disable controls

## Support

For issues or questions:
- GitHub Issues: https://github.com/DasIstTobias/randombytes-mc-control/issues
- Check server console for plugin errors
- Verify API connectivity between backend and plugin
- Ensure Mojang API is accessible for UUID lookups
