package dev.randombytes.mccontrol;

import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

public class PlayerTrackingListener implements Listener {
    private final PlayerDataManager manager;
    
    public PlayerTrackingListener(PlayerDataManager manager) {
        this.manager = manager;
    }
    
    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        manager.updatePlayerData(event.getPlayer());
        manager.addConsoleLog("[JOIN] " + event.getPlayer().getName() + " joined the game");
        manager.addChatLog("[+] " + event.getPlayer().getName() + " joined the server");
    }
    
    @EventHandler
    public void onPlayerQuit(PlayerQuitEvent event) {
        manager.updatePlayerData(event.getPlayer());
        manager.addConsoleLog("[QUIT] " + event.getPlayer().getName() + " left the game");
        manager.addChatLog("[-] " + event.getPlayer().getName() + " left the server");
    }
    
    @EventHandler
    public void onPlayerChat(AsyncPlayerChatEvent event) {
        manager.addChatLog("<" + event.getPlayer().getName() + "> " + event.getMessage());
    }
}
