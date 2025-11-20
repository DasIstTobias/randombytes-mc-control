package dev.mccontrol;

import dev.randombytes.MainR;
import dev.tbodyowski.MainT;
import org.bukkit.plugin.java.JavaPlugin;

public class Main extends JavaPlugin {
    private MainR mainR;
    private MainT mainT;

    @Override
    public void onEnable() {
        mainR = new MainR(this);
        mainT = new MainT(this);
        mainR.onEnable();
        mainT.onEnable();
    }
    @Override
    public void onDisable() {
        mainR.onDisable();
        mainT.onDisable();
    }
}
