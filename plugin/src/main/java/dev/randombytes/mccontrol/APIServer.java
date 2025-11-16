package dev.randombytes.mccontrol;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.io.*;
import java.net.InetSocketAddress;
import java.security.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;

public class APIServer {
    private final MCControlPlugin plugin;
    private final int port;
    private final String apiKey;
    private final KeyPair serverKeyPair;
    private HttpServer server;
    private final Map<String, SecretKey> sessionKeys;
    
    public APIServer(MCControlPlugin plugin, int port, String apiKey, KeyPair keyPair) {
        this.plugin = plugin;
        this.port = port;
        this.apiKey = apiKey;
        this.serverKeyPair = keyPair;
        this.sessionKeys = new ConcurrentHashMap<>();
    }
    
    public void start() {
        try {
            server = HttpServer.create(new InetSocketAddress(port), 0);
            
            // Setup endpoints
            server.createContext("/api/handshake", new HandshakeHandler());
            server.createContext("/api/auth", new AuthHandler());
            server.createContext("/api/metrics", new MetricsHandler());
            server.createContext("/api/players", new PlayersHandler());
            server.createContext("/api/player", new PlayerHandler());
            server.createContext("/api/whitelist", new WhitelistHandler());
            server.createContext("/api/blacklist", new BlacklistHandler());
            server.createContext("/api/ops", new OpsHandler());
            server.createContext("/api/plugins", new PluginsHandler());
            server.createContext("/api/server", new ServerInfoHandler());
            server.createContext("/api/console", new ConsoleHandler());
            server.createContext("/api/command", new CommandHandler());
            server.createContext("/api/chat", new ChatHandler());
            server.createContext("/api/settings", new SettingsHandler());
            server.createContext("/api/restart", new RestartHandler());
            
            server.setExecutor(null);
            server.start();
            
            plugin.getLogger().info("API Server started on port " + port);
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to start API server", e);
        }
    }
    
    public void stop() {
        if (server != null) {
            server.stop(0);
            plugin.getLogger().info("API Server stopped");
        }
    }
    
    private void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        byte[] bytes = response.getBytes();
        exchange.sendResponseHeaders(statusCode, bytes.length);
        OutputStream os = exchange.getResponseBody();
        os.write(bytes);
        os.close();
    }
    
    private void sendError(HttpExchange exchange, int statusCode, String message) throws IOException {
        JsonObject error = new JsonObject();
        error.addProperty("error", message);
        sendResponse(exchange, statusCode, plugin.getGson().toJson(error));
    }
    
    private String readRequestBody(HttpExchange exchange) throws IOException {
        InputStreamReader isr = new InputStreamReader(exchange.getRequestBody(), "utf-8");
        BufferedReader br = new BufferedReader(isr);
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            sb.append(line);
        }
        return sb.toString();
    }
    
    private boolean validateAuth(HttpExchange exchange) {
        String authHeader = exchange.getRequestHeaders().getFirst("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return false;
        }
        
        String token = authHeader.substring(7);
        return token.equals(apiKey);
    }
    
    // Handshake handler for key exchange
    private class HandshakeHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equals(exchange.getRequestMethod())) {
                sendError(exchange, 405, "Method not allowed");
                return;
            }
            
            try {
                JsonObject response = new JsonObject();
                String publicKey = Base64.getEncoder().encodeToString(serverKeyPair.getPublic().getEncoded());
                response.addProperty("publicKey", publicKey);
                response.addProperty("algorithm", "RSA");
                response.addProperty("keySize", 2048);
                
                sendResponse(exchange, 200, plugin.getGson().toJson(response));
            } catch (Exception e) {
                plugin.getLogger().log(Level.SEVERE, "Handshake error", e);
                sendError(exchange, 500, "Internal server error");
            }
        }
    }
    
    // Authentication handler
    private class AuthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendError(exchange, 405, "Method not allowed");
                return;
            }
            
            try {
                String body = readRequestBody(exchange);
                JsonObject request = plugin.getGson().fromJson(body, JsonObject.class);
                
                String encryptedApiKey = request.get("apiKey").getAsString();
                String sessionId = request.get("sessionId").getAsString();
                
                // Decrypt API key with private key
                Cipher cipher = Cipher.getInstance("RSA");
                cipher.init(Cipher.DECRYPT_MODE, serverKeyPair.getPrivate());
                byte[] decryptedBytes = cipher.doFinal(Base64.getDecoder().decode(encryptedApiKey));
                String decryptedApiKey = new String(decryptedBytes);
                
                if (!decryptedApiKey.equals(apiKey)) {
                    sendError(exchange, 401, "Invalid API key");
                    return;
                }
                
                // Generate session key for this connection
                KeyGenerator keyGen = KeyGenerator.getInstance("AES");
                keyGen.init(256);
                SecretKey sessionKey = keyGen.generateKey();
                sessionKeys.put(sessionId, sessionKey);
                
                JsonObject response = new JsonObject();
                response.addProperty("authenticated", true);
                response.addProperty("sessionKey", Base64.getEncoder().encodeToString(sessionKey.getEncoded()));
                
                sendResponse(exchange, 200, plugin.getGson().toJson(response));
            } catch (Exception e) {
                plugin.getLogger().log(Level.SEVERE, "Authentication error", e);
                sendError(exchange, 500, "Internal server error");
            }
        }
    }
    
    // Metrics handler
    private class MetricsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!validateAuth(exchange)) {
                sendError(exchange, 401, "Unauthorized");
                return;
            }
            
            if (!"GET".equals(exchange.getRequestMethod())) {
                sendError(exchange, 405, "Method not allowed");
                return;
            }
            
            try {
                JsonObject metrics = plugin.getMetricsCollector().getMetrics();
                sendResponse(exchange, 200, plugin.getGson().toJson(metrics));
            } catch (Exception e) {
                plugin.getLogger().log(Level.SEVERE, "Error getting metrics", e);
                sendError(exchange, 500, "Internal server error");
            }
        }
    }
    
    // Players list handler
    private class PlayersHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!validateAuth(exchange)) {
                sendError(exchange, 401, "Unauthorized");
                return;
            }
            
            if (!"GET".equals(exchange.getRequestMethod())) {
                sendError(exchange, 405, "Method not allowed");
                return;
            }
            
            try {
                JsonObject players = plugin.getPlayerDataManager().getAllPlayersData();
                sendResponse(exchange, 200, plugin.getGson().toJson(players));
            } catch (Exception e) {
                plugin.getLogger().log(Level.SEVERE, "Error getting players", e);
                sendError(exchange, 500, "Internal server error");
            }
        }
    }
    
    // Individual player handler
    private class PlayerHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!validateAuth(exchange)) {
                sendError(exchange, 401, "Unauthorized");
                return;
            }
            
            String query = exchange.getRequestURI().getQuery();
            if (query == null || !query.startsWith("uuid=")) {
                sendError(exchange, 400, "UUID parameter required");
                return;
            }
            
            String uuid = query.substring(5);
            
            if ("GET".equals(exchange.getRequestMethod())) {
                try {
                    JsonObject playerData = plugin.getPlayerDataManager().getPlayerData(uuid);
                    if (playerData == null) {
                        sendError(exchange, 404, "Player not found");
                        return;
                    }
                    sendResponse(exchange, 200, plugin.getGson().toJson(playerData));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error getting player data", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else if ("POST".equals(exchange.getRequestMethod())) {
                try {
                    String body = readRequestBody(exchange);
                    JsonObject request = plugin.getGson().fromJson(body, JsonObject.class);
                    String action = request.get("action").getAsString();
                    
                    Bukkit.getScheduler().runTask(plugin, () -> {
                        plugin.getPlayerDataManager().performPlayerAction(uuid, action);
                    });
                    
                    JsonObject response = new JsonObject();
                    response.addProperty("success", true);
                    sendResponse(exchange, 200, plugin.getGson().toJson(response));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error performing player action", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else {
                sendError(exchange, 405, "Method not allowed");
            }
        }
    }
    
    // Whitelist handler
    private class WhitelistHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!validateAuth(exchange)) {
                sendError(exchange, 401, "Unauthorized");
                return;
            }
            
            if ("GET".equals(exchange.getRequestMethod())) {
                try {
                    JsonObject whitelist = plugin.getPlayerDataManager().getWhitelist();
                    sendResponse(exchange, 200, plugin.getGson().toJson(whitelist));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error getting whitelist", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else if ("POST".equals(exchange.getRequestMethod())) {
                try {
                    String body = readRequestBody(exchange);
                    JsonObject request = plugin.getGson().fromJson(body, JsonObject.class);
                    String name = request.get("name").getAsString();
                    String uuid = request.get("uuid").getAsString();
                    
                    Bukkit.getScheduler().runTask(plugin, () -> {
                        plugin.getPlayerDataManager().addToWhitelist(name, uuid);
                    });
                    
                    JsonObject response = new JsonObject();
                    response.addProperty("success", true);
                    sendResponse(exchange, 200, plugin.getGson().toJson(response));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error adding to whitelist", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else if ("DELETE".equals(exchange.getRequestMethod())) {
                try {
                    String query = exchange.getRequestURI().getQuery();
                    if (query == null || !query.startsWith("uuid=")) {
                        sendError(exchange, 400, "UUID parameter required");
                        return;
                    }
                    String uuid = query.substring(5);
                    
                    Bukkit.getScheduler().runTask(plugin, () -> {
                        plugin.getPlayerDataManager().removeFromWhitelist(uuid);
                    });
                    
                    JsonObject response = new JsonObject();
                    response.addProperty("success", true);
                    sendResponse(exchange, 200, plugin.getGson().toJson(response));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error removing from whitelist", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else {
                sendError(exchange, 405, "Method not allowed");
            }
        }
    }
    
    // Blacklist handler (ban list)
    private class BlacklistHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!validateAuth(exchange)) {
                sendError(exchange, 401, "Unauthorized");
                return;
            }
            
            if ("GET".equals(exchange.getRequestMethod())) {
                try {
                    JsonObject blacklist = plugin.getPlayerDataManager().getBlacklist();
                    sendResponse(exchange, 200, plugin.getGson().toJson(blacklist));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error getting blacklist", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else if ("POST".equals(exchange.getRequestMethod())) {
                try {
                    String body = readRequestBody(exchange);
                    JsonObject request = plugin.getGson().fromJson(body, JsonObject.class);
                    String name = request.get("name").getAsString();
                    String uuid = request.get("uuid").getAsString();
                    
                    Bukkit.getScheduler().runTask(plugin, () -> {
                        plugin.getPlayerDataManager().addToBlacklist(name, uuid);
                    });
                    
                    JsonObject response = new JsonObject();
                    response.addProperty("success", true);
                    sendResponse(exchange, 200, plugin.getGson().toJson(response));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error adding to blacklist", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else if ("DELETE".equals(exchange.getRequestMethod())) {
                try {
                    String query = exchange.getRequestURI().getQuery();
                    if (query == null || !query.startsWith("uuid=")) {
                        sendError(exchange, 400, "UUID parameter required");
                        return;
                    }
                    String uuid = query.substring(5);
                    
                    Bukkit.getScheduler().runTask(plugin, () -> {
                        plugin.getPlayerDataManager().removeFromBlacklist(uuid);
                    });
                    
                    JsonObject response = new JsonObject();
                    response.addProperty("success", true);
                    sendResponse(exchange, 200, plugin.getGson().toJson(response));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error removing from blacklist", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else {
                sendError(exchange, 405, "Method not allowed");
            }
        }
    }
    
    // Plugins handler
    private class PluginsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!validateAuth(exchange)) {
                sendError(exchange, 401, "Unauthorized");
                return;
            }
            
            if (!"GET".equals(exchange.getRequestMethod())) {
                sendError(exchange, 405, "Method not allowed");
                return;
            }
            
            try {
                JsonObject plugins = plugin.getPlayerDataManager().getPluginsList();
                sendResponse(exchange, 200, plugin.getGson().toJson(plugins));
            } catch (Exception e) {
                plugin.getLogger().log(Level.SEVERE, "Error getting plugins", e);
                sendError(exchange, 500, "Internal server error");
            }
        }
    }
    
    // Server info handler
    private class ServerInfoHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!validateAuth(exchange)) {
                sendError(exchange, 401, "Unauthorized");
                return;
            }
            
            if (!"GET".equals(exchange.getRequestMethod())) {
                sendError(exchange, 405, "Method not allowed");
                return;
            }
            
            try {
                JsonObject serverInfo = plugin.getPlayerDataManager().getServerInfo();
                sendResponse(exchange, 200, plugin.getGson().toJson(serverInfo));
            } catch (Exception e) {
                plugin.getLogger().log(Level.SEVERE, "Error getting server info", e);
                sendError(exchange, 500, "Internal server error");
            }
        }
    }
    
    // Console handler
    private class ConsoleHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!validateAuth(exchange)) {
                sendError(exchange, 401, "Unauthorized");
                return;
            }
            
            if (!"GET".equals(exchange.getRequestMethod())) {
                sendError(exchange, 405, "Method not allowed");
                return;
            }
            
            try {
                JsonObject logs = plugin.getPlayerDataManager().getConsoleLogs();
                sendResponse(exchange, 200, plugin.getGson().toJson(logs));
            } catch (Exception e) {
                plugin.getLogger().log(Level.SEVERE, "Error getting console logs", e);
                sendError(exchange, 500, "Internal server error");
            }
        }
    }
    
    // Command handler
    private class CommandHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!validateAuth(exchange)) {
                sendError(exchange, 401, "Unauthorized");
                return;
            }
            
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendError(exchange, 405, "Method not allowed");
                return;
            }
            
            try {
                String body = readRequestBody(exchange);
                JsonObject request = plugin.getGson().fromJson(body, JsonObject.class);
                String command = request.get("command").getAsString();
                
                Bukkit.getScheduler().runTask(plugin, () -> {
                    Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command);
                });
                
                JsonObject response = new JsonObject();
                response.addProperty("success", true);
                sendResponse(exchange, 200, plugin.getGson().toJson(response));
            } catch (Exception e) {
                plugin.getLogger().log(Level.SEVERE, "Error executing command", e);
                sendError(exchange, 500, "Internal server error");
            }
        }
    }
    
    // OPs handler
    private class OpsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!validateAuth(exchange)) {
                sendError(exchange, 401, "Unauthorized");
                return;
            }
            
            if ("GET".equals(exchange.getRequestMethod())) {
                try {
                    JsonObject ops = plugin.getPlayerDataManager().getOps();
                    sendResponse(exchange, 200, plugin.getGson().toJson(ops));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error getting ops", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else if ("POST".equals(exchange.getRequestMethod())) {
                try {
                    String body = readRequestBody(exchange);
                    JsonObject request = plugin.getGson().fromJson(body, JsonObject.class);
                    String name = request.get("name").getAsString();
                    String uuid = request.get("uuid").getAsString();
                    
                    Bukkit.getScheduler().runTask(plugin, () -> {
                        plugin.getPlayerDataManager().addToOps(name, uuid);
                    });
                    
                    JsonObject response = new JsonObject();
                    response.addProperty("success", true);
                    sendResponse(exchange, 200, plugin.getGson().toJson(response));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error adding op", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else if ("DELETE".equals(exchange.getRequestMethod())) {
                try {
                    String query = exchange.getRequestURI().getQuery();
                    if (query == null || !query.startsWith("uuid=")) {
                        sendError(exchange, 400, "UUID parameter required");
                        return;
                    }
                    String uuid = query.substring(5);
                    
                    Bukkit.getScheduler().runTask(plugin, () -> {
                        plugin.getPlayerDataManager().removeFromOps(uuid);
                    });
                    
                    JsonObject response = new JsonObject();
                    response.addProperty("success", true);
                    sendResponse(exchange, 200, plugin.getGson().toJson(response));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error removing op", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else {
                sendError(exchange, 405, "Method not allowed");
            }
        }
    }
    
    // Chat handler
    private class ChatHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!validateAuth(exchange)) {
                sendError(exchange, 401, "Unauthorized");
                return;
            }
            
            if ("GET".equals(exchange.getRequestMethod())) {
                try {
                    JsonObject logs = plugin.getPlayerDataManager().getChatLogs();
                    sendResponse(exchange, 200, plugin.getGson().toJson(logs));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error getting chat logs", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else if ("POST".equals(exchange.getRequestMethod())) {
                try {
                    String body = readRequestBody(exchange);
                    JsonObject request = plugin.getGson().fromJson(body, JsonObject.class);
                    String message = request.get("message").getAsString();
                    
                    Bukkit.getScheduler().runTask(plugin, () -> {
                        plugin.getPlayerDataManager().sendChatMessage(message);
                    });
                    
                    JsonObject response = new JsonObject();
                    response.addProperty("success", true);
                    sendResponse(exchange, 200, plugin.getGson().toJson(response));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error sending chat message", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else {
                sendError(exchange, 405, "Method not allowed");
            }
        }
    }
    
    // Settings handler
    private class SettingsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!validateAuth(exchange)) {
                sendError(exchange, 401, "Unauthorized");
                return;
            }
            
            String path = exchange.getRequestURI().getPath();
            
            if ("GET".equals(exchange.getRequestMethod()) && "/api/settings".equals(path)) {
                try {
                    JsonObject settings = plugin.getPlayerDataManager().getSettings();
                    sendResponse(exchange, 200, plugin.getGson().toJson(settings));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error getting settings", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else if ("POST".equals(exchange.getRequestMethod())) {
                try {
                    String body = readRequestBody(exchange);
                    JsonObject request = plugin.getGson().fromJson(body, JsonObject.class);
                    
                    if (path.endsWith("/properties")) {
                        JsonObject properties = request.getAsJsonObject("properties");
                        Bukkit.getScheduler().runTask(plugin, () -> {
                            plugin.getPlayerDataManager().updateServerProperties(properties);
                        });
                    } else if (path.endsWith("/gamerules")) {
                        JsonObject gamerules = request.getAsJsonObject("gamerules");
                        Bukkit.getScheduler().runTask(plugin, () -> {
                            plugin.getPlayerDataManager().updateGameRules(gamerules);
                        });
                    } else {
                        sendError(exchange, 404, "Unknown settings endpoint");
                        return;
                    }
                    
                    JsonObject response = new JsonObject();
                    response.addProperty("success", true);
                    sendResponse(exchange, 200, plugin.getGson().toJson(response));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.SEVERE, "Error updating settings", e);
                    sendError(exchange, 500, "Internal server error");
                }
            } else {
                sendError(exchange, 405, "Method not allowed");
            }
        }
    }
    
    // Restart handler
    private class RestartHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!validateAuth(exchange)) {
                sendError(exchange, 401, "Unauthorized");
                return;
            }
            
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendError(exchange, 405, "Method not allowed");
                return;
            }
            
            try {
                JsonObject response = new JsonObject();
                response.addProperty("success", true);
                response.addProperty("message", "Server restart initiated");
                sendResponse(exchange, 200, plugin.getGson().toJson(response));
                
                // Schedule server restart
                Bukkit.getScheduler().runTaskLater(plugin, () -> {
                    Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "stop");
                }, 20L); // 1 second delay
            } catch (Exception e) {
                plugin.getLogger().log(Level.SEVERE, "Error shutting down server", e);
                sendError(exchange, 500, "Internal server error");
            }
        }
    }
}
