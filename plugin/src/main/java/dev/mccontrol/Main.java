package dev.mccontrol;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import dev.mccontrol.api.APIServer;
import dev.mccontrol.manager.ConfigManager;
import dev.mccontrol.manager.CustomRecipeManager;
import dev.mccontrol.manager.FileManager;
import dev.mccontrol.manager.LogManager;
import dev.randombytes.*;
import dev.tbodyowski.MainT;
import org.bukkit.plugin.java.JavaPlugin;

public class Main extends JavaPlugin {
    private static Main instance;
    private MainR mainR;
    private MainT mainT;
    private ConfigManager configManager;
    private MetricsCollector metricsCollector;
    private PlayerDataManager playerDataManager;
    private CustomRecipeManager customRecipeManager;
    private LogManager logManager;
    private FileManager fileManager;

    private APIServer apiServer;
    private Gson gson;
    private long startTime;



    @Override
    public void onEnable() {
        startTime = System.currentTimeMillis();
        instance = this;
        configManager = new ConfigManager(this);
        mainR = new MainR(this);
        mainT = new MainT(this);
        gson = new GsonBuilder().setPrettyPrinting().create();
        metricsCollector = new MetricsCollector( this);
        playerDataManager = new PlayerDataManager(this);
        customRecipeManager = new CustomRecipeManager(this);
        logManager = new LogManager(this);
        fileManager = new FileManager(this);

        if (getDataFolder().exists()) {
            getDataFolder().mkdirs();
        }



        mainR.onEnable();
        mainT.onEnable();
        configManager.load();
        logManager.attachConsoleLogHandler();

        apiServer = new APIServer(this, configManager.getPluginPort());
        apiServer.start();
    }
    @Override
    public void onDisable() {
        mainR.onDisable();
        mainT.onDisable();

        if (apiServer != null) apiServer.stop();
        if (metricsCollector != null) metricsCollector.stop();

        getLogger().info(" MC Control Plugin has been disabled!");

    }
    public static Main getInstance() {
        return instance;
    }

    public APIServer getApiServer() {
        return apiServer;
    }

    public ConfigManager getConfigManager() {
        return configManager;
    }

    public LogManager getLogManager() {
        return logManager;
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
    public long getUptime() {
        return System.currentTimeMillis() - startTime;
    }

    public CustomRecipeManager getCustomRecipeManager() {
        return customRecipeManager;
    }

    public FileManager getFileManager() {
        return fileManager;
    }
}
