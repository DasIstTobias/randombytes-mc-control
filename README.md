# RandomBytes MC Control

A comprehensive, secure Minecraft server management solution consisting of three components:

1. **Plugin**: A PaperMC/Spigot plugin that provides a REST API for server control
2. **Backend**: A Rust backend server that communicates with the plugin
3. **Frontend**: A web-based UI for managing and monitoring your Minecraft server

## Features

- 🔒 **Secure**: RSA key exchange, API key authentication, and encrypted communication
- 📊 **Real-time Metrics**: Monitor server performance (TPS, memory, CPU) with live graphs
- 👥 **Player Management**: View all players, their playtime, inventory, and manage bans
- 📝 **Whitelist/Blacklist**: Easily manage server access
- 🔌 **Plugin Information**: View all installed plugins
- 💻 **Console Access**: Execute commands and view server logs
- 🐳 **Docker Ready**: Deploy with a single command

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

## Quick Start

### 1. Install the Plugin

See the [plugin README](plugin/README.md) for detailed instructions.

```bash
cd plugin
mvn clean package
# Copy target/randombytes-mc-control-1.0.0.jar to your server's plugins folder
```

After starting your Minecraft server, note the API key from the console output or from `plugins/randombytes-mc-control/API-KEY.txt`.

### 2. Configure and Start the Backend

See the [backend-frontend README](backend-frontend/README.md) for detailed instructions.

```bash
cd backend-frontend
cp backend.config.example backend.config
# Edit backend.config with your plugin's host, port, and API key
sudo docker compose up -d
```

### 3. Access the Web Interface

Open your browser to `http://localhost:8080` (or your server's IP address).

## Project Structure

```
randombytes-mc-control/
├── plugin/                    # Minecraft plugin (Java)
│   ├── src/
│   ├── pom.xml
│   └── README.md
├── backend-frontend/          # Backend & Frontend
│   ├── src/                   # Rust backend source
│   ├── frontend/              # HTML/CSS/JS frontend
│   ├── Cargo.toml
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── backend.config.example
│   └── README.md
└── README.md                  # This file
```

## Requirements

### Plugin
- Java 21 or higher
- PaperMC or Spigot 1.21.1+
- Maven (for compilation)

### Backend
- Rust 1.75+ (for manual build)
- OR Docker & Docker Compose (recommended)

### Frontend
- Modern web browser (Chrome, Firefox, Edge, Safari)
- No additional requirements (served by backend)

## Security

This system implements multiple layers of security:

1. **API Key Authentication**: The backend must provide a valid API key
2. **RSA Key Exchange**: Initial connection uses RSA-2048 encryption
3. **Session Encryption**: After authentication, communication uses AES-256
4. **No Internet Exposure Required**: Can run entirely on local network
5. **Reverse Proxy Compatible**: Designed to work behind authentication layers

### Important Security Notes

- ⚠️ Keep your API key secure and never commit it to version control
- ⚠️ The frontend has no built-in authentication (use a reverse proxy with auth)
- ⚠️ Use a VPN or SSH tunnel when connecting over the internet
- ⚠️ Consider using Authelia, OAuth2 Proxy, or similar for frontend authentication

## Documentation

- [Plugin Documentation](plugin/README.md)
- [Backend & Frontend Documentation](backend-frontend/README.md)

## Usage Examples

### Monitoring Server Performance
Access the "Server Metrics" page to view real-time graphs showing:
- TPS (Ticks Per Second)
- Memory usage percentage
- CPU usage percentage
- Player count over time

### Managing Players
1. Navigate to "Players" page
2. View all players sorted alphabetically
3. Click "Inventory" to see a player's items (when online)
4. Click "Ban" or "Unban" to manage player access

### Executing Commands
1. Go to "Console" page
2. View recent server logs
3. Type commands in the input field (without `/`)
4. Click "Execute" to run the command

### Managing Whitelist
1. Navigate to "Whitelist" page
2. Enter player name and UUID
3. Click "Add to Whitelist"
4. View current whitelist below

## Troubleshooting

### Plugin won't start
- Check Java version: `java -version` (must be 21+)
- Verify server is PaperMC or Spigot
- Check server logs for errors

### Backend can't connect to plugin
- Verify plugin is running and port is correct
- Check firewall allows connections on plugin port
- Verify API key matches plugin's API-KEY.txt
- Test connection: `curl http://plugin-host:plugin-port/api/handshake`

### Frontend not loading
- Verify backend is running: `docker compose ps`
- Check backend logs: `docker compose logs -f`
- Ensure port 8080 is not blocked by firewall

## Development

### Building from Source

**Plugin:**
```bash
cd plugin
mvn clean package
```

**Backend:**
```bash
cd backend-frontend
cargo build --release
```

### Running Tests

**Plugin:**
```bash
cd plugin
mvn test
```

**Backend:**
```bash
cd backend-frontend
cargo test
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Licence

See [LICENCE](LICENCE) file for details.

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/DasIstTobias/randombytes-mc-control/issues
- Documentation: See README files in subdirectories

## Authors

- RandomBytes
- Contributors: See GitHub contributors page