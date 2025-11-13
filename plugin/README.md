# RandomBytes MC Control Plugin

A secure Minecraft PaperMC/Spigot plugin that provides a REST API for server management and monitoring.

## Features

- Secure REST API with RSA key exchange and API key authentication
- Real-time server metrics collection (TPS, memory, CPU usage)
- Player management (list, ban, kick, inventory viewing)
- Whitelist and blacklist management
- Server information and plugin listing
- Console log access and command execution
- Encrypted communication between plugin and backend

## Requirements

- Java 21 or higher
- PaperMC or Spigot server version 1.21.1+
- Maven (for compilation)

## Compilation

To compile the plugin into a JAR file:

```bash
cd plugin
mvn clean package
```

The compiled JAR file will be located at `target/randombytes-mc-control-1.0.0.jar`.

## Installation

1. Compile the plugin (see above) or download the pre-compiled JAR
2. Copy `randombytes-mc-control-1.0.0.jar` to your server's `plugins` directory
3. Start or restart your Minecraft server
4. The plugin will automatically create a configuration directory at `plugins/randombytes-mc-control/`

## Configuration

After first startup, the plugin creates the following files in `plugins/randombytes-mc-control/`:

### plugin.config
Contains the port number for the API server:
```
port=25575
```

You can change this port if needed. Default is 25575.

### API-KEY.txt
Contains the generated API key for backend authentication. This key is automatically generated on first run.

**IMPORTANT:** Keep this key secure! You will need it to configure the backend.

The API key will be displayed in the console on first startup:
```
===========================================
NEW API KEY GENERATED!
API Key: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Save this key securely for backend configuration!
===========================================
```

### public-key.txt
Contains the RSA public key used for initial key exchange with the backend. This is automatically generated and used for secure communication setup.

## API Endpoints

The plugin exposes the following REST API endpoints:

- `GET /api/handshake` - Get server's public key for secure connection setup
- `POST /api/auth` - Authenticate and establish encrypted session
- `GET /api/metrics` - Get server metrics (TPS, memory, CPU, player count)
- `GET /api/players` - Get list of all players
- `GET /api/player?uuid=<uuid>` - Get specific player data
- `POST /api/player?uuid=<uuid>` - Perform action on player (ban, unban, kick)
- `GET /api/whitelist` - Get whitelist
- `POST /api/whitelist` - Add player to whitelist
- `GET /api/blacklist` - Get blacklist (ban list)
- `POST /api/blacklist` - Add player to blacklist
- `GET /api/plugins` - Get list of installed plugins
- `GET /api/server` - Get server information
- `GET /api/console` - Get console logs
- `POST /api/command` - Execute server command

All endpoints except `/api/handshake` require authentication via the `Authorization: Bearer <API_KEY>` header.

## Security

The plugin implements several security measures:

1. **API Key Authentication**: All requests must include a valid API key
2. **RSA Key Exchange**: Initial connection uses RSA-2048 encryption for key exchange
3. **Session Encryption**: After authentication, communication uses AES-256 encryption
4. **File Permissions**: API key file is set to be readable only by the server owner
5. **No Plain-Text Secrets**: API keys and session keys are never transmitted unencrypted

## Troubleshooting

### Port Already in Use
If you see an error about the port being in use, change the port number in `plugin.config` and restart the server.

### Connection Refused
Make sure your server's firewall allows incoming connections on the configured port.

### API Key Not Working
Regenerate the API key by:
1. Stop the server
2. Delete `plugins/randombytes-mc-control/API-KEY.txt`
3. Start the server
4. Note the new API key from the console
5. Update your backend configuration

## Support

For issues, questions, or contributions, please visit:
https://github.com/DasIstTobias/randombytes-mc-control
