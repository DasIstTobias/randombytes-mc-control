# UI Summary - RandomBytes MC Control

## Navigation Structure

```
MC Control
├─ # Status
│  ├─ Status (Server Metrics + Restart Button)
│  ├─ Server Info (Info/Settings | Worlds)
│  └─ Plugins (Installed Plugins List)
├─ # Player Management
│  ├─ Players (List with Ban/OP controls)
│  ├─ Whitelist (Add/Remove, UUID optional)
│  ├─ Blacklist (Add/Remove, UUID optional)
│  └─ OPs (Add/Remove, UUID optional)
└─ # Server Management
   ├─ Console (PaperMC commands)
   ├─ Chat (In-game messages & commands)
   └─ Server Settings (Properties & Game Rules)
```

## Page Layouts

### Status Page
- **Metrics Cards** (4 cards in grid)
  - Current Players
  - TPS (Ticks Per Second)
  - Memory Usage (%)
  - CPU Usage (%)
- **Performance Chart** (Line graph showing TPS and Memory over time)
- **Server Actions Panel**
  - Restart Server button (red, with confirmation)

### Players Page
- **Table Columns**: Name | Status | Play Time | Actions
- **Actions per Player**:
  - Inventory button (view items)
  - Ban/Unban button (red)
  - OP/DeOP button

### Whitelist Page
- **Add Form**: Player Name (required) + UUID (optional) + Add button
- **Table Columns**: Name | UUID | Actions
- **Actions**: Remove button (red)

### Blacklist Page
- **Add Form**: Player Name (required) + UUID (optional) + Add button
- **Table Columns**: Name | UUID | Actions
- **Actions**: Remove button (red)

### OPs Page
- **Add Form**: Player Name (required) + UUID (optional) + Add button
- **Table Columns**: Name | UUID | Actions
- **Actions**: Remove button (red)

### Server Info Page
- **Server Information Card**
  - Name, Version, Bukkit Version, Minecraft Version
  - Online Mode, Players (current/max)
  - IP, Port, MOTD
- **Settings Card**
  - Whitelist, Allow Flight, Allow Nether, Allow End
- **Horizontal Divider**
- **World Cards** (one per world)
  - Environment, Difficulty, PvP, Seed

### Console Page
- **Console Log** (Black background, scrollable, 500px height)
- **Command Input** (Text field + Execute button)
- Purpose: Execute PaperMC console commands

### Chat Page
- **Chat Log** (Black background, scrollable, 500px height)
- **Message Input** (Text field + Send button)
- Purpose: 
  - Send messages as "Server" (without /)
  - Execute in-game commands (with /)

### Server Settings Page
- **Server Properties Section**
  - Form fields for editable properties
  - Save Properties button
- **Game Rules Section**
  - Form fields for all game rules
  - Save Game Rules button

## Color Scheme

- **Primary Background**: #1a1a1a (very dark grey)
- **Secondary Background**: #242424 (dark grey)
- **Text**: #e0e0e0 (light grey)
- **Text Light**: #999 (medium grey)
- **Accent/Success**: #4a9 (cyan-green)
- **Danger**: #d44 (red)
- **Borders**: #333 (dark borders)

## Typography

- **Font Family**: Monospace throughout
- **Font Size**: 14px base
- **Headers**: Normal weight (not bold)
- **Code Elements**: Monospace (for UUIDs)

## Interactive Elements

### Buttons
- **Default**: Dark grey (#333) with light text
- **Hover**: Slightly lighter (#3a3a3a)
- **Active**: Darker (#2a2a2a)
- **Danger**: Red border/text, red background on hover
- **Success**: Green border/text, green background on hover

### Forms
- **Inputs**: Dark background (#1a1a1a), light text
- **Focus**: Darker border (#555)
- **Placeholder**: Grey text

### Tables
- **Header**: Dark primary (#1a1a1a), light text
- **Rows**: Hover effect (lighter background #2a2a2a)
- **Borders**: Dark grey (#333)

### Status Badges
- **Online**: Green border/text, transparent background with green tint
- **Offline**: Red border/text, transparent background with red tint
- **Enabled**: Same as Online
- **Disabled**: Same as Offline

## Auto-Refresh Intervals

- **Status/Metrics**: 2 seconds
- **Whitelist**: 5 seconds
- **Blacklist**: 5 seconds
- **OPs**: 5 seconds
- **Console**: 2 seconds
- **Chat**: 2 seconds
- **Players**: Manual refresh only
- **Server Info**: Manual refresh only
- **Plugins**: Manual refresh only
- **Settings**: Manual refresh only

## Modal (Player Inventory)
- **Overlay**: Dark semi-transparent
- **Content**: Dark background (#242424) with border
- **Close**: X button in top-right
- **Inventory Grid**: Auto-fill layout with item cards

## Key Features

1. **UUID Auto-Fetch**: Enter just the player name, UUID fetched from Mojang API
2. **Live Updates**: Lists auto-refresh without manual action
3. **Immediate Effect**: Changes take effect without server restart
4. **Confirmation Prompts**: For destructive actions (remove, ban, restart)
5. **Error Handling**: Alerts for failed operations
6. **Responsive Design**: Grid layouts adapt to screen size
