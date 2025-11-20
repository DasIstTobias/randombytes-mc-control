package dev.mccontrol.manager;

import dev.mccontrol.Main;
import org.bukkit.plugin.Plugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Properties;
import java.util.UUID;
import java.util.logging.Level;

public class ConfigManager {

    private int pluginPort;
    private final Plugin plugin;
    File pluginConfig;

    public ConfigManager(Plugin plugin) {
        this.plugin = plugin;
        pluginConfig = new File(plugin.getDataFolder(), "plugin.config");

    }

    public void loadConfig(){
        if(!pluginConfig.exists()){
            Properties props = new Properties();
            props.setProperty("port", "25575");

            try (FileOutputStream out = new FileOutputStream(pluginConfig)){
                props.store(out,"MC Control Plugin Configuration");
                plugin.getLogger().info("Created default configuration file");
            } catch (IOException e) {
                plugin.getLogger().log(Level.SEVERE, "Failed to create configuration file", e);
            }

            pluginPort = 25575;
        }else {

            Properties props = new Properties();
            try (FileInputStream in = new FileInputStream(pluginConfig)){
                props.load(in);
                pluginPort = Integer.parseInt(props.getProperty("port", "25575"));
            } catch (Exception e) {
                plugin.getLogger().log(Level.SEVERE, "Failed to load configuration file", e);
                pluginPort = 25575;
            }
        }
    }


    public void loadOrGenerateApiKey(){
        File apiKeyFile = new File(plugin.getDataFolder(), "API-KEY.txt");
        if (!apiKeyFile.exists()) {
            Main.getInstance().getApiServer().setApiKey( UUID.randomUUID().toString() + "-" + UUID.randomUUID().toString());

            try {
                Files.writeString(apiKeyFile.toPath(), Main.getInstance().getApiServer().getApiKey());
                // Set file permissions to be readable only by owner
                apiKeyFile.setReadable(false, false);
                apiKeyFile.setReadable(true, true);
                apiKeyFile.setWritable(false, false);
                apiKeyFile.setWritable(true, true);

                plugin.getLogger().warning("===========================================");
                plugin.getLogger().warning("NEW API KEY GENERATED!");
                plugin.getLogger().warning("API Key: " + Main.getInstance().getApiServer().getApiKey());
                plugin.getLogger().warning("Save this key securely for backend configuration!");
                plugin.getLogger().warning("===========================================");
            } catch (IOException e) {
                plugin.getLogger().log(Level.SEVERE, "Failed to save API key", e);
            }
        } else {
            // Load existing API key
            try {
                Main.getInstance().getApiServer().setApiKey(Files.readString(apiKeyFile.toPath()).trim());
                plugin.getLogger().info("Loaded existing API key");
            } catch (IOException e) {
                plugin.getLogger().log(Level.SEVERE, "Failed to load API key", e);
            }
        }
    }

    public void generateKeyPair() {
        try {
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
            keyGen.initialize(2048);
            Main.getInstance().getApiServer().setServerKeyPair(keyGen.generateKeyPair());

            // Save public key for backend
            String publicKeyStr = Base64.getEncoder().encodeToString(Main.getInstance().getApiServer().getServerKeyPair().getPublic().getEncoded());
            File publicKeyFile = new File(plugin.getDataFolder(), "public-key.txt");
            Files.writeString(publicKeyFile.toPath(), publicKeyStr);

            plugin.getLogger().info("Generated RSA key pair for secure communication");
        } catch (NoSuchAlgorithmException | IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to generate key pair", e);
        }
    }



    public int getPluginPort() {
        return pluginPort;
    }


}
