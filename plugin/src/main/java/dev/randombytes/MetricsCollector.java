package dev.randombytes;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

import java.lang.management.ManagementFactory;
import java.lang.management.OperatingSystemMXBean;
import java.util.LinkedList;
import java.util.Queue;

public class MetricsCollector {
    private final MainR main;
    private final JavaPlugin plugin;
    private final Queue<MetricSnapshot> snapshots;
    private final int maxSnapshots = 600; // 10 minutes at 1 snapshot per second
    private int taskId;
    
    public MetricsCollector(JavaPlugin plugin, MainR main) {
        this.main = main;
        this.plugin = plugin;
        this.snapshots = new LinkedList<>();
        startCollecting();
    }
    
    private void startCollecting() {
        // Collect metrics every second
        taskId = Bukkit.getScheduler().scheduleSyncRepeatingTask(plugin, () -> {
            collectSnapshot();
        }, 0L, 20L); // 20 ticks = 1 second
    }
    
    public void stop() {
        Bukkit.getScheduler().cancelTask(taskId);
    }
    
    private void collectSnapshot() {
        MetricSnapshot snapshot = new MetricSnapshot(
            System.currentTimeMillis(),
            Bukkit.getOnlinePlayers().size(),
            getTPS(),
            getMemoryUsage(),
            getCPUUsage()
        );
        
        snapshots.offer(snapshot);
        
        // Remove old snapshots
        while (snapshots.size() > maxSnapshots) {
            snapshots.poll();
        }
    }
    
    public JsonObject getMetrics() {
        JsonObject result = new JsonObject();
        JsonArray data = new JsonArray();
        
        for (MetricSnapshot snapshot : snapshots) {
            JsonObject point = new JsonObject();
            point.addProperty("timestamp", snapshot.timestamp);
            point.addProperty("players", snapshot.playerCount);
            point.addProperty("tps", snapshot.tps);
            point.addProperty("memory", snapshot.memoryUsage);
            point.addProperty("cpu", snapshot.cpuUsage);
            data.add(point);
        }
        
        result.add("metrics", data);
        result.addProperty("count", snapshots.size());
        
        return result;
    }
    
    private double getTPS() {
        try {
            // Get server TPS using reflection (Spigot/Paper specific)
            Object server = Bukkit.getServer();
            Object minecraftServer = server.getClass().getMethod("getServer").invoke(server);
            double[] recentTps = (double[]) minecraftServer.getClass().getField("recentTps").get(minecraftServer);
            return Math.min(recentTps[0], 20.0);
        } catch (Exception e) {
            // Fallback if reflection fails
            return 20.0;
        }
    }
    
    private double getMemoryUsage() {
        Runtime runtime = Runtime.getRuntime();
        long usedMemory = runtime.totalMemory() - runtime.freeMemory();
        long maxMemory = runtime.maxMemory();
        return (double) usedMemory / maxMemory * 100.0;
    }
    
    private double getCPUUsage() {
        try {
            OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
            if (osBean instanceof com.sun.management.OperatingSystemMXBean) {
                com.sun.management.OperatingSystemMXBean sunOsBean = 
                    (com.sun.management.OperatingSystemMXBean) osBean;
                return sunOsBean.getProcessCpuLoad() * 100.0;
            }
        } catch (Exception e) {
            // Ignore
        }
        return 0.0;
    }
    
    private static class MetricSnapshot {
        final long timestamp;
        final int playerCount;
        final double tps;
        final double memoryUsage;
        final double cpuUsage;
        
        MetricSnapshot(long timestamp, int playerCount, double tps, double memoryUsage, double cpuUsage) {
            this.timestamp = timestamp;
            this.playerCount = playerCount;
            this.tps = tps;
            this.memoryUsage = memoryUsage;
            this.cpuUsage = cpuUsage;
        }
    }
}
