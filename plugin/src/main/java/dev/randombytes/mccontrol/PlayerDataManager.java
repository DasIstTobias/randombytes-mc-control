package dev.randombytes.mccontrol;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.Plugin;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

public class PlayerDataManager {
    private final MCControlPlugin plugin;
    private final Map<UUID, PlayerData> playerDataCache;
    private final List<String> consoleLogBuffer;
    private final List<String> chatLogBuffer;
    private final int maxLogLines = 1000;
    
    public PlayerDataManager(MCControlPlugin plugin) {
        this.plugin = plugin;
        this.playerDataCache = new ConcurrentHashMap<>();
        this.consoleLogBuffer = Collections.synchronizedList(new ArrayList<>());
        this.chatLogBuffer = Collections.synchronizedList(new ArrayList<>());
        
        // Register event listeners
        Bukkit.getPluginManager().registerEvents(new PlayerTrackingListener(this), plugin);
        
        // Load existing player data
        loadPlayerData();
    }
    
    private void loadPlayerData() {
        // Load data from usercache.json or custom storage
        for (OfflinePlayer player : Bukkit.getOfflinePlayers()) {
            UUID uuid = player.getUniqueId();
            if (!playerDataCache.containsKey(uuid)) {
                playerDataCache.put(uuid, new PlayerData(player));
            }
        }
    }
    
    public void updatePlayerData(Player player) {
        UUID uuid = player.getUniqueId();
        PlayerData data = playerDataCache.computeIfAbsent(uuid, k -> new PlayerData(player));
        data.update(player);
    }
    
    public JsonObject getAllPlayersData() {
        JsonObject result = new JsonObject();
        JsonArray players = new JsonArray();
        
        List<PlayerData> sortedPlayers = playerDataCache.values().stream()
            .sorted(Comparator.comparing(p -> p.name.toLowerCase()))
            .collect(Collectors.toList());
        
        for (PlayerData data : sortedPlayers) {
            JsonObject playerObj = new JsonObject();
            playerObj.addProperty("uuid", data.uuid.toString());
            playerObj.addProperty("name", data.name);
            playerObj.addProperty("online", data.isOnline);
            playerObj.addProperty("lastSeen", data.lastSeen);
            playerObj.addProperty("playTime", data.playTime);
            playerObj.addProperty("banned", data.isBanned);
            
            // Add OP status
            OfflinePlayer player = Bukkit.getOfflinePlayer(data.uuid);
            playerObj.addProperty("op", player.isOp());
            
            players.add(playerObj);
        }
        
        result.add("players", players);
        return result;
    }
    
    public JsonObject getPlayerData(String uuidStr) {
        try {
            UUID uuid = UUID.fromString(uuidStr);
            PlayerData data = playerDataCache.get(uuid);
            
            if (data == null) {
                return null;
            }
            
            JsonObject result = new JsonObject();
            result.addProperty("uuid", data.uuid.toString());
            result.addProperty("name", data.name);
            result.addProperty("online", data.isOnline);
            result.addProperty("lastSeen", data.lastSeen);
            result.addProperty("playTime", data.playTime);
            result.addProperty("banned", data.isBanned);
            
            // Get inventory if player is online
            Player player = Bukkit.getPlayer(uuid);
            if (player != null && player.isOnline()) {
                JsonArray inventory = getPlayerInventory(player);
                result.add("inventory", inventory);
            }
            
            return result;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
    
    private JsonArray getPlayerInventory(Player player) {
        JsonArray inventory = new JsonArray();
        Map<String, Integer> itemCounts = new TreeMap<>();
        
        for (ItemStack item : player.getInventory().getContents()) {
            if (item != null && item.getType() != Material.AIR) {
                String itemId = item.getType().getKey().toString();
                itemCounts.merge(itemId, item.getAmount(), Integer::sum);
            }
        }
        
        for (Map.Entry<String, Integer> entry : itemCounts.entrySet()) {
            JsonObject itemObj = new JsonObject();
            itemObj.addProperty("id", entry.getKey());
            itemObj.addProperty("name", formatItemName(entry.getKey()));
            itemObj.addProperty("count", entry.getValue());
            inventory.add(itemObj);
        }
        
        return inventory;
    }
    
    private String formatItemName(String itemId) {
        String name = itemId.substring(itemId.indexOf(':') + 1);
        return Arrays.stream(name.split("_"))
            .map(word -> word.substring(0, 1).toUpperCase() + word.substring(1).toLowerCase())
            .collect(Collectors.joining(" "));
    }
    
    public void performPlayerAction(String uuidStr, String action) {
        try {
            UUID uuid = UUID.fromString(uuidStr);
            OfflinePlayer player = Bukkit.getOfflinePlayer(uuid);
            
            switch (action.toLowerCase()) {
                case "ban":
                    player.ban("Banned via MC Control", (Date) null, null);
                    PlayerData data = playerDataCache.get(uuid);
                    if (data != null) {
                        data.isBanned = true;
                    }
                    break;
                case "unban":
                    player.setWhitelisted(false);
                    Bukkit.getBanList(BanList.Type.NAME).pardon(player.getName());
                    Bukkit.getBanList(BanList.Type.IP).pardon(player.getName());
                    PlayerData data2 = playerDataCache.get(uuid);
                    if (data2 != null) {
                        data2.isBanned = false;
                    }
                    break;
                case "kick":
                    Player onlinePlayer = Bukkit.getPlayer(uuid);
                    if (onlinePlayer != null && onlinePlayer.isOnline()) {
                        onlinePlayer.kickPlayer("Kicked via MC Control");
                    }
                    break;
                case "op":
                    player.setOp(true);
                    break;
                case "deop":
                    player.setOp(false);
                    break;
            }
        } catch (IllegalArgumentException e) {
            plugin.getLogger().warning("Invalid UUID for player action: " + uuidStr);
        }
    }
    
    public JsonObject getWhitelist() {
        JsonObject result = new JsonObject();
        JsonArray whitelist = new JsonArray();
        
        for (OfflinePlayer player : Bukkit.getWhitelistedPlayers()) {
            JsonObject entry = new JsonObject();
            entry.addProperty("name", player.getName());
            entry.addProperty("uuid", player.getUniqueId().toString());
            whitelist.add(entry);
        }
        
        result.add("whitelist", whitelist);
        result.addProperty("enabled", Bukkit.hasWhitelist());
        return result;
    }
    
    public void addToWhitelist(String name, String uuidStr) {
        try {
            UUID uuid = UUID.fromString(uuidStr);
            OfflinePlayer player = Bukkit.getOfflinePlayer(uuid);
            player.setWhitelisted(true);
        } catch (IllegalArgumentException e) {
            plugin.getLogger().warning("Invalid UUID for whitelist: " + uuidStr);
        }
    }
    
    public JsonObject getBlacklist() {
        JsonObject result = new JsonObject();
        JsonArray blacklist = new JsonArray();
        
        for (OfflinePlayer player : Bukkit.getBannedPlayers()) {
            JsonObject entry = new JsonObject();
            entry.addProperty("name", player.getName());
            entry.addProperty("uuid", player.getUniqueId().toString());
            blacklist.add(entry);
        }
        
        result.add("blacklist", blacklist);
        return result;
    }
    
    public void addToBlacklist(String name, String uuidStr) {
        try {
            UUID uuid = UUID.fromString(uuidStr);
            OfflinePlayer player = Bukkit.getOfflinePlayer(uuid);
            player.ban("Banned via MC Control", (Date) null, null);
            
            PlayerData data = playerDataCache.get(uuid);
            if (data != null) {
                data.isBanned = true;
            }
        } catch (IllegalArgumentException e) {
            plugin.getLogger().warning("Invalid UUID for blacklist: " + uuidStr);
        }
    }
    
    public JsonObject getPluginsList() {
        JsonObject result = new JsonObject();
        JsonArray plugins = new JsonArray();
        
        for (Plugin p : Bukkit.getPluginManager().getPlugins()) {
            JsonObject pluginObj = new JsonObject();
            pluginObj.addProperty("name", p.getName());
            pluginObj.addProperty("version", p.getDescription().getVersion());
            pluginObj.addProperty("enabled", p.isEnabled());
            pluginObj.addProperty("author", String.join(", ", p.getDescription().getAuthors()));
            plugins.add(pluginObj);
        }
        
        result.add("plugins", plugins);
        return result;
    }
    
    public JsonObject getServerInfo() {
        JsonObject result = new JsonObject();
        
        result.addProperty("name", Bukkit.getServer().getName());
        result.addProperty("version", Bukkit.getVersion());
        result.addProperty("bukkitVersion", Bukkit.getBukkitVersion());
        // Extract Minecraft version from Bukkit version (format: "1.21.1-R0.1-SNAPSHOT")
        String minecraftVersion = Bukkit.getBukkitVersion().split("-")[0];
        result.addProperty("minecraftVersion", minecraftVersion);
        result.addProperty("onlineMode", Bukkit.getOnlineMode());
        result.addProperty("maxPlayers", Bukkit.getMaxPlayers());
        result.addProperty("currentPlayers", Bukkit.getOnlinePlayers().size());
        result.addProperty("port", Bukkit.getPort());
        result.addProperty("ip", Bukkit.getIp());
        result.addProperty("motd", Bukkit.getMotd());
        result.addProperty("whitelistEnabled", Bukkit.hasWhitelist());
        result.addProperty("allowFlight", Bukkit.getAllowFlight());
        result.addProperty("allowNether", Bukkit.getAllowNether());
        result.addProperty("allowEnd", Bukkit.getAllowEnd());
        
        // World information
        JsonArray worlds = new JsonArray();
        for (World world : Bukkit.getWorlds()) {
            JsonObject worldObj = new JsonObject();
            worldObj.addProperty("name", world.getName());
            worldObj.addProperty("environment", world.getEnvironment().name());
            worldObj.addProperty("seed", world.getSeed());
            worldObj.addProperty("difficulty", world.getDifficulty().name());
            worldObj.addProperty("pvp", world.getPVP());
            worlds.add(worldObj);
        }
        result.add("worlds", worlds);
        
        return result;
    }
    
    public JsonObject getConsoleLogs() {
        JsonObject result = new JsonObject();
        JsonArray logs = new JsonArray();
        
        synchronized (consoleLogBuffer) {
            for (String log : consoleLogBuffer) {
                logs.add(log);
            }
        }
        
        result.add("logs", logs);
        return result;
    }
    
    public void addConsoleLog(String message) {
        synchronized (consoleLogBuffer) {
            consoleLogBuffer.add(message);
            if (consoleLogBuffer.size() > maxLogLines) {
                consoleLogBuffer.remove(0);
            }
        }
    }
    
    public void removeFromWhitelist(String uuidStr) {
        try {
            UUID uuid = UUID.fromString(uuidStr);
            OfflinePlayer player = Bukkit.getOfflinePlayer(uuid);
            player.setWhitelisted(false);
        } catch (IllegalArgumentException e) {
            plugin.getLogger().warning("Invalid UUID for whitelist removal: " + uuidStr);
        }
    }
    
    public void removeFromBlacklist(String uuidStr) {
        try {
            UUID uuid = UUID.fromString(uuidStr);
            OfflinePlayer player = Bukkit.getOfflinePlayer(uuid);
            Bukkit.getBanList(BanList.Type.NAME).pardon(player.getName());
            Bukkit.getBanList(BanList.Type.IP).pardon(player.getName());
            
            PlayerData data = playerDataCache.get(uuid);
            if (data != null) {
                data.isBanned = false;
            }
        } catch (IllegalArgumentException e) {
            plugin.getLogger().warning("Invalid UUID for blacklist removal: " + uuidStr);
        }
    }
    
    public JsonObject getOps() {
        JsonObject result = new JsonObject();
        JsonArray ops = new JsonArray();
        
        for (OfflinePlayer player : Bukkit.getOperators()) {
            JsonObject entry = new JsonObject();
            entry.addProperty("name", player.getName());
            entry.addProperty("uuid", player.getUniqueId().toString());
            ops.add(entry);
        }
        
        result.add("ops", ops);
        return result;
    }
    
    public void addToOps(String name, String uuidStr) {
        try {
            UUID uuid = UUID.fromString(uuidStr);
            OfflinePlayer player = Bukkit.getOfflinePlayer(uuid);
            player.setOp(true);
        } catch (IllegalArgumentException e) {
            plugin.getLogger().warning("Invalid UUID for ops: " + uuidStr);
        }
    }
    
    public void removeFromOps(String uuidStr) {
        try {
            UUID uuid = UUID.fromString(uuidStr);
            OfflinePlayer player = Bukkit.getOfflinePlayer(uuid);
            player.setOp(false);
        } catch (IllegalArgumentException e) {
            plugin.getLogger().warning("Invalid UUID for ops removal: " + uuidStr);
        }
    }
    
    public JsonObject getChatLogs() {
        JsonObject result = new JsonObject();
        JsonArray logs = new JsonArray();
        
        synchronized (chatLogBuffer) {
            for (String log : chatLogBuffer) {
                logs.add(log);
            }
        }
        
        result.add("logs", logs);
        return result;
    }
    
    public void addChatLog(String message) {
        synchronized (chatLogBuffer) {
            chatLogBuffer.add(message);
            if (chatLogBuffer.size() > maxLogLines) {
                chatLogBuffer.remove(0);
            }
        }
    }
    
    public void sendChatMessage(String message) {
        if (message.startsWith("/")) {
            // Execute command
            String command = message.substring(1);
            Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command);
            addChatLog("[Server executed: " + message + "]");
        } else {
            // Broadcast message as Server
            Bukkit.broadcastMessage("§e[Server]§f " + message);
            addChatLog("[Server] " + message);
        }
    }
    
    public JsonObject getSettings() {
        JsonObject result = new JsonObject();
        JsonObject properties = new JsonObject();
        JsonObject gamerules = new JsonObject();
        
        // Get some common server properties
        properties.addProperty("motd", Bukkit.getMotd());
        properties.addProperty("max-players", Bukkit.getMaxPlayers());
        properties.addProperty("online-mode", Bukkit.getOnlineMode());
        properties.addProperty("allow-flight", Bukkit.getAllowFlight());
        properties.addProperty("allow-nether", Bukkit.getAllowNether());
        properties.addProperty("allow-end", Bukkit.getAllowEnd());
        properties.addProperty("difficulty", Bukkit.getWorlds().get(0).getDifficulty().toString());
        properties.addProperty("whitelist", Bukkit.hasWhitelist());
        
        // Get game rules from the main world
        World mainWorld = Bukkit.getWorlds().get(0);
        for (GameRule<?> rule : GameRule.values()) {
            try {
                Object value = mainWorld.getGameRuleValue(rule);
                if (value != null) {
                    gamerules.addProperty(rule.getName(), value.toString());
                }
            } catch (IllegalArgumentException e) {
                // Skip gamerules that are not available in this server version
                plugin.getLogger().fine("GameRule '" + rule.getName() + "' is not available, skipping");
            }
        }
        
        result.add("properties", properties);
        result.add("gamerules", gamerules);
        return result;
    }
    
    public void updateServerProperties(JsonObject properties) {
        // Note: Most server properties require server restart to take effect
        // We can only change a few at runtime
        if (properties.has("motd")) {
            // Cannot set MOTD at runtime without reflection or server.properties edit
            plugin.getLogger().info("MOTD change requires server restart");
        }
        if (properties.has("whitelist")) {
            Bukkit.setWhitelist(properties.get("whitelist").getAsBoolean());
        }
        plugin.getLogger().info("Most server properties require restart to take effect");
    }
    
    public void updateGameRules(JsonObject gamerules) {
        World mainWorld = Bukkit.getWorlds().get(0);
        
        for (String key : gamerules.keySet()) {
            String value = gamerules.get(key).getAsString();
            
            // Try to set the game rule
            for (GameRule<?> rule : GameRule.values()) {
                if (rule.getName().equals(key)) {
                    if (rule.getType() == Boolean.class) {
                        mainWorld.setGameRule((GameRule<Boolean>) rule, Boolean.parseBoolean(value));
                    } else if (rule.getType() == Integer.class) {
                        mainWorld.setGameRule((GameRule<Integer>) rule, Integer.parseInt(value));
                    }
                    break;
                }
            }
        }
    }
    
    private static class PlayerData {
        UUID uuid;
        String name;
        boolean isOnline;
        long lastSeen;
        long playTime;
        boolean isBanned;
        long sessionStart;
        
        PlayerData(OfflinePlayer player) {
            this.uuid = player.getUniqueId();
            this.name = player.getName();
            this.isOnline = player.isOnline();
            this.lastSeen = player.getLastPlayed();
            this.playTime = player.getStatistic(Statistic.PLAY_ONE_MINUTE) / 20; // Convert ticks to seconds
            this.isBanned = player.isBanned();
            this.sessionStart = System.currentTimeMillis();
        }
        
        void update(Player player) {
            this.isOnline = player.isOnline();
            if (this.isOnline) {
                this.lastSeen = System.currentTimeMillis();
            }
            this.playTime = player.getStatistic(Statistic.PLAY_ONE_MINUTE) / 20;
            this.isBanned = player.isBanned();
        }
    }
}
