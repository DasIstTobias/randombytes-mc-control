# Round 3 Implementation Status

## Completed Features ✅

### 1. Custom Modal System
**Status**: ✅ Complete (commit f64e062)

**Implementation**:
- Replaced ALL JavaScript `alert()`, `confirm()`, `prompt()` calls
- Custom overlay modal with dark theme
- Three modal types: alert, confirm, prompt
- Keyboard shortcuts (Enter/Escape)
- Promise-based async API

**Files Modified**:
- `backend-frontend/frontend/index.html` - Modal HTML structure
- `backend-frontend/frontend/style.css` - Modal styling
- `backend-frontend/frontend/app.js` - Modal functions and replacements

**Benefits**:
- No browser popup blocking issues
- Consistent UI/UX across all interactions
- Accessible and keyboard-friendly
- Matches dark theme design

---

### 2. Text Input Styling in Settings
**Status**: ✅ Complete (commit f64e062)

**Implementation**:
- Applied dark theme styling to all text input fields
- Consistent with number inputs and toggle switches
- Proper focus states with border highlighting

**CSS Added**:
```css
input[type="text"] {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--primary);
    color: var(--text);
    font-size: 14px;
    font-family: monospace;
}
```

---

### 3. Player Head Backend Proxy
**Status**: ✅ Complete (commit 909c184)

**Implementation**:
- New backend endpoint: `GET /api/player-head/:uuid`
- Proxies Crafatar API server-side
- Returns PNG images with proper headers
- SSL certificate handling included

**Backend**:
```rust
async fn get_player_head(
    axum::extract::Path(uuid): axum::extract::Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let uuid_no_dashes = uuid.replace("-", "");
    let url = format!("https://crafatar.com/avatars/{}?size=24&overlay", uuid_no_dashes);
    // ... fetch and return image
}
```

**Frontend**:
- Changed from `https://crafatar.com/avatars/...` to `/api/player-head/${uuid}`
- Applied to Players, Whitelist, Blacklist, OPs lists

**Benefits**:
- Guaranteed delivery through backend
- No CORS issues
- Centralized image handling
- Easy to add caching later

---

## Pending Features ⏳

### 4. Offline Player Inventory Caching
**Status**: ⏳ Requires Plugin Implementation

**Requirements**:
- Cache inventory every 10 seconds for online players
- Store in Docker volume for persistence
- Always show most recent cached version
- Overwrite old versions automatically

**Implementation Needed**:

**Plugin Side** (Java):
```java
// In MCControlPlugin.java
private ScheduledExecutorService inventoryCache;
private File cacheDirectory;

@Override
public void onEnable() {
    // Create cache directory in Docker volume
    cacheDirectory = new File("/data/inventory-cache");
    cacheDirectory.mkdirs();
    
    // Start inventory caching task
    inventoryCache = Executors.newSingleThreadScheduledExecutor();
    inventoryCache.scheduleAtFixedRate(() -> {
        for (Player player : Bukkit.getOnlinePlayers()) {
            cachePlayerInventory(player);
        }
    }, 10, 10, TimeUnit.SECONDS);
}

private void cachePlayerInventory(Player player) {
    File cacheFile = new File(cacheDirectory, player.getUniqueId() + ".json");
    JsonObject inventory = playerDataManager.getPlayerInventoryData(player);
    // Write to file with timestamp
    try (FileWriter writer = new FileWriter(cacheFile)) {
        gson.toJson(inventory, writer);
    } catch (IOException e) {
        getLogger().warning("Failed to cache inventory for " + player.getName());
    }
}
```

**API Changes**:
- Modify `GET /api/player/:uuid` to return cached inventory if player offline
- Add `cached: true` flag to response

**Docker Configuration**:
```yaml
# In docker-compose.yml
volumes:
  - ./data:/data
```

---

### 5. Enhanced Graph - CPU Usage & Player Count
**Status**: ⏳ Requires Plugin & Frontend Implementation

**Requirements**:
- Add orange CPU usage line to graph
- Add blue player count line
- Dual Y-axis: left (0-100%), right (0-max players)
- Max players from server settings

**Implementation Needed**:

**Plugin Side** (Java):
```java
// In MetricsCollector.java
public class MetricsData {
    private double tps;
    private double memory;
    private double cpu;          // NEW
    private int playerCount;     // NEW
    private int maxPlayers;      // NEW
    private long timestamp;
}

private double getCPUUsage() {
    OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
    if (osBean instanceof com.sun.management.OperatingSystemMXBean) {
        return ((com.sun.management.OperatingSystemMXBean) osBean).getProcessCpuLoad() * 100.0;
    }
    return 0.0;
}
```

**Frontend Side** (JavaScript):
```javascript
function updateMetricsChart(metrics) {
    // ... existing code ...
    
    // Add CPU line (orange)
    ctx.strokeStyle = '#f90';
    ctx.lineWidth = 2;
    ctx.beginPath();
    metrics.forEach((point, index) => {
        const x = padding + (graphWidth / (metrics.length - 1)) * index;
        const y = padding + graphHeight - (point.cpu / 100) * graphHeight;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Add Player Count line (blue) - use right axis
    const maxPlayers = metrics[0]?.maxPlayers || 100;
    ctx.strokeStyle = '#49a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    metrics.forEach((point, index) => {
        const x = padding + (graphWidth / (metrics.length - 1)) * index;
        const y = padding + graphHeight - (point.playerCount / maxPlayers) * graphHeight;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw right Y-axis labels (player count)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#999';
    for (let i = 0; i <= 5; i++) {
        const y = padding + (graphHeight / 5) * i;
        const players = maxPlayers - Math.floor((i * maxPlayers) / 5);
        ctx.fillText(`${players}`, width - padding + 10, y + 4);
    }
}
```

---

### 6. Server Identity Header on Status Page
**Status**: ⏳ Requires Plugin & Frontend Implementation

**Requirements**:
- Show server-icon.png (if available)
- Server address and port
- MOTD below address
- GeyserMC info if installed
- Position: Below "Server Status", above "Last 10 minutes"

**Implementation Needed**:

**Plugin Side** (Java):
```java
// In APIServer.java - extend /api/server endpoint
private JsonObject getServerIdentity() {
    JsonObject identity = new JsonObject();
    
    // Server icon
    File iconFile = new File("server-icon.png");
    if (iconFile.exists()) {
        try {
            byte[] iconData = Files.readAllBytes(iconFile.toPath());
            String base64Icon = Base64.getEncoder().encodeToString(iconData);
            identity.addProperty("icon", "data:image/png;base64," + base64Icon);
        } catch (IOException e) {
            identity.addProperty("icon", null);
        }
    } else {
        identity.addProperty("icon", null);
    }
    
    // Server details
    identity.addProperty("address", Bukkit.getIp());
    identity.addProperty("port", Bukkit.getPort());
    identity.addProperty("motd", Bukkit.getMotd());
    
    // GeyserMC detection
    Plugin geyserPlugin = Bukkit.getPluginManager().getPlugin("Geyser-Spigot");
    if (geyserPlugin != null) {
        identity.addProperty("hasGeyser", true);
        // Read GeyserMC config for bedrock port
        try {
            File geyserConfig = new File(geyserPlugin.getDataFolder(), "config.yml");
            // Parse YAML to get bedrock port
            identity.addProperty("bedrockPort", parseGeyserPort(geyserConfig));
        } catch (Exception e) {
            identity.addProperty("bedrockPort", 19132); // default
        }
    } else {
        identity.addProperty("hasGeyser", false);
    }
    
    return identity;
}
```

**Frontend Side** (HTML & CSS):
```html
<!-- In status page -->
<div id="server-identity" class="server-identity">
    <img id="server-icon" src="" alt="Server Icon" class="server-icon">
    <div class="server-details">
        <div class="server-address">
            <span id="server-address-text">play.example.com</span>
            <span class="server-port" id="server-port">:25565</span>
        </div>
        <div class="server-motd" id="server-motd">Welcome to our server!</div>
    </div>
    <div id="geyser-info" class="geyser-info" style="display: none;">
        <span class="geyser-label">GeyserMC</span>
        <span class="geyser-port" id="geyser-port">:19132</span>
    </div>
</div>
```

---

### 7. Sidebar Server Info (Compact)
**Status**: ⏳ Requires Frontend Implementation

**Requirements**:
- Show server-icon.png, address, port
- Compact display under "MC Control" title
- No extra text, information-dense

**HTML**:
```html
<nav class="sidebar">
    <h1>MC Control</h1>
    <div class="sidebar-server-info">
        <img id="sidebar-server-icon" src="" alt="" class="sidebar-server-icon">
        <div class="sidebar-server-text">
            <div class="sidebar-server-address" id="sidebar-server-address">-</div>
            <div class="sidebar-server-port" id="sidebar-server-port">-</div>
        </div>
    </div>
    <ul class="nav-menu">
        <!-- ... existing menu ... -->
    </ul>
</nav>
```

**CSS**:
```css
.sidebar-server-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border);
}

.sidebar-server-icon {
    width: 32px;
    height: 32px;
    border-radius: 4px;
}

.sidebar-server-text {
    flex: 1;
    overflow: hidden;
}

.sidebar-server-address {
    font-size: 0.9rem;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sidebar-server-port {
    font-size: 0.8rem;
    color: var(--text-light);
}
```

---

### 8. GeyserMC Configuration Display
**Status**: ⏳ Requires Plugin Implementation

**Requirements**:
- Add info field in Server Info page
- Show key GeyserMC config data
- Only visible if GeyserMC installed

**Plugin Side**:
```java
// Extend /api/server endpoint
if (geyserInstalled) {
    JsonObject geyserConfig = new JsonObject();
    // Read from GeyserMC config.yml
    geyserConfig.addProperty("bedrockAddress", ...);
    geyserConfig.addProperty("bedrockPort", ...);
    geyserConfig.addProperty("authType", ...);
    geyserConfig.addProperty("enabledFeatures", ...);
    serverInfo.add("geyserConfig", geyserConfig);
}
```

**Frontend Side**:
```javascript
// In loadServerInfo()
if (data.geyserConfig) {
    const geyserSection = document.createElement('div');
    geyserSection.className = 'info-section';
    geyserSection.innerHTML = `
        <h3>GeyserMC Configuration</h3>
        <div class="info-grid">
            <div class="info-item">
                <span class="info-label">Bedrock Address:</span>
                <span class="info-value">${data.geyserConfig.bedrockAddress}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Bedrock Port:</span>
                <span class="info-value">${data.geyserConfig.bedrockPort}</span>
            </div>
            <!-- ... more fields ... -->
        </div>
    `;
    document.getElementById('server-info-container').appendChild(geyserSection);
}
```

---

### 9. Graph Time Axis
**Status**: ⏳ Requires Frontend Implementation

**Requirements**:
- Horizontal time labels below graph
- "now" to "-10 min" (or less if server < 10 min uptime)
- Show actual timestamps below relative time

**JavaScript**:
```javascript
function updateMetricsChart(metrics) {
    // ... existing drawing code ...
    
    // Calculate time range
    const now = Date.now();
    const oldestMetric = metrics[metrics.length - 1];
    const timeRange = now - oldestMetric.timestamp;
    const maxTime = Math.min(timeRange, 10 * 60 * 1000); // 10 minutes max
    
    // Draw time axis
    ctx.textAlign = 'center';
    ctx.fillStyle = '#999';
    const numTimeLabels = 6;
    
    for (let i = 0; i < numTimeLabels; i++) {
        const x = padding + (graphWidth / (numTimeLabels - 1)) * i;
        const minutesAgo = Math.round((maxTime / 60000) * (1 - i / (numTimeLabels - 1)));
        const timestamp = new Date(now - (minutesAgo * 60000));
        
        // Relative time
        const relativeLabel = i === 0 ? 'now' : `-${minutesAgo} min`;
        ctx.fillText(relativeLabel, x, height - padding + 20);
        
        // Actual time
        const timeLabel = timestamp.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        ctx.font = '10px monospace';
        ctx.fillStyle = '#666';
        ctx.fillText(timeLabel, x, height - padding + 35);
        ctx.font = '12px monospace';
        ctx.fillStyle = '#999';
    }
}
```

---

## Docker Volume Configuration

For inventory caching and future persistent data:

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  minecraft-server:
    # ... existing config ...
    volumes:
      - ./data:/data
      - ./plugins:/plugins
      
  mc-control-backend:
    # ... existing config ...
    volumes:
      - ./data:/data
    environment:
      - DATA_DIR=/data
```

**Plugin Configuration**:
- Inventory cache: `/data/inventory-cache/`
- Metrics history: `/data/metrics/`
- Logs archive: `/data/logs/`

---

## Testing Checklist

### When Implementing Inventory Caching:
- [ ] Verify cache directory creation in Docker volume
- [ ] Test caching during player gameplay
- [ ] Verify cache persists after server restart
- [ ] Test offline inventory viewing
- [ ] Confirm old cache overwrites
- [ ] Test with multiple players

### When Implementing Enhanced Graph:
- [ ] CPU usage displays correctly
- [ ] Player count line appears
- [ ] Dual Y-axis labels correct
- [ ] Max players value accurate
- [ ] Legend updated with new lines
- [ ] Graph performance acceptable

### When Implementing Server Identity:
- [ ] Server icon loads (when available)
- [ ] Server icon fallback works
- [ ] Address and port display correctly
- [ ] MOTD renders properly
- [ ] GeyserMC detection works
- [ ] Bedrock port shows when GeyserMC present
- [ ] Layout responsive on mobile

### When Implementing Time Axis:
- [ ] Time labels accurate
- [ ] Relative time correct
- [ ] Actual timestamps match
- [ ] Handles < 10 minute uptime
- [ ] Labels don't overlap
- [ ] Readable at all zoom levels

---

## Priority Recommendations

1. **High Priority**:
   - Server Identity Header (improves UX significantly)
   - Sidebar Server Info (quick server identification)
   - Graph Time Axis (essential for understanding metrics)

2. **Medium Priority**:
   - Enhanced Graph (CPU & Player Count) (nice-to-have metrics)
   - GeyserMC Integration (only relevant if GeyserMC used)

3. **Lower Priority**:
   - Inventory Caching (requires significant infrastructure)
   - Complex feature with Docker volume management

---

## Estimated Implementation Time

- Server Identity Header: 2-3 hours
- Sidebar Server Info: 1 hour
- Graph Time Axis: 2 hours
- Enhanced Graph (CPU/Players): 3-4 hours
- GeyserMC Integration: 2-3 hours
- Inventory Caching: 4-6 hours (complex)

**Total**: 14-19 hours of development time

---

## Notes

- All features maintain the existing dark theme
- Backwards compatibility preserved
- Error handling for missing/unavailable data
- Graceful degradation (features hide if not applicable)
- Mobile-responsive where applicable
