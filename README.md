# <img src="backend-frontend/frontend/favicon.ico" alt="RandomBytes Logo" width="32" height="32" style="vertical-align: middle;"> RandomBytes MC Control

A comprehensive, secure Minecraft server management solution with a modern web interface. Monitor, manage, and control your Minecraft server from anywhere with real-time metrics, player management, file operations, and more.

![Screenshot](img/Screenshot_20251120_175553.png)

## Overview

The Project consists of three integrated components that work together to provide complete server management:

1. **Plugin** - PaperMC/Spigot plugin providing a secure REST API
2. **Backend** - Rust server handling communication and serving the web interface
3. **Frontend** - Modern single-page web application for server management

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌───────────┐
│  Frontend   │ ←─────→ │   Backend    │ ←─────→ │  Plugin   │
│  (Browser)  │   HTTP  │    (Rust)    │   API   │  (Java)   │
└─────────────┘         └──────────────┘         └───────────┘
                                                        ↓
                                                  ┌───────────┐
                                                  │ Minecraft │
                                                  │  Server   │
                                                  └───────────┘
```

## Features

### Server Monitoring
- Real-time server metrics with live graphs (last 10 minutes)
- TPS, memory usage, CPU usage, and player count tracking
- Server uptime and current player statistics
- Automatic metric collection every 2 seconds
- Log search functionality with highlighting
- List all installed plugins

### Server Information
- Detailed server configuration display
- World information (environment, difficulty, PvP status, seed)
- GeyserMC detection and Bedrock port display
- Network information and game modes

### Player Management
- View all players who have joined the server
- See online status and play time for each player
- View player inventories
- Search players by name or UUID
- Kick online players
- Ban and unban players
- Manage operator status
- Display player heads from Mojang API

### Access Control
- Whitelist management
- Blacklist (ban list) management
- Operator list management
- Automatic UUID resolution for player names

### Server Management
- Console access with log viewing
- Command execution directly from web interface
- Graphical Server settings editor (server.properties)
- Game rules editor with categorized settings
- Server shutdown functionality
- Combined server logs (console and chat)

### File Manager
- Browse server files and directories
- Upload files to Server
- Download files from server
- Create and delete folders
- Edit files
- Rename files and folders
- View images from Server
- File sorting by name, size, or date
- File search functionality
- Change log tracking for all file operations

### Mods
- Create Custom crafting recipes

### Chat Console
- Send messages as Server to players
- Execute in-game commands with slash notation

## Getting Started

### Prerequisites

#### For the Plugin
- Java 21 or higher
- PaperMC or Spigot 1.21.1+
- Maven (for building from source)

#### For the Backend
- Docker and Docker Compose

### Step 1: Install and Configure the Plugin

1. Build the plugin:
```bash
cd plugin
mvn clean package
```

2. Copy the JAR file into the `plugins` Directory on your Minecraft server

3. Start your Minecraft server. The plugin will generate configuration files in `plugins/RandomBytesMCControl/`:
   - `plugin.config` - Contains the API port (default: 25575)
   - `API-KEY.txt` - Your unique API key for backend authentication
   - `public-key.txt` - RSA public key for encrypted communication

### Step 2: Configure and Start the Backend

1. Navigate to the backend directory:
```bash
cd backend-frontend
```

2. Create the configuration file:
```bash
cp backend.config.example backend.config
```

3. Edit `backend.config` with your server details:
```
plugin_host=your-minecraft-server-ip
plugin_port=25575
api_key=your-api-key-from-plugin
backend_port=8080
```

4. Change the Port in `docker-compose.yml` if you changed it in `backend.config`.

5. Start the backend with Docker:
```bash
sudo docker compose up --build -d
```

6. View logs (optional):
```bash
sudo docker compose logs -f
```

## Security

### Security Architecture

The system implements multiple security layers:

1. **API Key Authentication** - All backend-to-plugin communication requires a valid API key
2. **RSA-2048 Key Exchange** - Initial connection uses public key cryptography
3. **Reverse Proxy Compatible** - Can be placed behind authentication proxies

### Security Best Practices

- Deploy behind a reverse proxy with authentication (Authelia, OAuth2 Proxy, etc.)
- Use HTTPS with valid SSL certificates for remote access
- Connect over VPN or SSH tunnel when accessing over the internet

## Technical Information

### Stack
- Backend: Rust (Axum web framework, Tokio async runtime)
- Database: None (stateless, communicates directly with Minecraft server files)
- Frontend: JavaScript, HTML, CSS (no frameworks)
- Deployment: Docker Compose

### Ports (changeable)
- HTTP | Frontend: 8080 (default)
- REST API | Plugin: 25575 (default)

## Licence

This software is licensed under the GNU General Public Licence Version 3.
Refer to the LICENCE file for more information.