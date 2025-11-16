// Offline detection
let isOffline = false;
let offlineCheckInterval = null;

function showOfflineOverlay() {
    if (!isOffline) {
        isOffline = true;
        document.getElementById('offline-overlay').style.display = 'flex';
    }
}

function hideOfflineOverlay() {
    if (isOffline) {
        isOffline = false;
        document.getElementById('offline-overlay').style.display = 'none';
    }
}

function startOfflineCheck() {
    // Check connection every 5 seconds
    offlineCheckInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/server', { method: 'HEAD' });
            if (response.ok) {
                hideOfflineOverlay();
            } else {
                showOfflineOverlay();
            }
        } catch (error) {
            showOfflineOverlay();
        }
    }, 5000);
}

// API Client
const API = {
    async get(endpoint) {
        try {
            const response = await fetch(`/api${endpoint}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            hideOfflineOverlay();
            return response.json();
        } catch (error) {
            showOfflineOverlay();
            throw error;
        }
    },

    async post(endpoint, data) {
        try {
            const response = await fetch(`/api${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            hideOfflineOverlay();
            return response.json();
        } catch (error) {
            showOfflineOverlay();
            throw error;
        }
    },

    async delete(endpoint) {
        try {
            const response = await fetch(`/api${endpoint}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            hideOfflineOverlay();
            return response.json();
        } catch (error) {
            showOfflineOverlay();
            throw error;
        }
    }
};

// UUID lookup via backend (to avoid CORS issues)
async function fetchUUID(username) {
    try {
        const response = await fetch(`/api/uuid-lookup?username=${encodeURIComponent(username)}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.uuid; // Already formatted with dashes
    } catch (error) {
        console.error('Failed to fetch UUID:', error);
        return null;
    }
}

// Format UUID with dashes
function formatUUID(uuid) {
    if (!uuid || uuid.length !== 32) return uuid;
    return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Show corresponding page
        const page = link.dataset.page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`${page}-page`).classList.add('active');
        
        // Load page data
        loadPage(page);
    });
});

// Page loaders
async function loadPage(page) {
    try {
        switch(page) {
            case 'status':
            case 'metrics':
                await loadStatus();
                break;
            case 'players':
                await loadPlayers();
                break;
            case 'whitelist':
                await loadWhitelist();
                break;
            case 'blacklist':
                await loadBlacklist();
                break;
            case 'ops':
                await loadOps();
                break;
            case 'plugins':
                await loadPlugins();
                break;
            case 'server':
                await loadServerInfo();
                break;
            case 'console':
                await loadConsole();
                break;
            case 'chat':
                await loadChat();
                break;
            case 'settings':
                await loadSettings();
                break;
        }
    } catch (error) {
        console.error('Error loading page:', error);
    }
}

// Status (formerly Metrics)
let statusInterval;

async function loadStatus() {
    // Clear existing interval
    if (statusInterval) clearInterval(statusInterval);
    
    // Load initial data
    await updateStatus();
    
    // Update every 2 seconds
    statusInterval = setInterval(updateStatus, 2000);
}

async function updateStatus() {
    try {
        const data = await API.get('/metrics');
        
        if (data.metrics && data.metrics.length > 0) {
            const latest = data.metrics[data.metrics.length - 1];
            
            document.getElementById('current-players').textContent = latest.players || 0;
            document.getElementById('current-tps').textContent = (latest.tps || 0).toFixed(1);
            document.getElementById('current-memory').textContent = (latest.memory || 0).toFixed(1) + '%';
            document.getElementById('current-cpu').textContent = (latest.cpu || 0).toFixed(1) + '%';
            
            // Update chart
            updateMetricsChart(data.metrics);
        }
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

function updateMetricsChart(metrics) {
    const canvas = document.getElementById('metricsChart');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const width = canvas.width;
    const height = canvas.offsetHeight;
    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    
    ctx.clearRect(0, 0, width, height);
    
    if (metrics.length === 0) return;
    
    // Find max values
    const maxTPS = 20;
    const maxMemory = 100;
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = padding + (graphHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }
    
    // Draw TPS line
    ctx.strokeStyle = '#4a9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    metrics.forEach((point, index) => {
        const x = padding + (graphWidth / (metrics.length - 1)) * index;
        const y = padding + graphHeight - (point.tps / maxTPS) * graphHeight;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw Memory line
    ctx.strokeStyle = '#d44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    metrics.forEach((point, index) => {
        const x = padding + (graphWidth / (metrics.length - 1)) * index;
        const y = padding + graphHeight - (point.memory / maxMemory) * graphHeight;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw legend
    ctx.font = '12px monospace';
    ctx.fillStyle = '#4a9';
    ctx.fillText('TPS', padding, 20);
    ctx.fillStyle = '#d44';
    ctx.fillText('Memory %', padding + 60, 20);
}

// Shutdown Server
document.getElementById('shutdown-server-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to shutdown the server? All players will be disconnected and the server will stop.')) {
        return;
    }
    
    try {
        await API.post('/restart', {});
        alert('Server shutdown initiated.');
    } catch (error) {
        console.error('Error shutting down server:', error);
        alert('Failed to shutdown server: ' + error.message);
    }
});

// Players
async function loadPlayers() {
    try {
        const data = await API.get('/players');
        const tbody = document.getElementById('players-list');
        tbody.innerHTML = '';
        
        if (data.players && data.players.length > 0) {
            data.players.forEach(player => {
                const row = document.createElement('tr');
                
                const statusClass = player.online ? 'online' : 'offline';
                const statusText = player.online ? 'Online' : 'Offline';
                const playTime = formatPlayTime(player.playTime);
                
                row.innerHTML = `
                    <td>${escapeHtml(player.name)}</td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                    <td>${playTime}</td>
                    <td>
                        <button onclick="showPlayerInventory('${player.uuid}', '${escapeHtml(player.name)}')">Inventory</button>
                        <button class="danger" onclick="toggleBan('${player.uuid}', ${player.banned})">${player.banned ? 'Unban' : 'Ban'}</button>
                        <button onclick="toggleOp('${player.uuid}', ${player.op || false})">${player.op ? 'DeOP' : 'OP'}</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4">No players found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading players:', error);
    }
}

async function showPlayerInventory(uuid, name) {
    try {
        const data = await API.get(`/player/${uuid}`);
        
        document.getElementById('modal-player-name').textContent = `${name}'s Inventory`;
        
        const inventoryDiv = document.getElementById('player-inventory');
        inventoryDiv.innerHTML = '';
        
        if (data.inventory && data.inventory.length > 0) {
            data.inventory.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'inventory-item';
                itemDiv.innerHTML = `
                    <div class="inventory-item-name">${escapeHtml(item.name)}</div>
                    <div class="inventory-item-id">${escapeHtml(item.id)}</div>
                    <div class="inventory-item-count">×${item.count}</div>
                `;
                inventoryDiv.appendChild(itemDiv);
            });
        } else {
            inventoryDiv.innerHTML = '<p>Inventory is empty or unavailable</p>';
        }
        
        document.getElementById('player-modal').classList.add('active');
    } catch (error) {
        console.error('Error loading player inventory:', error);
        alert('Failed to load player inventory');
    }
}

async function toggleBan(uuid, isBanned) {
    try {
        const action = isBanned ? 'unban' : 'ban';
        await API.post(`/player/${uuid}/action`, { action });
        await loadPlayers();
    } catch (error) {
        console.error('Error toggling ban:', error);
        alert('Failed to ' + (isBanned ? 'unban' : 'ban') + ' player');
    }
}

async function toggleOp(uuid, isOp) {
    try {
        const action = isOp ? 'deop' : 'op';
        await API.post(`/player/${uuid}/action`, { action });
        await loadPlayers();
    } catch (error) {
        console.error('Error toggling OP:', error);
        alert('Failed to ' + (isOp ? 'de-op' : 'op') + ' player');
    }
}

// Whitelist
let whitelistInterval;

async function loadWhitelist() {
    // Clear existing interval
    if (whitelistInterval) clearInterval(whitelistInterval);
    
    await updateWhitelist();
    
    // Auto-refresh every 5 seconds
    whitelistInterval = setInterval(updateWhitelist, 5000);
}

async function updateWhitelist() {
    try {
        const data = await API.get('/whitelist');
        const tbody = document.getElementById('whitelist-list');
        tbody.innerHTML = '';
        
        if (data.whitelist && data.whitelist.length > 0) {
            data.whitelist.forEach(entry => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${escapeHtml(entry.name)}</td>
                    <td><code>${entry.uuid}</code></td>
                    <td><button class="danger" onclick="removeFromWhitelist('${entry.uuid}', '${escapeHtml(entry.name)}')">Remove</button></td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="3">Whitelist is empty</td></tr>';
        }
    } catch (error) {
        console.error('Error loading whitelist:', error);
    }
}

document.getElementById('whitelist-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('whitelist-name').value.trim();
    let uuid = document.getElementById('whitelist-uuid').value.trim();
    
    if (!uuid) {
        // Fetch UUID from backend (already formatted)
        uuid = await fetchUUID(name);
        if (!uuid) {
            alert('Could not find UUID for player: ' + name);
            return;
        }
    }
    
    try {
        await API.post('/whitelist/add', { name, uuid });
        document.getElementById('whitelist-form').reset();
        await updateWhitelist();
    } catch (error) {
        console.error('Error adding to whitelist:', error);
        alert('Failed to add player to whitelist');
    }
});

async function removeFromWhitelist(uuid, name) {
    if (!confirm(`Remove ${name} from whitelist?`)) return;
    
    try {
        await API.delete(`/whitelist/remove?uuid=${uuid}`);
        await updateWhitelist();
    } catch (error) {
        console.error('Error removing from whitelist:', error);
        alert('Failed to remove player from whitelist');
    }
}

// Blacklist
let blacklistInterval;

async function loadBlacklist() {
    // Clear existing interval
    if (blacklistInterval) clearInterval(blacklistInterval);
    
    await updateBlacklist();
    
    // Auto-refresh every 5 seconds
    blacklistInterval = setInterval(updateBlacklist, 5000);
}

async function updateBlacklist() {
    try {
        const data = await API.get('/blacklist');
        const tbody = document.getElementById('blacklist-list');
        tbody.innerHTML = '';
        
        if (data.blacklist && data.blacklist.length > 0) {
            data.blacklist.forEach(entry => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${escapeHtml(entry.name)}</td>
                    <td><code>${entry.uuid}</code></td>
                    <td><button class="danger" onclick="removeFromBlacklist('${entry.uuid}', '${escapeHtml(entry.name)}')">Remove</button></td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="3">Blacklist is empty</td></tr>';
        }
    } catch (error) {
        console.error('Error loading blacklist:', error);
    }
}

document.getElementById('blacklist-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('blacklist-name').value.trim();
    let uuid = document.getElementById('blacklist-uuid').value.trim();
    
    if (!uuid) {
        // Fetch UUID from backend (already formatted)
        uuid = await fetchUUID(name);
        if (!uuid) {
            alert('Could not find UUID for player: ' + name);
            return;
        }
    }
    
    try {
        await API.post('/blacklist/add', { name, uuid });
        document.getElementById('blacklist-form').reset();
        await updateBlacklist();
    } catch (error) {
        console.error('Error adding to blacklist:', error);
        alert('Failed to add player to blacklist');
    }
});

async function removeFromBlacklist(uuid, name) {
    if (!confirm(`Remove ${name} from blacklist?`)) return;
    
    try {
        await API.delete(`/blacklist/remove?uuid=${uuid}`);
        await updateBlacklist();
    } catch (error) {
        console.error('Error removing from blacklist:', error);
        alert('Failed to remove player from blacklist');
    }
}

// OPs
let opsInterval;

async function loadOps() {
    // Clear existing interval
    if (opsInterval) clearInterval(opsInterval);
    
    await updateOps();
    
    // Auto-refresh every 5 seconds
    opsInterval = setInterval(updateOps, 5000);
}

async function updateOps() {
    try {
        const data = await API.get('/ops');
        const tbody = document.getElementById('ops-list');
        tbody.innerHTML = '';
        
        if (data.ops && data.ops.length > 0) {
            data.ops.forEach(entry => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${escapeHtml(entry.name)}</td>
                    <td><code>${entry.uuid}</code></td>
                    <td><button class="danger" onclick="removeFromOps('${entry.uuid}', '${escapeHtml(entry.name)}')">Remove</button></td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="3">No operators</td></tr>';
        }
    } catch (error) {
        console.error('Error loading ops:', error);
    }
}

document.getElementById('ops-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('ops-name').value.trim();
    let uuid = document.getElementById('ops-uuid').value.trim();
    
    if (!uuid) {
        // Fetch UUID from backend (already formatted)
        uuid = await fetchUUID(name);
        if (!uuid) {
            alert('Could not find UUID for player: ' + name);
            return;
        }
    }
    
    try {
        await API.post('/ops/add', { name, uuid });
        document.getElementById('ops-form').reset();
        await updateOps();
    } catch (error) {
        console.error('Error adding operator:', error);
        alert('Failed to add operator');
    }
});

async function removeFromOps(uuid, name) {
    if (!confirm(`Remove ${name} from operators?`)) return;
    
    try {
        await API.delete(`/ops/remove?uuid=${uuid}`);
        await updateOps();
    } catch (error) {
        console.error('Error removing operator:', error);
        alert('Failed to remove operator');
    }
}

// Plugins
async function loadPlugins() {
    try {
        const data = await API.get('/plugins');
        const tbody = document.getElementById('plugins-list');
        tbody.innerHTML = '';
        
        if (data.plugins && data.plugins.length > 0) {
            data.plugins.forEach(plugin => {
                const row = document.createElement('tr');
                const statusClass = plugin.enabled ? 'enabled' : 'disabled';
                const statusText = plugin.enabled ? 'Enabled' : 'Disabled';
                
                row.innerHTML = `
                    <td>${escapeHtml(plugin.name)}</td>
                    <td>${escapeHtml(plugin.version)}</td>
                    <td>${escapeHtml(plugin.author)}</td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4">No plugins found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading plugins:', error);
    }
}

// Server Info
async function loadServerInfo() {
    try {
        const data = await API.get('/server');
        const infoContainer = document.getElementById('server-info');
        const worldsContainer = document.getElementById('server-worlds');
        infoContainer.innerHTML = '';
        worldsContainer.innerHTML = '';
        
        // Main server info
        const mainCard = createInfoCard('Server Information', {
            'Name': data.name,
            'Version': data.version,
            'Bukkit Version': data.bukkitVersion,
            'Minecraft Version': data.minecraftVersion,
            'Online Mode': data.onlineMode ? 'Yes' : 'No',
            'Players': `${data.currentPlayers}/${data.maxPlayers}`,
            'IP': data.ip || 'Not set',
            'Port': data.port,
            'MOTD': data.motd
        });
        infoContainer.appendChild(mainCard);
        
        // Settings
        const settingsCard = createInfoCard('Settings', {
            'Whitelist': data.whitelistEnabled ? 'Enabled' : 'Disabled',
            'Allow Flight': data.allowFlight ? 'Yes' : 'No',
            'Allow Nether': data.allowNether ? 'Yes' : 'No',
            'Allow End': data.allowEnd ? 'Yes' : 'No'
        });
        infoContainer.appendChild(settingsCard);
        
        // Worlds
        if (data.worlds && data.worlds.length > 0) {
            data.worlds.forEach(world => {
                const worldCard = createInfoCard(`World: ${world.name}`, {
                    'Environment': world.environment,
                    'Difficulty': world.difficulty,
                    'PvP': world.pvp ? 'Enabled' : 'Disabled',
                    'Seed': world.seed
                });
                worldsContainer.appendChild(worldCard);
            });
        }
    } catch (error) {
        console.error('Error loading server info:', error);
    }
}

function createInfoCard(title, data) {
    const card = document.createElement('div');
    card.className = 'info-card';
    
    let html = `<h3>${escapeHtml(title)}</h3>`;
    for (const [key, value] of Object.entries(data)) {
        html += `<p><span class="info-label">${escapeHtml(key)}:</span> ${escapeHtml(String(value))}</p>`;
    }
    
    card.innerHTML = html;
    return card;
}

// Console
let consoleInterval;

async function loadConsole() {
    // Clear existing interval
    if (consoleInterval) clearInterval(consoleInterval);
    
    // Load initial logs
    await updateConsole();
    
    // Update every 2 seconds
    consoleInterval = setInterval(updateConsole, 2000);
}

async function updateConsole() {
    try {
        const data = await API.get('/console');
        const logDiv = document.getElementById('console-log');
        
        if (data.logs && data.logs.length > 0) {
            logDiv.innerHTML = data.logs.map(log => 
                `<div class="console-log-line">${escapeHtml(log)}</div>`
            ).join('');
            
            // Auto-scroll to bottom
            logDiv.scrollTop = logDiv.scrollHeight;
        }
    } catch (error) {
        console.error('Error loading console:', error);
    }
}

document.getElementById('console-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const input = document.getElementById('console-command');
    const command = input.value.trim();
    
    if (!command) return;
    
    try {
        await API.post('/command', { command });
        input.value = '';
        
        // Wait a bit then refresh console
        setTimeout(updateConsole, 500);
    } catch (error) {
        console.error('Error executing command:', error);
        alert('Failed to execute command');
    }
});

// Chat Console
let chatInterval;

async function loadChat() {
    // Clear existing interval
    if (chatInterval) clearInterval(chatInterval);
    
    // Load initial logs
    await updateChat();
    
    // Update every 2 seconds
    chatInterval = setInterval(updateChat, 2000);
}

async function updateChat() {
    try {
        const data = await API.get('/chat');
        const logDiv = document.getElementById('chat-log');
        
        if (data.logs && data.logs.length > 0) {
            logDiv.innerHTML = data.logs.map(log => 
                `<div class="console-log-line">${escapeHtml(log)}</div>`
            ).join('');
            
            // Auto-scroll to bottom
            logDiv.scrollTop = logDiv.scrollHeight;
        }
    } catch (error) {
        console.error('Error loading chat:', error);
    }
}

document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    try {
        await API.post('/chat', { message });
        input.value = '';
        
        // Wait a bit then refresh chat
        setTimeout(updateChat, 500);
    } catch (error) {
        console.error('Error sending chat message:', error);
        alert('Failed to send message');
    }
});

// Settings
async function loadSettings() {
    try {
        const data = await API.get('/settings');
        
        // Render server properties
        const propsContainer = document.getElementById('server-properties-form');
        propsContainer.innerHTML = '';
        
        if (data.properties) {
            for (const [key, value] of Object.entries(data.properties)) {
                const formGroup = document.createElement('div');
                formGroup.className = 'form-group';
                
                const label = document.createElement('label');
                label.textContent = key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                const input = document.createElement('input');
                input.type = 'text';
                input.value = value;
                input.id = `prop-${key}`;
                input.dataset.key = key;
                
                formGroup.appendChild(label);
                formGroup.appendChild(input);
                propsContainer.appendChild(formGroup);
            }
            
            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save Properties';
            saveBtn.style.marginTop = '1rem';
            saveBtn.onclick = saveServerProperties;
            propsContainer.appendChild(saveBtn);
        }
        
        // Render game rules
        const rulesContainer = document.getElementById('gamerules-form');
        rulesContainer.innerHTML = '';
        
        if (data.gamerules) {
            for (const [key, value] of Object.entries(data.gamerules)) {
                const formGroup = document.createElement('div');
                formGroup.className = 'form-group';
                
                const label = document.createElement('label');
                label.textContent = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                
                const input = document.createElement('input');
                input.type = 'text';
                input.value = value;
                input.id = `rule-${key}`;
                input.dataset.key = key;
                
                formGroup.appendChild(label);
                formGroup.appendChild(input);
                rulesContainer.appendChild(formGroup);
            }
            
            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save Game Rules';
            saveBtn.style.marginTop = '1rem';
            saveBtn.onclick = saveGameRules;
            rulesContainer.appendChild(saveBtn);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveServerProperties() {
    const properties = {};
    document.querySelectorAll('#server-properties-form input').forEach(input => {
        if (input.dataset.key) {
            properties[input.dataset.key] = input.value;
        }
    });
    
    try {
        await API.post('/settings/properties', { properties });
        alert('Server properties saved successfully');
    } catch (error) {
        console.error('Error saving properties:', error);
        alert('Failed to save server properties');
    }
}

async function saveGameRules() {
    const gamerules = {};
    document.querySelectorAll('#gamerules-form input').forEach(input => {
        if (input.dataset.key) {
            gamerules[input.dataset.key] = input.value;
        }
    });
    
    try {
        await API.post('/settings/gamerules', { gamerules });
        alert('Game rules saved successfully');
    } catch (error) {
        console.error('Error saving game rules:', error);
        alert('Failed to save game rules');
    }
}

// Modal
document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('player-modal').classList.remove('active');
});

window.addEventListener('click', (e) => {
    const modal = document.getElementById('player-modal');
    if (e.target === modal) {
        modal.classList.remove('active');
    }
});

// Utility functions
function formatLastSeen(timestamp) {
    if (!timestamp || timestamp === 0) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

function formatPlayTime(seconds) {
    if (!seconds || seconds === 0) return '0h';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
loadPage('status');
startOfflineCheck();
