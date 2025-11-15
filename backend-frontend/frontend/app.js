// API Client
const API = {
    async get(endpoint) {
        const response = await fetch(`/api${endpoint}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    },

    async post(endpoint, data) {
        const response = await fetch(`/api${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    }
};

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
            case 'metrics':
                await loadMetrics();
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
            case 'plugins':
                await loadPlugins();
                break;
            case 'server':
                await loadServerInfo();
                break;
            case 'console':
                await loadConsole();
                break;
        }
    } catch (error) {
        console.error('Error loading page:', error);
    }
}

// Metrics
let metricsChart;
let metricsInterval;

async function loadMetrics() {
    // Clear existing interval
    if (metricsInterval) clearInterval(metricsInterval);
    
    // Load initial data
    await updateMetrics();
    
    // Update every 2 seconds
    metricsInterval = setInterval(updateMetrics, 2000);
}

async function updateMetrics() {
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
        console.error('Error updating metrics:', error);
    }
}

function updateMetricsChart(metrics) {
    const canvas = document.getElementById('metricsChart');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    
    ctx.clearRect(0, 0, width, height);
    
    if (metrics.length === 0) return;
    
    // Find max values
    const maxTPS = 20;
    const maxMemory = 100;
    
    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = padding + (graphHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }
    
    // Draw TPS line
    ctx.strokeStyle = '#3498db';
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
    ctx.strokeStyle = '#e74c3c';
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
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#3498db';
    ctx.fillText('TPS', padding, 20);
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('Memory %', padding + 60, 20);
}

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
                const statusText = player.online ? 'Online' : formatLastSeen(player.lastSeen);
                const playTime = formatPlayTime(player.playTime);
                
                row.innerHTML = `
                    <td>${escapeHtml(player.name)}</td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                    <td>${playTime}</td>
                    <td>
                        <button onclick="showPlayerInventory('${player.uuid}', '${escapeHtml(player.name)}')" ${!player.online ? 'disabled' : ''}>Inventory</button>
                        <button class="danger" onclick="toggleBan('${player.uuid}', ${player.banned})">${player.banned ? 'Unban' : 'Ban'}</button>
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
            inventoryDiv.innerHTML = '<p>Inventory is empty or player is offline</p>';
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

// Whitelist
async function loadWhitelist() {
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
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="2">Whitelist is empty</td></tr>';
        }
    } catch (error) {
        console.error('Error loading whitelist:', error);
    }
}

document.getElementById('whitelist-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('whitelist-name').value;
    const uuid = document.getElementById('whitelist-uuid').value;
    
    try {
        await API.post('/whitelist/add', { name, uuid });
        document.getElementById('whitelist-form').reset();
        await loadWhitelist();
    } catch (error) {
        console.error('Error adding to whitelist:', error);
        alert('Failed to add player to whitelist');
    }
});

// Blacklist
async function loadBlacklist() {
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
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="2">Blacklist is empty</td></tr>';
        }
    } catch (error) {
        console.error('Error loading blacklist:', error);
    }
}

document.getElementById('blacklist-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('blacklist-name').value;
    const uuid = document.getElementById('blacklist-uuid').value;
    
    try {
        await API.post('/blacklist/add', { name, uuid });
        document.getElementById('blacklist-form').reset();
        await loadBlacklist();
    } catch (error) {
        console.error('Error adding to blacklist:', error);
        alert('Failed to add player to blacklist');
    }
});

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
        const container = document.getElementById('server-info');
        container.innerHTML = '';
        
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
        container.appendChild(mainCard);
        
        // Settings
        const settingsCard = createInfoCard('Settings', {
            'Whitelist': data.whitelistEnabled ? 'Enabled' : 'Disabled',
            'Allow Flight': data.allowFlight ? 'Yes' : 'No',
            'Allow Nether': data.allowNether ? 'Yes' : 'No',
            'Allow End': data.allowEnd ? 'Yes' : 'No'
        });
        container.appendChild(settingsCard);
        
        // Worlds
        if (data.worlds && data.worlds.length > 0) {
            data.worlds.forEach(world => {
                const worldCard = createInfoCard(`World: ${world.name}`, {
                    'Environment': world.environment,
                    'Difficulty': world.difficulty,
                    'PvP': world.pvp ? 'Enabled' : 'Disabled',
                    'Seed': world.seed
                });
                container.appendChild(worldCard);
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
loadPage('metrics');
