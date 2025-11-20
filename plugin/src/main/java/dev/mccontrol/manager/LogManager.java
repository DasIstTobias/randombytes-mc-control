package dev.mccontrol.manager;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mccontrol.Main;
import org.bukkit.plugin.Plugin;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Date;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.logging.Level;

public class LogManager {
    private final Plugin plugin;
    private final File logsFile;
    private final ConcurrentLinkedDeque<String> logs;
    private static final int MAX_LOGS = 5000;
    
    public LogManager(Plugin plugin) {
        this.plugin = plugin;
        this.logsFile = new File(plugin.getDataFolder(), "combined-logs.txt");
        this.logs = new ConcurrentLinkedDeque<>();
        
        loadLogs();
    }
    
    private void loadLogs() {
        if (!logsFile.exists()) {
            saveLogs();
            return;
        }
        
        try {
            List<String> lines = Files.readAllLines(logsFile.toPath());
            logs.clear();
            // Keep only last 5000 lines
            int start = Math.max(0, lines.size() - MAX_LOGS);
            for (int i = start; i < lines.size(); i++) {
                logs.add(lines.get(i));
            }
            plugin.getLogger().info("Loaded " + logs.size() + " log lines");
        } catch (IOException e) {
            plugin.getLogger().log(Level.WARNING, "Failed to load logs", e);
        }
    }
    
    private void saveLogs() {
        try {
            // Ensure parent directory exists
            logsFile.getParentFile().mkdirs();
            
            try (BufferedWriter writer = new BufferedWriter(new FileWriter(logsFile))) {
                for (String log : logs) {
                    writer.write(log);
                    writer.newLine();
                }
            }
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to save logs", e);
        }
    }
    
    public void addLog(String logLine) {
        // Add timestamp if not already present
        String timestamp = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date());
        String formattedLog = "[" + timestamp + "] " + logLine;
        
        logs.add(formattedLog);
        
        // Remove oldest log if we exceed max
        if (logs.size() > MAX_LOGS) {
            logs.removeFirst();
        }
        
        // Save to file asynchronously
        org.bukkit.Bukkit.getScheduler().runTaskAsynchronously(plugin, this::saveLogs);
    }
    
    public JsonObject getAllLogs() {
        JsonObject result = new JsonObject();
        JsonArray logsArray = new JsonArray();
        
        for (String log : logs) {
            logsArray.add(log);
        }
        
        result.add("logs", logsArray);
        result.addProperty("count", logs.size());
        
        return result;
    }

    public void clear() {
        logs.clear();
        saveLogs();
    }

    public void attachConsoleLogHandler() {
        java.util.logging.Logger rootLogger = java.util.logging.Logger.getLogger("");
        rootLogger.addHandler(new java.util.logging.Handler() {
            @Override
            public void publish(java.util.logging.LogRecord record) {
                if (Main.getInstance().getPlayerDataManager() != null) {
                    String timestamp = new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date(record.getMillis()));
                    String threadName = record.getLoggerName().contains("Server") ? "Server thread" : Thread.currentThread().getName();
                    String level = record.getLevel().getName();
                    String message = record.getMessage();

                    String formattedLog = String.format("[%s] [%s/%s]: %s",
                            timestamp, threadName, level, message);

                    Main.getInstance().getPlayerDataManager().addConsoleLog(formattedLog);
                    addLog("CONSOLE: " + formattedLog);
                }
            }

            @Override
            public void flush() {

            }

            @Override
            public void close() throws SecurityException {

            }
        })
    ;}

}
