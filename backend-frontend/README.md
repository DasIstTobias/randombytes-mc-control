# RandomBytes MC Control Backend & Frontend

The backend is a Rust web server that connects to the Minecraft plugin and provides a web interface for server management.

## Features

- Secure connection to Minecraft plugin via REST API
- Web-based user interface
- Real-time server metrics and monitoring
- Player management
- Console access
- Docker support for easy deployment

## Requirements

- Rust 1.75 or higher (for manual compilation)
- Docker and Docker Compose V2 (for containerised deployment)
  - Note: Docker Compose V2 uses `docker compose` (without hyphen) instead of `docker-compose`
  - Check version: `docker compose version`
- Active RandomBytes MC Control plugin on your Minecraft server

## Quick Start with Docker

**Important:** Make sure you have created the `backend.config` file before starting Docker Compose, or the container will fail to start.

1. Copy the example configuration:
   ```bash
   cp backend.config.example backend.config
   ```

2. Edit `backend.config` with your settings:
   ```
   plugin_host=your-minecraft-server-ip
   plugin_port=25575
   api_key=your-api-key-from-plugin
   backend_port=8080
   ```

3. Start the backend:
   ```bash
   docker compose up -d
   ```
   
   Or with sudo if needed:
   ```bash
   sudo docker compose up -d
   ```

4. Access the web interface:
   - Open your browser to `http://localhost:8080`
   - Or `http://your-server-ip:8080` if accessing remotely

5. View logs:
   ```bash
   sudo docker compose logs -f
   ```

6. Stop the backend:
   ```bash
   sudo docker compose down
   ```

## Manual Installation (without Docker)

1. Install Rust:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. Copy the example configuration:
   ```bash
   cp backend.config.example backend.config
   ```

3. Edit `backend.config` with your Minecraft server details

4. Build the backend:
   ```bash
   cargo build --release
   ```

5. Run the backend:
   ```bash
   ./target/release/randombytes-mc-control-backend
   ```

## Configuration

The `backend.config` file contains all configuration options:

- **plugin_host**: IP address or hostname of your Minecraft server
- **plugin_port**: Port number of the plugin API (default: 25575)
- **api_key**: The API key from the plugin's `API-KEY.txt` file
- **backend_port**: Port for the web interface (default: 8080)

## Security Considerations

### Network Configuration

The backend needs to connect to your Minecraft server's plugin API. If they're on different servers:

1. The Minecraft server must allow incoming connections on the plugin port
2. Use a VPN or SSH tunnel for secure connections over the internet
3. Consider using a reverse proxy with authentication (e.g., Authelia, OAuth2 Proxy)

### Firewall Rules

Example firewall rules for Ubuntu/Debian:
```bash
# Allow backend web interface
sudo ufw allow 8080/tcp

# On the Minecraft server, allow plugin API from backend server
sudo ufw allow from <backend-server-ip> to any port 25575
```

### Reverse Proxy Setup

For production use, it's recommended to place the backend behind a reverse proxy with authentication:

#### Nginx Example:
```nginx
server {
    listen 443 ssl;
    server_name mc-control.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Frontend

The frontend is a single-page application built with vanilla HTML, CSS, and JavaScript. It provides:

- **Server Metrics**: Real-time graphs of TPS, memory, CPU usage, and player count
- **Players**: List of all players with online status, play time, and management options
- **Whitelist**: View and manage the server whitelist
- **Blacklist**: View and manage banned players
- **Operators**: Manage server operators
- **Plugins**: List of installed plugins
- **Server Info**: Detailed server information
- **Console**: View logs and execute commands
- **Chat**: Send messages and commands as the server
- **Server Settings**: Configure server properties and game rules
- **Custom Recipes**: Create and manage custom crafting recipes
- **File Manager**: Browse, upload, download, edit, and manage server files securely
  - Browse directories within the Minecraft server folder
  - Upload files with drag & drop support (up to 100MB)
  - Create and delete folders
  - Rename files and folders
  - Edit text files inline (`.txt`, `.yml`, `.json`, `.properties`, etc.)
  - Search and filter files
  - Sort by name, size, or modified date
  - Context menu for quick actions
  - Path traversal protection

The frontend automatically connects to the backend API and updates in real-time.

## Troubleshooting

### Backend won't start

1. Check the configuration file exists and is valid
2. Verify the Minecraft plugin is running
3. Test connectivity: `curl http://plugin-host:plugin-port/api/handshake`
4. Check logs for detailed error messages

### Can't connect to plugin

1. Verify the plugin port is open: `telnet plugin-host plugin-port`
2. Check firewall rules on both servers
3. Verify the API key matches the plugin's `API-KEY.txt`
4. Check plugin logs on the Minecraft server

### Frontend not loading

1. Check the `frontend` directory exists and contains files
2. Verify the backend is running: `curl http://localhost:8080`
3. Check browser console for errors
4. Ensure the backend port isn't blocked by firewall

### API errors

1. Verify the API key in `backend.config` matches the plugin
2. Check plugin logs for authentication failures
3. Try regenerating the API key on the plugin

## Development

To run in development mode with auto-reload:

```bash
cargo watch -x run
```

To run tests:

```bash
cargo test
```

## Support

For issues, questions, or contributions, please visit:
https://github.com/DasIstTobias/randombytes-mc-control
