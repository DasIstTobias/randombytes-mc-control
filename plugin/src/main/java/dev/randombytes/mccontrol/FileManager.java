package dev.randombytes.mccontrol;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.bukkit.Bukkit;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.logging.Level;

/**
 * Manages file operations for the Minecraft server with security validation
 */
public class FileManager {
    private final MCControlPlugin plugin;
    private final Path serverRoot;
    private static final long MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    private static final int CHUNK_SIZE = 8192;
    
    // File extensions for text editing
    private static final Set<String> EDITABLE_EXTENSIONS = Set.of(
        ".txt", ".yml", ".yaml", ".json", ".properties", ".log", ".conf", ".cfg", ".toml"
    );
    
    public FileManager(MCControlPlugin plugin) {
        this.plugin = plugin;
        // The server root is the directory containing the server JAR (where PaperMC/Spigot is)
        this.serverRoot = Bukkit.getWorldContainer().toPath().getParent().toAbsolutePath().normalize();
        plugin.getLogger().info("File Manager initialized with root: " + serverRoot.toString());
    }
    
    /**
     * Validates and normalises a path to ensure it stays within the server directory
     * @param requestedPath The requested path (can be relative or absolute)
     * @return Normalised absolute path
     * @throws SecurityException if path attempts to escape server directory
     */
    private Path validatePath(String requestedPath) throws SecurityException {
        try {
            // Handle empty or null paths - return root
            if (requestedPath == null || requestedPath.trim().isEmpty() || requestedPath.equals("/")) {
                return serverRoot;
            }
            
            // Remove leading slash if present (treat as relative to server root)
            if (requestedPath.startsWith("/")) {
                requestedPath = requestedPath.substring(1);
            }
            
            // Resolve the path relative to server root
            Path resolvedPath = serverRoot.resolve(requestedPath).toAbsolutePath().normalize();
            
            // Check if the resolved path is within server root
            if (!resolvedPath.startsWith(serverRoot)) {
                throw new SecurityException("Path traversal attempt detected: " + requestedPath);
            }
            
            return resolvedPath;
        } catch (InvalidPathException e) {
            throw new SecurityException("Invalid path: " + requestedPath);
        }
    }
    
    /**
     * Lists files and directories at the given path
     * @param requestedPath The path to list (relative to server root)
     * @return JsonObject containing files and directories
     */
    public JsonObject listFiles(String requestedPath) {
        JsonObject response = new JsonObject();
        
        try {
            Path targetPath = validatePath(requestedPath);
            
            if (!Files.exists(targetPath)) {
                response.addProperty("error", "Path does not exist");
                return response;
            }
            
            if (!Files.isDirectory(targetPath)) {
                response.addProperty("error", "Path is not a directory");
                return response;
            }
            
            // Build the response
            JsonArray items = new JsonArray();
            
            try (DirectoryStream<Path> stream = Files.newDirectoryStream(targetPath)) {
                for (Path entry : stream) {
                    JsonObject item = new JsonObject();
                    
                    String name = entry.getFileName().toString();
                    boolean isDirectory = Files.isDirectory(entry);
                    
                    item.addProperty("name", name);
                    item.addProperty("isDirectory", isDirectory);
                    item.addProperty("path", serverRoot.relativize(entry).toString().replace("\\", "/"));
                    
                    if (!isDirectory) {
                        try {
                            BasicFileAttributes attrs = Files.readAttributes(entry, BasicFileAttributes.class);
                            item.addProperty("size", attrs.size());
                            item.addProperty("modified", attrs.lastModifiedTime().toMillis());
                            
                            // Determine file type based on extension
                            String extension = getFileExtension(name);
                            item.addProperty("type", getFileType(extension));
                            item.addProperty("editable", EDITABLE_EXTENSIONS.contains(extension));
                        } catch (IOException e) {
                            // If we can't read attributes, still include the file
                            item.addProperty("size", 0);
                            item.addProperty("modified", 0);
                        }
                    } else {
                        item.addProperty("size", 0);
                        item.addProperty("modified", 0);
                        item.addProperty("type", "folder");
                        item.addProperty("editable", false);
                    }
                    
                    items.add(item);
                }
            }
            
            response.add("items", items);
            response.addProperty("currentPath", serverRoot.relativize(targetPath).toString().replace("\\", "/"));
            response.addProperty("success", true);
            
        } catch (SecurityException e) {
            plugin.getLogger().warning("Security violation in listFiles: " + e.getMessage());
            response.addProperty("error", "Access denied: " + e.getMessage());
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to list files", e);
            response.addProperty("error", "Failed to list files: " + e.getMessage());
        }
        
        return response;
    }
    
    /**
     * Reads the content of a file
     * @param requestedPath The path to the file (relative to server root)
     * @return JsonObject containing file content and metadata
     */
    public JsonObject readFile(String requestedPath) {
        JsonObject response = new JsonObject();
        
        try {
            Path targetPath = validatePath(requestedPath);
            
            if (!Files.exists(targetPath)) {
                response.addProperty("error", "File does not exist");
                return response;
            }
            
            if (Files.isDirectory(targetPath)) {
                response.addProperty("error", "Path is a directory, not a file");
                return response;
            }
            
            long fileSize = Files.size(targetPath);
            if (fileSize > MAX_FILE_SIZE) {
                response.addProperty("error", "File too large (max 100MB)");
                return response;
            }
            
            // Read file content
            byte[] bytes = Files.readAllBytes(targetPath);
            
            // Try to detect if file is text or binary
            boolean isText = isLikelyTextFile(bytes);
            
            if (isText) {
                String content = new String(bytes, StandardCharsets.UTF_8);
                response.addProperty("content", content);
                response.addProperty("encoding", "utf-8");
            } else {
                // For binary files, encode as base64
                response.addProperty("content", Base64.getEncoder().encodeToString(bytes));
                response.addProperty("encoding", "base64");
            }
            
            BasicFileAttributes attrs = Files.readAttributes(targetPath, BasicFileAttributes.class);
            response.addProperty("size", fileSize);
            response.addProperty("modified", attrs.lastModifiedTime().toMillis());
            response.addProperty("isText", isText);
            response.addProperty("success", true);
            
        } catch (SecurityException e) {
            plugin.getLogger().warning("Security violation in readFile: " + e.getMessage());
            response.addProperty("error", "Access denied: " + e.getMessage());
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to read file", e);
            response.addProperty("error", "Failed to read file: " + e.getMessage());
        }
        
        return response;
    }
    
    /**
     * Writes content to a file (creates or overwrites)
     * @param requestedPath The path to the file (relative to server root)
     * @param content The content to write
     * @param isBase64 Whether the content is base64 encoded
     * @return JsonObject indicating success or failure
     */
    public JsonObject writeFile(String requestedPath, String content, boolean isBase64) {
        JsonObject response = new JsonObject();
        
        try {
            Path targetPath = validatePath(requestedPath);
            
            // Create parent directories if they don't exist
            Path parent = targetPath.getParent();
            if (parent != null && !Files.exists(parent)) {
                Files.createDirectories(parent);
            }
            
            // Create backup if file exists
            if (Files.exists(targetPath) && !Files.isDirectory(targetPath)) {
                createBackup(targetPath);
            }
            
            // Write content
            byte[] bytes;
            if (isBase64) {
                bytes = Base64.getDecoder().decode(content);
            } else {
                bytes = content.getBytes(StandardCharsets.UTF_8);
            }
            
            if (bytes.length > MAX_FILE_SIZE) {
                response.addProperty("error", "Content too large (max 100MB)");
                return response;
            }
            
            Files.write(targetPath, bytes);
            
            response.addProperty("success", true);
            response.addProperty("message", "File written successfully");
            
        } catch (SecurityException e) {
            plugin.getLogger().warning("Security violation in writeFile: " + e.getMessage());
            response.addProperty("error", "Access denied: " + e.getMessage());
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to write file", e);
            response.addProperty("error", "Failed to write file: " + e.getMessage());
        }
        
        return response;
    }
    
    /**
     * Deletes a file or directory
     * @param requestedPath The path to delete (relative to server root)
     * @return JsonObject indicating success or failure
     */
    public JsonObject deleteFile(String requestedPath) {
        JsonObject response = new JsonObject();
        
        try {
            Path targetPath = validatePath(requestedPath);
            
            if (!Files.exists(targetPath)) {
                response.addProperty("error", "Path does not exist");
                return response;
            }
            
            // Don't allow deleting the server root
            if (targetPath.equals(serverRoot)) {
                response.addProperty("error", "Cannot delete server root directory");
                return response;
            }
            
            // Delete file or directory
            if (Files.isDirectory(targetPath)) {
                // Delete directory recursively
                deleteDirectoryRecursively(targetPath);
            } else {
                Files.delete(targetPath);
            }
            
            response.addProperty("success", true);
            response.addProperty("message", "Deleted successfully");
            
        } catch (SecurityException e) {
            plugin.getLogger().warning("Security violation in deleteFile: " + e.getMessage());
            response.addProperty("error", "Access denied: " + e.getMessage());
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to delete file", e);
            response.addProperty("error", "Failed to delete: " + e.getMessage());
        }
        
        return response;
    }
    
    /**
     * Renames a file or directory
     * @param requestedPath The current path (relative to server root)
     * @param newName The new name (just the name, not full path)
     * @return JsonObject indicating success or failure
     */
    public JsonObject renameFile(String requestedPath, String newName) {
        JsonObject response = new JsonObject();
        
        try {
            Path targetPath = validatePath(requestedPath);
            
            if (!Files.exists(targetPath)) {
                response.addProperty("error", "Path does not exist");
                return response;
            }
            
            // Validate new name (no path separators)
            if (newName.contains("/") || newName.contains("\\") || newName.contains("..")) {
                response.addProperty("error", "Invalid file name");
                return response;
            }
            
            Path parent = targetPath.getParent();
            if (parent == null) {
                response.addProperty("error", "Cannot rename root directory");
                return response;
            }
            
            Path newPath = parent.resolve(newName);
            
            // Validate the new path is still within server root
            validatePath(serverRoot.relativize(newPath).toString());
            
            if (Files.exists(newPath)) {
                response.addProperty("error", "A file with that name already exists");
                return response;
            }
            
            Files.move(targetPath, newPath);
            
            response.addProperty("success", true);
            response.addProperty("message", "Renamed successfully");
            response.addProperty("newPath", serverRoot.relativize(newPath).toString().replace("\\", "/"));
            
        } catch (SecurityException e) {
            plugin.getLogger().warning("Security violation in renameFile: " + e.getMessage());
            response.addProperty("error", "Access denied: " + e.getMessage());
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to rename file", e);
            response.addProperty("error", "Failed to rename: " + e.getMessage());
        }
        
        return response;
    }
    
    /**
     * Creates a new directory
     * @param requestedPath The path where to create the directory (relative to server root)
     * @return JsonObject indicating success or failure
     */
    public JsonObject createDirectory(String requestedPath) {
        JsonObject response = new JsonObject();
        
        try {
            Path targetPath = validatePath(requestedPath);
            
            if (Files.exists(targetPath)) {
                response.addProperty("error", "Path already exists");
                return response;
            }
            
            Files.createDirectories(targetPath);
            
            response.addProperty("success", true);
            response.addProperty("message", "Directory created successfully");
            
        } catch (SecurityException e) {
            plugin.getLogger().warning("Security violation in createDirectory: " + e.getMessage());
            response.addProperty("error", "Access denied: " + e.getMessage());
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to create directory", e);
            response.addProperty("error", "Failed to create directory: " + e.getMessage());
        }
        
        return response;
    }
    
    // Helper methods
    
    private void createBackup(Path file) {
        try {
            String timestamp = new SimpleDateFormat("yyyyMMdd-HHmmss").format(new Date());
            Path backupPath = file.resolveSibling(file.getFileName() + ".backup-" + timestamp);
            Files.copy(file, backupPath);
        } catch (IOException e) {
            plugin.getLogger().warning("Failed to create backup: " + e.getMessage());
        }
    }
    
    private void deleteDirectoryRecursively(Path directory) throws IOException {
        Files.walkFileTree(directory, new SimpleFileVisitor<Path>() {
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                Files.delete(file);
                return FileVisitResult.CONTINUE;
            }
            
            @Override
            public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                Files.delete(dir);
                return FileVisitResult.CONTINUE;
            }
        });
    }
    
    private String getFileExtension(String filename) {
        int lastDot = filename.lastIndexOf('.');
        if (lastDot > 0 && lastDot < filename.length() - 1) {
            return filename.substring(lastDot).toLowerCase();
        }
        return "";
    }
    
    private String getFileType(String extension) {
        return switch (extension) {
            case ".jar" -> "jar";
            case ".yml", ".yaml" -> "yaml";
            case ".json" -> "json";
            case ".properties" -> "properties";
            case ".txt" -> "text";
            case ".log" -> "log";
            case ".conf", ".cfg", ".toml" -> "config";
            default -> "file";
        };
    }
    
    /**
     * Checks if a file is likely text based on its content
     */
    private boolean isLikelyTextFile(byte[] bytes) {
        if (bytes.length == 0) return true;
        
        // Sample first 8KB or entire file if smaller
        int sampleSize = Math.min(bytes.length, 8192);
        int nullBytes = 0;
        
        for (int i = 0; i < sampleSize; i++) {
            if (bytes[i] == 0) {
                nullBytes++;
            }
        }
        
        // If more than 1% null bytes, likely binary
        return (nullBytes * 100.0 / sampleSize) < 1.0;
    }
}
