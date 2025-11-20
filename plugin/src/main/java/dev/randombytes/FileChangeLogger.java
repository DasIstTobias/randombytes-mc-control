package dev.randombytes;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import dev.mccontrol.Main;
import dev.randombytes.MainR;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedList;
import java.util.List;
import java.util.logging.Level;

/**
 * Manages file operation logging with persistent storage
 */
public class FileChangeLogger {
    private final Main plugin;
    private final MainR main;
    private final File logFile;
    private final LinkedList<String> logEntries;
    private static final int MAX_ENTRIES = 300;
    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("dd/MM/yyyy HH:mm");
    
    public FileChangeLogger(Main plugin, MainR main) {
        this.plugin = plugin;
        this.main = main;
        this.logFile = new File(plugin.getDataFolder(), "file-changelog.json");
        this.logEntries = new LinkedList<>();
        loadLog();
    }
    
    /**
     * Loads the log from disk
     */
    private void loadLog() {
        if (!logFile.exists()) {
            return;
        }
        
        try (FileReader reader = new FileReader(logFile)) {
            JsonArray array = main.getGson().fromJson(reader, JsonArray.class);
            if (array != null) {
                for (int i = 0; i < array.size() && i < MAX_ENTRIES; i++) {
                    logEntries.add(array.get(i).getAsString());
                }
            }
        } catch (IOException e) {
            plugin.getLogger().log(Level.WARNING, "Failed to load file changelog", e);
        }
    }
    
    /**
     * Saves the log to disk
     */
    private synchronized void saveLog() {
        try {
            // Ensure data folder exists
            if (!plugin.getDataFolder().exists()) {
                plugin.getDataFolder().mkdirs();
            }
            
            JsonArray array = new JsonArray();
            for (String entry : logEntries) {
                array.add(new JsonPrimitive(entry));
            }
            
            try (FileWriter writer = new FileWriter(logFile)) {
                main.getGson().toJson(array, writer);
            }
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to save file changelog", e);
        }
    }
    
    /**
     * Adds a log entry
     * @param action The action description (e.g., "Upload /plugins/test.jar")
     */
    public synchronized void addEntry(String action) {
        String timestamp = DATE_FORMAT.format(new Date());
        String entry = String.format("[%s] %s", timestamp, action);
        
        // Add to beginning of list (newest first)
        logEntries.addFirst(entry);
        
        // Keep only last MAX_ENTRIES entries
        while (logEntries.size() > MAX_ENTRIES) {
            logEntries.removeLast();
        }
        
        // Save to disk
        saveLog();
    }
    
    /**
     * Gets all log entries
     * @return JsonArray of log entries
     */
    public synchronized JsonArray getEntries() {
        JsonArray array = new JsonArray();
        for (String entry : logEntries) {
            array.add(new JsonPrimitive(entry));
        }
        return array;
    }
    
    /**
     * Clears all log entries
     */
    public synchronized void clear() {
        logEntries.clear();
        saveLog();
    }
}
