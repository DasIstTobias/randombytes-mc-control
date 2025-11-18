package dev.randombytes;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.event.player.PlayerGameModeChangeEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.ShapedRecipe;
import org.bukkit.inventory.ShapelessRecipe;
import org.bukkit.plugin.Plugin;

import java.io.*;
import java.util.*;
import java.util.logging.Level;

public class CustomRecipeManager {
    private final MainR main;
    private final Plugin plugin;
    private final File recipesFile;
    private final Map<String, JsonObject> recipes;
    private final Map<String, NamespacedKey> recipeKeys;
    
    public CustomRecipeManager(Plugin plugin, MainR main) {
        this.plugin = plugin;
        this.recipesFile = new File(plugin.getDataFolder(), "custom-recipes.json");
        this.main = main;
        this.recipes = new HashMap<>();
        this.recipeKeys = new HashMap<>();
        
        loadRecipes();
    }
    
    private void loadRecipes() {
        if (!recipesFile.exists()) {
            saveRecipes();
            return;
        }
        
        try (FileReader reader = new FileReader(recipesFile)) {
            JsonObject root = main.getGson().fromJson(reader, JsonObject.class);
            if (root != null && root.has("recipes")) {
                JsonArray recipesArray = root.getAsJsonArray("recipes");
                for (JsonElement element : recipesArray) {
                    JsonObject recipe = element.getAsJsonObject();
                    String id = recipe.get("id").getAsString();
                    recipes.put(id, recipe);
                    registerRecipe(id, recipe);
                }
            }
            plugin.getLogger().info("Loaded " + recipes.size() + " custom recipes");
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to load custom recipes", e);
        }
    }
    
    private void saveRecipes() {
        try {
            JsonObject root = new JsonObject();
            JsonArray recipesArray = new JsonArray();
            for (JsonObject recipe : recipes.values()) {
                recipesArray.add(recipe);
            }
            root.add("recipes", recipesArray);
            
            try (FileWriter writer = new FileWriter(recipesFile)) {
                main.getGson().toJson(root, writer);
            }
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to save custom recipes", e);
        }
    }
    
    public JsonObject getAllRecipes() {
        JsonObject result = new JsonObject();
        JsonArray recipesArray = new JsonArray();
        
        for (Map.Entry<String, JsonObject> entry : recipes.entrySet()) {
            JsonObject recipe = new JsonObject();
            recipe.addProperty("id", entry.getKey());
            recipe.addProperty("shaped", entry.getValue().get("shaped").getAsBoolean());
            
            // Add simplified result info
            JsonObject resultObj = entry.getValue().getAsJsonObject("result");
            recipe.add("result", resultObj);
            
            recipesArray.add(recipe);
        }
        
        result.add("recipes", recipesArray);
        return result;
    }
    
    public JsonObject getRecipe(String id) {
        JsonObject recipe = recipes.get(id);
        if (recipe == null) {
            JsonObject error = new JsonObject();
            error.addProperty("error", "Recipe not found");
            return error;
        }
        
        JsonObject result = new JsonObject();
        result.add("recipe", recipe);
        return result;
    }
    
    public JsonObject createRecipe(JsonObject recipeData) {
        // Generate unique ID
        String id = "custom_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        
        // Add ID to recipe data
        recipeData.addProperty("id", id);
        
        // Validate recipe data
        if (!validateRecipeData(recipeData)) {
            JsonObject error = new JsonObject();
            error.addProperty("error", "Invalid recipe data");
            return error;
        }
        
        // Store recipe
        recipes.put(id, recipeData);
        saveRecipes();
        
        // Register with server
        registerRecipe(id, recipeData);
        
        JsonObject result = new JsonObject();
        result.addProperty("success", true);
        result.addProperty("id", id);
        return result;
    }
    
    public JsonObject updateRecipe(String id, JsonObject recipeData) {
        if (!recipes.containsKey(id)) {
            JsonObject error = new JsonObject();
            error.addProperty("error", "Recipe not found");
            return error;
        }
        
        // Validate recipe data
        if (!validateRecipeData(recipeData)) {
            JsonObject error = new JsonObject();
            error.addProperty("error", "Invalid recipe data");
            return error;
        }
        
        // Unregister old recipe
        unregisterRecipe(id);
        
        // Keep the same ID
        recipeData.addProperty("id", id);
        
        // Update recipe
        recipes.put(id, recipeData);
        saveRecipes();
        
        // Register updated recipe
        registerRecipe(id, recipeData);
        
        JsonObject result = new JsonObject();
        result.addProperty("success", true);
        return result;
    }
    
    public JsonObject deleteRecipe(String id) {
        if (!recipes.containsKey(id)) {
            JsonObject error = new JsonObject();
            error.addProperty("error", "Recipe not found");
            return error;
        }
        
        // Unregister recipe
        unregisterRecipe(id);
        
        // Remove from storage
        recipes.remove(id);
        saveRecipes();
        
        JsonObject result = new JsonObject();
        result.addProperty("success", true);
        return result;
    }
    
    private boolean validateRecipeData(JsonObject recipeData) {
        try {
            // Check required fields
            if (!recipeData.has("shaped") || !recipeData.has("ingredients") || !recipeData.has("result")) {
                return false;
            }
            
            // Validate result
            JsonObject result = recipeData.getAsJsonObject("result");
            if (!result.has("item") || !result.has("count")) {
                return false;
            }
            
            String resultItem = result.get("item").getAsString();
            if (!isValidMaterial(resultItem)) {
                return false;
            }
            
            int count = result.get("count").getAsInt();
            if (count < 1 || count > 64) {
                return false;
            }
            
            // Validate ingredients
            JsonArray ingredients = recipeData.getAsJsonArray("ingredients");
            if (ingredients.size() != 9) {
                return false;
            }
            
            boolean hasIngredient = false;
            for (JsonElement element : ingredients) {
                if (!element.isJsonNull()) {
                    String item = element.getAsString();
                    if (item != null && !item.isEmpty()) {
                        if (!isValidMaterial(item)) {
                            return false;
                        }
                        hasIngredient = true;
                    }
                }
            }
            
            return hasIngredient;
        } catch (Exception e) {
            plugin.getLogger().log(Level.WARNING, "Recipe validation error", e);
            return false;
        }
    }
    
    private boolean isValidMaterial(String materialName) {
        try {
            // Handle namespaced keys
            String matName = materialName.toUpperCase();
            if (materialName.contains(":")) {
                matName = materialName.substring(materialName.indexOf(":") + 1).toUpperCase();
            }
            Material material = Material.matchMaterial(matName);
            return material != null;
        } catch (Exception e) {
            return false;
        }
    }
    
    private Material getMaterial(String materialName) {
        String matName = materialName.toUpperCase();
        if (materialName.contains(":")) {
            matName = materialName.substring(materialName.indexOf(":") + 1).toUpperCase();
        }
        return Material.matchMaterial(matName);
    }
    
    private void registerRecipe(String id, JsonObject recipeData) {
        try {
            boolean shaped = recipeData.get("shaped").getAsBoolean();
            JsonArray ingredients = recipeData.getAsJsonArray("ingredients");
            JsonObject result = recipeData.getAsJsonObject("result");
            
            String resultItem = result.get("item").getAsString();
            int resultCount = result.get("count").getAsInt();
            
            Material resultMaterial = getMaterial(resultItem);
            if (resultMaterial == null) {
                plugin.getLogger().warning("Invalid result material: " + resultItem);
                return;
            }
            
            ItemStack resultStack = new ItemStack(resultMaterial, resultCount);
            NamespacedKey key = new NamespacedKey(plugin, id);
            recipeKeys.put(id, key);
            
            if (shaped) {
                ShapedRecipe recipe = new ShapedRecipe(key, resultStack);
                recipe.shape("ABC", "DEF", "GHI");
                
                char[] chars = {'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'};
                for (int i = 0; i < 9; i++) {
                    JsonElement element = ingredients.get(i);
                    if (!element.isJsonNull()) {
                        String item = element.getAsString();
                        if (item != null && !item.isEmpty()) {
                            Material mat = getMaterial(item);
                            if (mat != null) {
                                recipe.setIngredient(chars[i], mat);
                            }
                        }
                    }
                }
                
                Bukkit.addRecipe(recipe);
            } else {
                ShapelessRecipe recipe = new ShapelessRecipe(key, resultStack);
                
                for (JsonElement element : ingredients) {
                    if (!element.isJsonNull()) {
                        String item = element.getAsString();
                        if (item != null && !item.isEmpty()) {
                            Material mat = getMaterial(item);
                            if (mat != null) {
                                recipe.addIngredient(mat);
                            }
                        }
                    }
                }
                
                Bukkit.addRecipe(recipe);
            }
            
            plugin.getLogger().info("Registered custom recipe: " + id);
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to register recipe: " + id, e);
        }
    }
    
    private void unregisterRecipe(String id) {
        try {
            NamespacedKey key = recipeKeys.get(id);
            if (key != null) {
                Bukkit.removeRecipe(key);
                recipeKeys.remove(id);
                plugin.getLogger().info("Unregistered custom recipe: " + id);
            }
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to unregister recipe: " + id, e);
        }
    }
}
