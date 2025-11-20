package dev.randombytes.mccontrol;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.*;
import java.util.Base64;
import java.util.Properties;
import java.util.UUID;
import java.util.logging.Level;

public class MCControlPlugin extends JavaPlugin {
    private static MCControlPlugin instance;
    private Gson gson;
    private APIServer apiServer;
    private MetricsCollector metricsCollector;
    private PlayerDataManager playerDataManager;
    private CustomRecipeManager customRecipeManager;
    private LogManager logManager;
    private FileManager fileManager;
    
    private String apiKey;
    private int port;
    private KeyPair keyPair;
    private long startTime; // Track server start time
    
    @Override
    public void onEnable() {
        instance = this;
        gson = new GsonBuilder().setPrettyPrinting().create();
        startTime = System.currentTimeMillis(); // Record start time
        
        // Create plugin directory if it doesn't exist
        if (!getDataFolder().exists()) {
            getDataFolder().mkdirs();
        }
        
        // Load or generate configuration
        loadConfig();
        
        // Load or generate API key
        loadOrGenerateApiKey();
        
        // Generate RSA key pair for secure communication
        generateKeyPair();
        
        // Initialize managers
        metricsCollector = new MetricsCollector(this);
        playerDataManager = new PlayerDataManager(this);
        customRecipeManager = new CustomRecipeManager(this);
        logManager = new LogManager(this);
        fileManager = new FileManager(this);
        
        // Attach console log handler to capture server logs
        attachConsoleLogHandler();
        
        // Start API server
        apiServer = new APIServer(this, port, apiKey, keyPair);
        apiServer.start();
        
        getLogger().info("RandomBytes MC Control Plugin has been enabled!");
        getLogger().info("API Server running on port: " + port);
        getLogger().info("Public key available for backend connection");
    }
    
    @Override
    public void onDisable() {
        if (apiServer != null) {
            apiServer.stop();
        }
        
        if (metricsCollector != null) {
            metricsCollector.stop();
        }
        
        getLogger().info("RandomBytes MC Control Plugin has been disabled!");
    }
    
    private void loadConfig() {
        File configFile = new File(getDataFolder(), "plugin.config");
        
        if (!configFile.exists()) {
            // Create default configuration
            Properties props = new Properties();
            props.setProperty("port", "25575");
            
            try (FileOutputStream out = new FileOutputStream(configFile)) {
                props.store(out, "RandomBytes MC Control Plugin Configuration");
                getLogger().info("Created default configuration file");
            } catch (IOException e) {
                getLogger().log(Level.SEVERE, "Failed to create configuration file", e);
            }
            
            port = 25575;
        } else {
            // Load existing configuration
            Properties props = new Properties();
            try (FileInputStream in = new FileInputStream(configFile)) {
                props.load(in);
                port = Integer.parseInt(props.getProperty("port", "25575"));
            } catch (IOException | NumberFormatException e) {
                getLogger().log(Level.SEVERE, "Failed to load configuration file", e);
                port = 25575;
            }
        }
    }
    
    private void loadOrGenerateApiKey() {
        File apiKeyFile = new File(getDataFolder(), "API-KEY.txt");
        
        if (!apiKeyFile.exists()) {
            // Generate new API key
            apiKey = UUID.randomUUID().toString() + "-" + UUID.randomUUID().toString();
            
            try {
                Files.writeString(apiKeyFile.toPath(), apiKey);
                // Set file permissions to be readable only by owner
                apiKeyFile.setReadable(false, false);
                apiKeyFile.setReadable(true, true);
                apiKeyFile.setWritable(false, false);
                apiKeyFile.setWritable(true, true);
                
                getLogger().warning("===========================================");
                getLogger().warning("NEW API KEY GENERATED!");
                getLogger().warning("API Key: " + apiKey);
                getLogger().warning("Save this key securely for backend configuration!");
                getLogger().warning("===========================================");
            } catch (IOException e) {
                getLogger().log(Level.SEVERE, "Failed to save API key", e);
            }
        } else {
            // Load existing API key
            try {
                apiKey = Files.readString(apiKeyFile.toPath()).trim();
                getLogger().info("Loaded existing API key");
            } catch (IOException e) {
                getLogger().log(Level.SEVERE, "Failed to load API key", e);
            }
        }
    }
    
    private void generateKeyPair() {
        try {
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
            keyGen.initialize(2048);
            keyPair = keyGen.generateKeyPair();
            
            // Save public key for backend
            String publicKeyStr = Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
            File publicKeyFile = new File(getDataFolder(), "public-key.txt");
            Files.writeString(publicKeyFile.toPath(), publicKeyStr);
            
            getLogger().info("Generated RSA key pair for secure communication");
        } catch (NoSuchAlgorithmException | IOException e) {
            getLogger().log(Level.SEVERE, "Failed to generate key pair", e);
        }
    }
    
    public static MCControlPlugin getInstance() {
        return instance;
    }
    
    public Gson getGson() {
        return gson;
    }
    
    public MetricsCollector getMetricsCollector() {
        return metricsCollector;
    }
    
    public PlayerDataManager getPlayerDataManager() {
        return playerDataManager;
    }
    
    public CustomRecipeManager getCustomRecipeManager() {
        return customRecipeManager;
    }
    
    public LogManager getLogManager() {
        return logManager;
    }
    
    public FileManager getFileManager() {
        return fileManager;
    }
    
    public long getUptime() {
        return System.currentTimeMillis() - startTime;
    }
    
    private void attachConsoleLogHandler() {
        // Attach a custom handler to the root logger to capture all console output
        java.util.logging.Logger rootLogger = java.util.logging.Logger.getLogger("");
        rootLogger.addHandler(new java.util.logging.Handler() {
            @Override
            public void publish(java.util.logging.LogRecord record) {
                if (playerDataManager != null) {
                    // Format log message similar to server console output
                    String timestamp = new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date(record.getMillis()));
                    String threadName = record.getLoggerName().contains("Server") ? "Server thread" : Thread.currentThread().getName();
                    String level = record.getLevel().getName();
                    String message = record.getMessage();
                    
                    // Format as: [timestamp] [thread/level]: message
                    String formattedLog = String.format("[%s] [%s/%s]: %s", 
                        timestamp, threadName, level, message);
                    
                    playerDataManager.addConsoleLog(formattedLog);
                    
                    // Also add to combined logs
                    if (logManager != null) {
                        logManager.addLog("CONSOLE: " + formattedLog);
                    }
                }
            }
            
            @Override
            public void flush() {
                // Not needed
            }
            
            @Override
            public void close() throws SecurityException {
                // Not needed
            }
        });
    }
}
