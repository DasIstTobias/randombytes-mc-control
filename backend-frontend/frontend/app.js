// Custom Modal System - Replaces alert(), confirm(), prompt()
function showCustomModal(title, message, type = 'alert', inputPlaceholder = '') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-modal-overlay');
        const titleEl = document.getElementById('custom-modal-title');
        const messageEl = document.getElementById('custom-modal-message');
        const inputContainer = document.getElementById('custom-modal-input-container');
        const input = document.getElementById('custom-modal-input');
        const cancelBtn = document.getElementById('custom-modal-cancel');
        const confirmBtn = document.getElementById('custom-modal-confirm');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        // Show/hide input based on type
        if (type === 'prompt') {
            inputContainer.style.display = 'block';
            input.value = '';
            input.placeholder = inputPlaceholder;
            input.focus();
        } else {
            inputContainer.style.display = 'none';
        }
        
        // Configure buttons based on type
        if (type === 'alert') {
            cancelBtn.style.display = 'none';
            confirmBtn.textContent = 'OK';
            confirmBtn.className = 'modal-button primary';
        } else {
            cancelBtn.style.display = 'inline-block';
            confirmBtn.textContent = 'Confirm';
            confirmBtn.className = 'modal-button primary';
        }
        
        // Show modal
        overlay.style.display = 'flex';
        
        // Event handlers
        const handleConfirm = () => {
            overlay.style.display = 'none';
            if (type === 'prompt') {
                resolve(input.value);
            } else if (type === 'confirm') {
                resolve(true);
            } else {
                resolve(null);
            }
            cleanup();
        };
        
        const handleCancel = () => {
            overlay.style.display = 'none';
            if (type === 'prompt') {
                resolve(null);
            } else {
                resolve(false);
            }
            cleanup();
        };
        
        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                handleConfirm();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
        };
        
        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            if (type === 'prompt') {
                input.removeEventListener('keypress', handleKeyPress);
            }
            document.removeEventListener('keydown', handleKeyPress);
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        if (type === 'prompt') {
            input.addEventListener('keypress', handleKeyPress);
        }
        document.addEventListener('keydown', handleKeyPress);
    });
}

// Convenience wrappers
async function customAlert(message) {
    await showCustomModal('Information', message, 'alert');
}

async function customConfirm(message) {
    return await showCustomModal('Confirmation', message, 'confirm');
}

async function customPrompt(message, placeholder = '') {
    return await showCustomModal('Input Required', message, 'prompt', placeholder);
}

// Offline detection
let isOffline = false;
let offlineCheckInterval = null;

// Track failed player head image loads to prevent infinite retries
const failedPlayerHeads = new Set();

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

// Format uptime in human-readable format
function formatUptime(uptimeMs) {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
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
let currentPage = 'status';
let pageRefreshInterval = null;

async function loadPage(page) {
    // Clear any existing refresh interval
    if (pageRefreshInterval) {
        clearInterval(pageRefreshInterval);
        pageRefreshInterval = null;
    }
    
    currentPage = page;
    
    try {
        switch(page) {
            case 'status':
            case 'metrics':
                await loadStatus();
                break;
            case 'players':
                await loadPlayers();
                // Auto-refresh every second
                pageRefreshInterval = setInterval(loadPlayers, 1000);
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
                // Auto-refresh every second
                pageRefreshInterval = setInterval(loadPlugins, 1000);
                break;
            case 'server':
                await loadServerInfo();
                // Auto-refresh every second
                pageRefreshInterval = setInterval(loadServerInfo, 1000);
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
            case 'custom-recipes':
                await loadCustomRecipes();
                break;
            case 'logs':
                await loadLogs();
                // Auto-refresh every 2 seconds
                pageRefreshInterval = setInterval(loadLogs, 2000);
                break;
            case 'file-manager':
                await loadFileManager();
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

let maxPlayers = 20; // Default value, will be updated from server info
let serverIdentityData = null; // Store server identity data
let geyserMCDetected = false;
let geyserMCPort = null;

// Load sidebar server info on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadSidebarServerInfo();
});

async function loadSidebarServerInfo() {
    try {
        const [serverData, geyserData] = await Promise.all([
            API.get('/server'),
            API.get('/geysermc')
        ]);
        
        // Store server identity
        serverIdentityData = serverData;
        
        // Check for GeyserMC
        if (geyserData.detected) {
            geyserMCDetected = true;
            geyserMCPort = geyserData.bedrockPort || null;
        }
        
        // Populate sidebar
        const sidebarInfo = document.getElementById('sidebar-server-info');
        if (serverData) {
            let html = '';
            
            // Try to load server icon
            html += `<img src="/api/server-icon" alt="Server Icon" onerror="this.style.display='none'">`;
            
            html += `<div class="sidebar-server-details">`;
            html += `<div class="server-address">${escapeHtml(serverData.ip || 'localhost')}</div>`;
            html += `<div class="server-port">Port: ${serverData.port}</div>`;
            html += `</div>`;
            
            sidebarInfo.innerHTML = html;
            sidebarInfo.style.display = 'flex';
        }
    } catch (error) {
        console.error('Error loading sidebar server info:', error);
    }
}

async function updateStatus() {
    try {
        const [metricsData, serverData, playersData] = await Promise.all([
            API.get('/metrics'),
            API.get('/server'),
            API.get('/players')
        ]);
        
        if (metricsData.metrics && metricsData.metrics.length > 0) {
            const latest = metricsData.metrics[metricsData.metrics.length - 1];
            
            // Use actual count of online players from players API for accuracy
            let onlineCount = 0;
            if (playersData && playersData.players) {
                onlineCount = playersData.players.filter(p => p.online).length;
            }
            
            document.getElementById('current-players').textContent = onlineCount;
            document.getElementById('current-tps').textContent = (latest.tps || 0).toFixed(1);
            document.getElementById('current-memory').textContent = (latest.memory || 0).toFixed(1) + '%';
            document.getElementById('current-cpu').textContent = (latest.cpu || 0).toFixed(1) + '%';
            
            // Update server uptime
            if (serverData && serverData.uptime) {
                document.getElementById('server-uptime').textContent = formatUptime(serverData.uptime);
            } else {
                document.getElementById('server-uptime').textContent = '-';
            }
            
            // Update max players from server info
            if (serverData && serverData.maxPlayers) {
                maxPlayers = serverData.maxPlayers;
            }
            
            // Update server identity header if not yet displayed
            if (serverData && serverIdentityData) {
                updateServerIdentityHeader(serverData);
            }
            
            // Update chart - use metrics data for historical display
            updateMetricsChart(metricsData.metrics, maxPlayers);
        }
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

function updateServerIdentityHeader(serverData) {
    const identityDiv = document.getElementById('server-identity');
    if (!identityDiv || identityDiv.style.display === 'flex') {
        return; // Already displayed
    }
    
    let html = '';
    
    // Server icon
    html += `<img src="/api/server-icon" alt="Server Icon" onerror="this.style.display='none'">`;
    
    // Main server info
    html += `<div class="server-identity-main">`;
    html += `<div class="server-identity-address">${escapeHtml(serverData.ip || 'localhost')}</div>`;
    html += `<div class="server-identity-motd">${escapeHtml(serverData.motd || 'A Minecraft Server')}</div>`;
    html += `</div>`;
    
    // Port and GeyserMC info
    html += `<div class="server-identity-extra">`;
    html += `<div class="server-identity-port">Java Port: ${serverData.port}</div>`;
    
    if (geyserMCDetected) {
        html += `<div class="server-identity-geyser">`;
        html += `<span style="color: #4a9; font-weight: bold;">GeyserMC</span>`;
        if (geyserMCPort) {
            html += ` <span style="color: #999;">Bedrock Port: ${geyserMCPort}</span>`;
        }
        html += `</div>`;
    }
    
    html += `</div>`;
    
    identityDiv.innerHTML = html;
    identityDiv.style.display = 'flex';
}

function updateMetricsChart(metrics, maxPlayerCount) {
    const canvas = document.getElementById('metricsChart');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const width = canvas.width;
    const height = canvas.offsetHeight;
    const padding = 60; // Space for labels
    const paddingRight = 70; // Extra space for player count axis
    const paddingBottom = 50; // Extra space for time axis
    const graphWidth = width - padding - paddingRight;
    const graphHeight = height - padding - paddingBottom;
    
    ctx.clearRect(0, 0, width, height);
    
    if (metrics.length === 0) return;
    
    // Find max values
    const maxTPS = 20;
    const maxMemory = 100;
    const maxCPU = 100;
    
    // Set font for labels
    ctx.font = '11px monospace';
    ctx.fillStyle = '#999';
    
    // Draw grid and percentage labels (left axis)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = padding + (graphHeight / 5) * i;
        const percentage = 100 - (i * 20); // 100%, 80%, 60%, 40%, 20%, 0%
        
        // Draw grid line
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + graphWidth, y);
        ctx.stroke();
        
        // Draw percentage label on left
        ctx.textAlign = 'right';
        ctx.fillText(`${percentage}%`, padding - 10, y + 4);
    }
    
    // Draw player count axis labels (right side)
    ctx.fillStyle = '#4af';
    for (let i = 0; i <= 5; i++) {
        const y = padding + (graphHeight / 5) * i;
        const playerValue = Math.round(maxPlayerCount - (i * maxPlayerCount / 5));
        
        ctx.textAlign = 'left';
        ctx.fillText(`${playerValue}`, padding + graphWidth + 10, y + 4);
    }
    
    // Draw time axis labels (bottom)
    const now = Date.now();
    const oldest = metrics[0].timestamp;
    const duration = now - oldest;
    const minutes = Math.ceil(duration / 60000);
    
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    
    // Draw time labels at key points
    for (let i = 0; i <= 5; i++) {
        const x = padding + (graphWidth / 5) * i;
        const minutesAgo = Math.round((5 - i) * minutes / 5);
        const timestamp = now - (minutesAgo * 60000);
        const date = new Date(timestamp);
        
        // Relative time label
        const relativeLabel = i === 5 ? 'now' : `-${minutesAgo} min`;
        ctx.fillText(relativeLabel, x, padding + graphHeight + 20);
        
        // Actual time label
        const timeLabel = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        ctx.font = '10px monospace';
        ctx.fillText(timeLabel, x, padding + graphHeight + 35);
        ctx.font = '11px monospace';
    }
    
    // Draw TPS line (green)
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
    
    // Draw Memory line (red)
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
    
    // Draw CPU line (orange)
    ctx.strokeStyle = '#f90';
    ctx.lineWidth = 2;
    ctx.beginPath();
    metrics.forEach((point, index) => {
        const x = padding + (graphWidth / (metrics.length - 1)) * index;
        const y = padding + graphHeight - (point.cpu / maxCPU) * graphHeight;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw Player Count line (blue) - uses right axis
    ctx.strokeStyle = '#4af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    metrics.forEach((point, index) => {
        const x = padding + (graphWidth / (metrics.length - 1)) * index;
        const y = padding + graphHeight - (point.players / maxPlayerCount) * graphHeight;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw legend
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4a9';
    ctx.fillText('TPS', padding, 20);
    ctx.fillStyle = '#d44';
    ctx.fillText('Memory', padding + 60, 20);
    ctx.fillStyle = '#f90';
    ctx.fillText('CPU', padding + 130, 20);
    ctx.fillStyle = '#4af';
    ctx.fillText('Players', padding + 180, 20);
}

// Shutdown Server
document.getElementById('shutdown-server-btn').addEventListener('click', async () => {
    const confirmed = await customConfirm('Are you sure you want to shutdown the server? All players will be disconnected and the server will stop.');
    if (!confirmed) {
        return;
    }
    
    try {
        await API.post('/restart', {});
        await customAlert('Server shutdown initiated.');
    } catch (error) {
        console.error('Error shutting down server:', error);
        await customAlert('Failed to shutdown server: ' + error.message);
    }
});

// Players
let allPlayers = []; // Store all players for search filtering
let currentPlayerSearch = ''; // Store current search term

async function loadPlayers() {
    try {
        const data = await API.get('/players');
        allPlayers = data.players || [];
        
        // Apply current search filter when refreshing
        if (currentPlayerSearch) {
            const filtered = allPlayers.filter(player => 
                player.name.toLowerCase().includes(currentPlayerSearch) || 
                player.uuid.toLowerCase().includes(currentPlayerSearch)
            );
            renderPlayers(filtered);
        } else {
            renderPlayers(allPlayers);
        }
    } catch (error) {
        console.error('Error loading players:', error);
    }
}

function renderPlayers(players) {
    const tbody = document.getElementById('players-list');
    tbody.innerHTML = '';
    
    if (players && players.length > 0) {
        players.forEach(player => {
            const row = document.createElement('tr');
            
            const statusClass = player.online ? 'online' : 'offline';
            const statusText = player.online ? 'Online' : 'Offline';
            const playTime = formatPlayTime(player.playTime);
            const playerHeadUrl = `/api/player-head/${player.uuid}`;
            
            // Check if this image has failed before
            const shouldTryImage = !failedPlayerHeads.has(player.uuid);
            const imageHtml = shouldTryImage 
                ? `<img src="${playerHeadUrl}" class="player-head" alt="${escapeHtml(player.name)}" onerror="handlePlayerHeadError('${player.uuid}', this)">` 
                : '';
            
            row.innerHTML = `
                <td>${imageHtml}${escapeHtml(player.name)}</td>
                <td><span class="status ${statusClass}">${statusText}</span></td>
                <td>${playTime}</td>
                <td>
                    <button onclick="showPlayerInventory('${player.uuid}', '${escapeHtml(player.name)}')">Inventory</button>
                    ${player.online ? `<button class="warning" onclick="kickPlayer('${player.uuid}', '${escapeHtml(player.name)}')">Kick</button>` : ''}
                    <button class="danger" onclick="toggleBan('${player.uuid}', ${player.banned})">${player.banned ? 'Unban' : 'Ban'}</button>
                    <button onclick="toggleOp('${player.uuid}', ${player.op || false})">${player.op ? 'DeOP' : 'OP'}</button>
                </td>
            `;
            row.dataset.uuid = player.uuid;
            row.dataset.name = player.name.toLowerCase();
            tbody.appendChild(row);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="4">No players found</td></tr>';
    }
}

function handlePlayerHeadError(uuid, imgElement) {
    // Mark this UUID as failed
    failedPlayerHeads.add(uuid);
    // Hide the image
    imgElement.style.display = 'none';
}

// Player search functionality
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('player-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            currentPlayerSearch = searchTerm; // Store the search term
            
            if (!searchTerm) {
                renderPlayers(allPlayers);
                return;
            }
            
            const filtered = allPlayers.filter(player => 
                player.name.toLowerCase().includes(searchTerm) || 
                player.uuid.toLowerCase().includes(searchTerm)
            );
            
            renderPlayers(filtered);
        });
    }
});

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
        await customAlert('Failed to load player inventory');
    }
}

async function toggleBan(uuid, isBanned) {
    try {
        const action = isBanned ? 'unban' : 'ban';
        await API.post(`/player/${uuid}/action`, { action });
        await loadPlayers();
    } catch (error) {
        console.error('Error toggling ban:', error);
        await customAlert('Failed to ' + (isBanned ? 'unban' : 'ban') + ' player');
    }
}

async function toggleOp(uuid, isOp) {
    try {
        const action = isOp ? 'deop' : 'op';
        await API.post(`/player/${uuid}/action`, { action });
        await loadPlayers();
    } catch (error) {
        console.error('Error toggling OP:', error);
        await customAlert('Failed to ' + (isOp ? 'de-op' : 'op') + ' player');
    }
}

async function kickPlayer(uuid, name) {
    const confirmed = await customConfirm(`Are you sure you want to kick ${name} from the server?`);
    if (!confirmed) return;
    
    try {
        await API.post(`/player/${uuid}/action`, { action: 'kick' });
        await customAlert(`${name} has been kicked from the server`);
        await loadPlayers();
    } catch (error) {
        console.error('Error kicking player:', error);
        await customAlert('Failed to kick player: ' + error.message);
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
                const playerHeadUrl = `/api/player-head/${entry.uuid}`;
                row.innerHTML = `
                    <td><img src="${playerHeadUrl}" class="player-head" alt="${escapeHtml(entry.name)}" onerror="this.style.display='none'">${escapeHtml(entry.name)}</td>
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
            await customAlert('Could not find UUID for player: ' + name);
            return;
        }
    }
    
    try {
        await API.post('/whitelist/add', { name, uuid });
        document.getElementById('whitelist-form').reset();
        await updateWhitelist();
    } catch (error) {
        console.error('Error adding to whitelist:', error);
        await customAlert('Failed to add player to whitelist');
    }
});

async function removeFromWhitelist(uuid, name) {
    const confirmed = await customConfirm(`Remove ${name} from whitelist?`);
    if (!confirmed) return;
    
    try {
        await API.delete(`/whitelist/remove?uuid=${uuid}`);
        await updateWhitelist();
    } catch (error) {
        console.error('Error removing from whitelist:', error);
        await customAlert('Failed to remove player from whitelist');
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
                const playerHeadUrl = `/api/player-head/${entry.uuid}`;
                row.innerHTML = `
                    <td><img src="${playerHeadUrl}" class="player-head" alt="${escapeHtml(entry.name)}" onerror="this.style.display='none'">${escapeHtml(entry.name)}</td>
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
            await customAlert('Could not find UUID for player: ' + name);
            return;
        }
    }
    
    try {
        await API.post('/blacklist/add', { name, uuid });
        document.getElementById('blacklist-form').reset();
        await updateBlacklist();
    } catch (error) {
        console.error('Error adding to blacklist:', error);
        await customAlert('Failed to add player to blacklist');
    }
});

async function removeFromBlacklist(uuid, name) {
    const confirmed = await customConfirm(`Remove ${name} from blacklist?`);
    if (!confirmed) return;
    
    try {
        await API.delete(`/blacklist/remove?uuid=${uuid}`);
        await updateBlacklist();
    } catch (error) {
        console.error('Error removing from blacklist:', error);
        await customAlert('Failed to remove player from blacklist');
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
                const playerHeadUrl = `/api/player-head/${entry.uuid}`;
                row.innerHTML = `
                    <td><img src="${playerHeadUrl}" class="player-head" alt="${escapeHtml(entry.name)}" onerror="this.style.display='none'">${escapeHtml(entry.name)}</td>
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
            await customAlert('Could not find UUID for player: ' + name);
            return;
        }
    }
    
    try {
        await API.post('/ops/add', { name, uuid });
        document.getElementById('ops-form').reset();
        await updateOps();
    } catch (error) {
        console.error('Error adding operator:', error);
        await customAlert('Failed to add operator');
    }
});

async function removeFromOps(uuid, name) {
    const confirmed = await customConfirm(`Remove ${name} from operators?`);
    if (!confirmed) return;
    
    try {
        await API.delete(`/ops/remove?uuid=${uuid}`);
        await updateOps();
    } catch (error) {
        console.error('Error removing operator:', error);
        await customAlert('Failed to remove operator');
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
        const [data, geyserData] = await Promise.all([
            API.get('/server'),
            API.get('/geysermc')
        ]);
        
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
        
        // GeyserMC info (if detected)
        if (geyserData.detected) {
            const geyserInfo = {
                'Version': geyserData.version || 'Unknown',
                'Bedrock Port': geyserData.bedrockPort || 'Not configured'
            };
            
            if (geyserData.bedrockAddress && geyserData.bedrockAddress !== '0.0.0.0') {
                geyserInfo['Bedrock Address'] = geyserData.bedrockAddress;
            }
            
            if (geyserData.motd1) {
                geyserInfo['MOTD Line 1'] = geyserData.motd1;
            }
            
            if (geyserData.motd2) {
                geyserInfo['MOTD Line 2'] = geyserData.motd2;
            }
            
            const geyserCard = createInfoCard('GeyserMC (Bedrock Support)', geyserInfo);
            infoContainer.appendChild(geyserCard);
        }
        
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
        await customAlert('Failed to execute command');
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
        await customAlert('Failed to send message');
    }
});

// Settings
async function loadSettings() {
    try {
        const data = await API.get('/settings');
        
        // Render server properties with organized sections
        const propsContainer = document.getElementById('server-properties-form');
        propsContainer.innerHTML = '';
        
        if (data.properties) {
            // Define property categories
            const categories = {
                'Basic Settings': ['motd', 'max-players', 'difficulty', 'whitelist'],
                'Network Settings': ['online-mode', 'allow-flight', 'allow-nether', 'allow-end'],
            };
            
            // Render categorized properties
            for (const [categoryName, keys] of Object.entries(categories)) {
                const section = document.createElement('div');
                section.className = 'settings-section';
                
                const heading = document.createElement('h4');
                heading.textContent = categoryName;
                section.appendChild(heading);
                
                for (const key of keys) {
                    if (data.properties.hasOwnProperty(key)) {
                        const value = data.properties[key];
                        const formGroup = createSettingInput(key, value, 'prop');
                        section.appendChild(formGroup);
                    }
                }
                
                propsContainer.appendChild(section);
            }
            
            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save Properties';
            saveBtn.style.marginTop = '1rem';
            saveBtn.onclick = saveServerProperties;
            propsContainer.appendChild(saveBtn);
        }
        
        // Render game rules with organized sections
        const rulesContainer = document.getElementById('gamerules-form');
        rulesContainer.innerHTML = '';
        
        if (data.gamerules) {
            // Group gamerules by category
            const ruleCategories = {
                'Mob Behaviour': ['doMobSpawning', 'doMobLoot', 'mobGriefing', 'doPatrolSpawning', 'doTraderSpawning', 'doWardenSpawning'],
                'Player Settings': ['keepInventory', 'doImmediateRespawn', 'playersSleepingPercentage', 'naturalRegeneration', 'showDeathMessages'],
                'World Settings': ['doDaylightCycle', 'doWeatherCycle', 'randomTickSpeed', 'spawnRadius'],
                'Block & Fire': ['doFireTick', 'doTileDrops', 'tntExplodes'],
                'Other': []
            };
            
            // Sort gamerules into categories
            const sortedRules = {};
            const usedKeys = new Set();
            
            for (const [category, keys] of Object.entries(ruleCategories)) {
                sortedRules[category] = [];
                for (const key of keys) {
                    if (data.gamerules.hasOwnProperty(key)) {
                        sortedRules[category].push([key, data.gamerules[key]]);
                        usedKeys.add(key);
                    }
                }
            }
            
            // Add remaining rules to "Other"
            for (const [key, value] of Object.entries(data.gamerules)) {
                if (!usedKeys.has(key)) {
                    sortedRules['Other'].push([key, value]);
                }
            }
            
            // Render categorized game rules
            for (const [categoryName, rules] of Object.entries(sortedRules)) {
                if (rules.length === 0) continue;
                
                const section = document.createElement('div');
                section.className = 'settings-section';
                
                const heading = document.createElement('h4');
                heading.textContent = categoryName;
                section.appendChild(heading);
                
                for (const [key, value] of rules) {
                    const formGroup = createSettingInput(key, value, 'rule');
                    section.appendChild(formGroup);
                }
                
                rulesContainer.appendChild(section);
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

function createSettingInput(key, value, prefix) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    
    const label = document.createElement('label');
    label.textContent = key.replace(/-/g, ' ').replace(/([A-Z])/g, ' $1').replace(/\b\w/g, l => l.toUpperCase());
    formGroup.appendChild(label);
    
    const valueStr = String(value).toLowerCase();
    
    // Check if boolean
    if (valueStr === 'true' || valueStr === 'false') {
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'toggle-container';
        
        const falseLabel = document.createElement('span');
        falseLabel.className = 'toggle-label';
        falseLabel.textContent = 'false';
        
        const switchLabel = document.createElement('label');
        switchLabel.className = 'toggle-switch';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = valueStr === 'true';
        checkbox.id = `${prefix}-${key}`;
        checkbox.dataset.key = key;
        
        const slider = document.createElement('span');
        slider.className = 'toggle-slider';
        
        switchLabel.appendChild(checkbox);
        switchLabel.appendChild(slider);
        
        const trueLabel = document.createElement('span');
        trueLabel.className = 'toggle-label';
        trueLabel.textContent = 'true';
        
        toggleContainer.appendChild(falseLabel);
        toggleContainer.appendChild(switchLabel);
        toggleContainer.appendChild(trueLabel);
        
        formGroup.appendChild(toggleContainer);
    }
    // Check if number
    else if (!isNaN(value) && value !== '') {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = value;
        input.id = `${prefix}-${key}`;
        input.dataset.key = key;
        formGroup.appendChild(input);
    }
    // Text field
    else {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.id = `${prefix}-${key}`;
        input.dataset.key = key;
        formGroup.appendChild(input);
    }
    
    return formGroup;
}

async function saveServerProperties() {
    const properties = {};
    document.querySelectorAll('#server-properties-form input, #server-properties-form input[type="checkbox"]').forEach(input => {
        if (input.dataset.key) {
            if (input.type === 'checkbox') {
                properties[input.dataset.key] = input.checked;
            } else {
                properties[input.dataset.key] = input.value;
            }
        }
    });
    
    try {
        await API.post('/settings/properties', { properties });
        await customAlert('Server properties saved successfully');
    } catch (error) {
        console.error('Error saving properties:', error);
        await customAlert('Failed to save server properties');
    }
}

async function saveGameRules() {
    const gamerules = {};
    document.querySelectorAll('#gamerules-form input, #gamerules-form input[type="checkbox"]').forEach(input => {
        if (input.dataset.key) {
            if (input.type === 'checkbox') {
                gamerules[input.dataset.key] = input.checked;
            } else {
                gamerules[input.dataset.key] = input.value;
            }
        }
    });
    
    try {
        await API.post('/settings/gamerules', { gamerules });
        await customAlert('Game rules saved successfully');
    } catch (error) {
        console.error('Error saving game rules:', error);
        await customAlert('Failed to save game rules');
    }
}

// Modal
document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('player-modal').classList.remove('active');
});

// Custom Recipes
let editingRecipeId = null;

async function loadCustomRecipes() {
    try {
        const data = await API.get('/recipes');
        renderRecipesList(data.recipes || []);
    } catch (error) {
        console.error('Error loading recipes:', error);
        // If endpoint doesn't exist yet, show empty list
        renderRecipesList([]);
    }
}

function renderRecipesList(recipes) {
    const tbody = document.getElementById('recipes-list');
    tbody.innerHTML = '';
    
    if (recipes && recipes.length > 0) {
        recipes.forEach(recipe => {
            const row = document.createElement('tr');
            const recipeType = recipe.shaped ? 'Shaped' : 'Shapeless';
            const resultDisplay = `${recipe.result.item} ×${recipe.result.count}`;
            
            row.innerHTML = `
                <td>${escapeHtml(recipe.id)}</td>
                <td>${recipeType}</td>
                <td>${escapeHtml(resultDisplay)}</td>
                <td>
                    <button onclick="editRecipe('${recipe.id}')">Edit</button>
                    <button class="danger" onclick="deleteRecipe('${recipe.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="4">No custom recipes yet</td></tr>';
    }
}

async function editRecipe(recipeId) {
    try {
        const data = await API.get(`/recipe/${recipeId}`);
        if (data.recipe) {
            editingRecipeId = recipeId;
            
            // Set recipe type
            const typeRadio = document.querySelector(`input[name="recipe-type"][value="${data.recipe.shaped ? 'shaped' : 'shapeless'}"]`);
            if (typeRadio) typeRadio.checked = true;
            
            // Fill crafting grid
            const slots = document.querySelectorAll('.crafting-slot');
            slots.forEach((slot, index) => {
                slot.value = data.recipe.ingredients[index] || '';
            });
            
            // Fill result
            document.getElementById('result-item').value = data.recipe.result.item;
            document.getElementById('result-count').value = data.recipe.result.count;
            
            // Update button text
            document.getElementById('save-recipe-btn').textContent = 'Update Recipe';
            
            // Scroll to form
            document.getElementById('recipe-form').scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error('Error loading recipe for edit:', error);
        await customAlert('Failed to load recipe');
    }
}

async function deleteRecipe(recipeId) {
    const confirmed = await customConfirm(`Are you sure you want to delete recipe "${recipeId}"?`);
    if (!confirmed) return;
    
    try {
        await API.delete(`/recipe/${recipeId}`);
        await customAlert('Recipe deleted successfully');
        await loadCustomRecipes();
    } catch (error) {
        console.error('Error deleting recipe:', error);
        await customAlert('Failed to delete recipe');
    }
}

// Recipe form handling
document.addEventListener('DOMContentLoaded', () => {
    const recipeForm = document.getElementById('recipe-form');
    const clearBtn = document.getElementById('clear-recipe-btn');
    
    if (recipeForm) {
        recipeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const recipeType = document.querySelector('input[name="recipe-type"]:checked').value;
            const shaped = recipeType === 'shaped';
            
            // Collect ingredients
            const ingredients = [];
            document.querySelectorAll('.crafting-slot').forEach(slot => {
                const value = slot.value.trim();
                ingredients.push(value || null);
            });
            
            // Validate that at least one ingredient is provided
            if (ingredients.every(i => !i)) {
                await customAlert('Please add at least one ingredient');
                return;
            }
            
            // Get result
            const resultItem = document.getElementById('result-item').value.trim();
            const resultCount = parseInt(document.getElementById('result-count').value) || 1;
            
            if (!resultItem) {
                await customAlert('Please specify a result item');
                return;
            }
            
            // Validate item IDs (basic validation)
            const allItems = [...ingredients.filter(i => i), resultItem];
            for (const item of allItems) {
                if (!/^[a-z0-9_:]+$/.test(item)) {
                    await customAlert(`Invalid item ID: "${item}". Use only lowercase letters, numbers, underscores, and colons (e.g., "minecraft:diamond")`);
                    return;
                }
            }
            
            const recipe = {
                shaped,
                ingredients,
                result: {
                    item: resultItem,
                    count: resultCount
                }
            };
            
            try {
                if (editingRecipeId) {
                    await API.post(`/recipe/${editingRecipeId}`, recipe);
                    await customAlert('Recipe updated successfully');
                    editingRecipeId = null;
                    document.getElementById('save-recipe-btn').textContent = 'Save Recipe';
                } else {
                    await API.post('/recipes', recipe);
                    await customAlert('Recipe created successfully');
                }
                
                // Clear form
                clearRecipeForm();
                
                // Reload recipes list
                await loadCustomRecipes();
            } catch (error) {
                console.error('Error saving recipe:', error);
                await customAlert('Failed to save recipe: ' + (error.message || 'Unknown error'));
            }
        });
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            clearRecipeForm();
        });
    }
});

function clearRecipeForm() {
    document.querySelectorAll('.crafting-slot').forEach(slot => slot.value = '');
    document.getElementById('result-item').value = '';
    document.getElementById('result-count').value = '1';
    document.querySelector('input[name="recipe-type"][value="shaped"]').checked = true;
    editingRecipeId = null;
    document.getElementById('save-recipe-btn').textContent = 'Save Recipe';
}

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

// Logs Page
let allLogs = []; // Store all logs
let currentLogSearch = ''; // Store current search term
let autoScroll = true; // Auto-scroll state

async function loadLogs() {
    try {
        const data = await API.get('/logs');
        allLogs = data.logs || [];
        
        // Apply current search filter when refreshing
        if (currentLogSearch) {
            const filtered = allLogs.filter(log => 
                log.toLowerCase().includes(currentLogSearch)
            );
            renderLogs(filtered);
        } else {
            renderLogs(allLogs);
        }
    } catch (error) {
        console.error('Error loading logs:', error);
        // Show empty state if API not available yet
        renderLogs([]);
    }
}

function renderLogs(logs) {
    const outputDiv = document.getElementById('logs-output');
    const wasAtBottom = isScrolledToBottom(outputDiv.parentElement);
    
    outputDiv.innerHTML = '';
    
    if (logs && logs.length > 0) {
        logs.forEach(log => {
            const lineDiv = document.createElement('div');
            lineDiv.className = 'log-line';
            
            // Highlight search matches
            if (currentLogSearch && log.toLowerCase().includes(currentLogSearch)) {
                lineDiv.classList.add('highlight');
            }
            
            lineDiv.textContent = log;
            outputDiv.appendChild(lineDiv);
        });
    } else {
        outputDiv.innerHTML = '<div class="log-line">No logs available</div>';
    }
    
    // Auto-scroll to bottom if enabled and was at bottom
    if (autoScroll && wasAtBottom) {
        scrollToBottom(outputDiv.parentElement);
    }
}

function isScrolledToBottom(element) {
    if (!element) return true;
    return element.scrollHeight - element.scrollTop - element.clientHeight < 50;
}

function scrollToBottom(element) {
    if (element) {
        element.scrollTop = element.scrollHeight;
    }
}

// Logs search functionality
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('logs-search');
    const clearSearchBtn = document.getElementById('clear-logs-search');
    const autoScrollToggle = document.getElementById('autoscroll-toggle');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            currentLogSearch = searchTerm;
            
            if (clearSearchBtn) {
                clearSearchBtn.style.display = searchTerm ? 'inline-block' : 'none';
            }
            
            if (!searchTerm) {
                renderLogs(allLogs);
                return;
            }
            
            const filtered = allLogs.filter(log => 
                log.toLowerCase().includes(searchTerm)
            );
            
            renderLogs(filtered);
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                currentLogSearch = '';
                clearSearchBtn.style.display = 'none';
                renderLogs(allLogs);
            }
        });
    }
    
    if (autoScrollToggle) {
        autoScrollToggle.addEventListener('change', (e) => {
            autoScroll = e.target.checked;
            if (autoScroll) {
                const logsContainer = document.querySelector('.logs-container');
                scrollToBottom(logsContainer);
            }
        });
    }
});

// File Manager
let currentPath = '';
let currentFiles = [];
let currentSortBy = 'name';
let currentFileSearch = '';
let contextMenuTarget = null;
let fileChangeLog = []; // Track all file operations

function addToChangeLog(action) {
    const now = new Date();
    const timestamp = now.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    fileChangeLog.unshift(`[${timestamp}] ${action}`);
    // Keep only last 500 entries
    if (fileChangeLog.length > 500) {
        fileChangeLog = fileChangeLog.slice(0, 500);
    }
}

async function loadFileManager() {
    try {
        await loadFiles(currentPath);
        initFileManagerEventListeners();
    } catch (error) {
        console.error('Error loading file manager:', error);
    }
}

async function loadFiles(path) {
    try {
        const data = await API.get(`/files?path=${encodeURIComponent(path || '')}`);
        
        if (data.error) {
            await customAlert('Error loading files: ' + data.error);
            return;
        }
        
        currentPath = data.currentPath || '';
        currentFiles = data.items || [];
        
        // Update breadcrumb
        updateBreadcrumb(currentPath);
        
        // Apply filters and render
        renderFiles();
    } catch (error) {
        console.error('Error loading files:', error);
        await customAlert('Failed to load files');
    }
}

function updateBreadcrumb(path) {
    const breadcrumb = document.getElementById('file-breadcrumb');
    breadcrumb.innerHTML = '';
    
    // Add root
    const rootItem = document.createElement('span');
    rootItem.className = 'breadcrumb-item';
    rootItem.textContent = 'Root';
    rootItem.dataset.path = '';
    rootItem.addEventListener('click', () => loadFiles(''));
    breadcrumb.appendChild(rootItem);
    
    // Add path segments
    if (path) {
        const segments = path.split('/').filter(s => s);
        let currentSegmentPath = '';
        
        segments.forEach((segment, index) => {
            currentSegmentPath += (currentSegmentPath ? '/' : '') + segment;
            const segmentPath = currentSegmentPath;
            
            const item = document.createElement('span');
            item.className = 'breadcrumb-item';
            item.textContent = segment;
            item.dataset.path = segmentPath;
            item.addEventListener('click', () => loadFiles(segmentPath));
            breadcrumb.appendChild(item);
        });
    }
}

function renderFiles() {
    const tbody = document.getElementById('file-list-body');
    tbody.innerHTML = '';
    
    // Filter files
    let filtered = currentFiles;
    if (currentFileSearch) {
        const searchLower = currentFileSearch.toLowerCase();
        filtered = currentFiles.filter(file => 
            file.name.toLowerCase().includes(searchLower)
        );
    }
    
    // Sort files
    filtered = sortFiles(filtered, currentSortBy);
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No files found</td></tr>';
        return;
    }
    
    filtered.forEach(file => {
        const row = document.createElement('tr');
        row.dataset.path = file.path;
        row.dataset.isDirectory = file.isDirectory;
        row.dataset.name = file.name;
        row.dataset.editable = file.editable || false;
        
        // Name column with icon
        const nameCell = document.createElement('td');
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const icon = document.createElement('span');
        icon.className = 'file-icon';
        if (file.isDirectory) {
            icon.classList.add('folder');
        } else {
            icon.classList.add(file.type || 'file');
        }
        
        const name = document.createElement('span');
        name.className = 'file-name';
        if (file.isDirectory) {
            name.classList.add('directory');
        }
        name.textContent = file.name;
        
        fileItem.appendChild(icon);
        fileItem.appendChild(name);
        nameCell.appendChild(fileItem);
        
        // Size column
        const sizeCell = document.createElement('td');
        sizeCell.className = 'file-size';
        sizeCell.textContent = file.isDirectory ? '-' : formatFileSize(file.size);
        
        // Modified column
        const modifiedCell = document.createElement('td');
        modifiedCell.className = 'file-date';
        modifiedCell.textContent = file.modified ? formatFileDate(file.modified) : '-';
        
        // Actions column
        const actionsCell = document.createElement('td');
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'file-actions';
        
        if (!file.isDirectory) {
            // Check if it's an image file
            const isImage = /\.(webp|jpg|jpeg|png)$/i.test(file.name);
            
            // 1. Edit button (for editable files)
            if (file.editable) {
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Edit';
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    openFileEditor(file.path, file.name);
                };
                actionsDiv.appendChild(editBtn);
            }
            
            // 2. Open Picture button (for image files)
            if (isImage) {
                const openPictureBtn = document.createElement('button');
                openPictureBtn.textContent = 'Open Picture';
                openPictureBtn.onclick = (e) => {
                    e.stopPropagation();
                    openImageViewer(file.path);
                };
                actionsDiv.appendChild(openPictureBtn);
            }
            
            // 3. Download button
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-btn';
            downloadBtn.textContent = 'Download';
            downloadBtn.onclick = (e) => {
                e.stopPropagation();
                downloadFile(file.path);
            };
            actionsDiv.appendChild(downloadBtn);
        }
        
        // 4. Delete button (for both files and directories)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteFileOrFolder(file.path, file.name, file.isDirectory);
        };
        actionsDiv.appendChild(deleteBtn);
        
        actionsCell.appendChild(actionsDiv);
        
        row.appendChild(nameCell);
        row.appendChild(sizeCell);
        row.appendChild(modifiedCell);
        row.appendChild(actionsCell);
        
        // Double-click handler
        row.addEventListener('dblclick', () => {
            if (file.isDirectory) {
                loadFiles(file.path);
            } else {
                // Check if it's an image
                const isImage = /\.(webp|jpg|jpeg|png)$/i.test(file.name);
                if (isImage) {
                    openImageViewer(file.path);
                } else if (file.editable) {
                    openFileEditor(file.path, file.name);
                }
            }
        });
        
        // Right-click context menu
        row.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e, row);
        });
        
        tbody.appendChild(row);
    });
}

function sortFiles(files, sortBy) {
    const sorted = [...files];
    
    // Always put directories first
    sorted.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'size':
                return (b.size || 0) - (a.size || 0);
            case 'date':
                return (b.modified || 0) - (a.modified || 0);
            default:
                return 0;
        }
    });
    
    return sorted;
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatFileDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function downloadFile(path) {
    try {
        window.location.href = `/api/files/download?path=${encodeURIComponent(path)}`;
    } catch (error) {
        console.error('Error downloading file:', error);
        await customAlert('Failed to download file');
    }
}

async function openFileEditor(path, name) {
    try {
        const data = await API.get(`/files/content?path=${encodeURIComponent(path)}`);
        
        if (data.error) {
            await customAlert('Error loading file: ' + data.error);
            return;
        }
        
        document.getElementById('file-editor-title').textContent = `Edit: ${name}`;
        const textarea = document.getElementById('file-editor-textarea');
        textarea.value = data.content || '';
        document.getElementById('file-editor-modal').classList.add('active');
        
        // Store path for saving
        textarea.dataset.path = path;
        
        // Update line numbers
        updateLineNumbers();
        
        // Update line numbers on scroll and input
        textarea.addEventListener('scroll', syncScroll);
        textarea.addEventListener('input', updateLineNumbers);
    } catch (error) {
        console.error('Error loading file for editing:', error);
        await customAlert('Failed to load file');
    }
}

function updateLineNumbers() {
    const textarea = document.getElementById('file-editor-textarea');
    const lineNumbers = document.getElementById('file-editor-line-numbers');
    const lines = textarea.value.split('\n').length;
    
    let html = '';
    for (let i = 1; i <= lines; i++) {
        html += `<div>${i}</div>`;
    }
    lineNumbers.innerHTML = html;
    
    // Sync scroll position
    syncScroll();
}

function syncScroll() {
    const textarea = document.getElementById('file-editor-textarea');
    const lineNumbers = document.getElementById('file-editor-line-numbers');
    lineNumbers.scrollTop = textarea.scrollTop;
}

async function saveFileFromEditor() {
    const textarea = document.getElementById('file-editor-textarea');
    const path = textarea.dataset.path;
    const content = textarea.value;
    
    try {
        const data = await API.post(`/files/content?path=${encodeURIComponent(path)}`, {
            content: content,
            is_base64: false
        });
        
        if (data.error) {
            await customAlert('Error saving file: ' + data.error);
            return;
        }
        
        addToChangeLog(`Edit /${path}`);
        await customAlert('File saved successfully');
        document.getElementById('file-editor-modal').classList.remove('active');
        await loadFiles(currentPath);
    } catch (error) {
        console.error('Error saving file:', error);
        await customAlert('Failed to save file');
    }
}

async function deleteFileOrFolder(path, name, isDirectory) {
    const type = isDirectory ? 'folder' : 'file';
    
    if (isDirectory) {
        // For directories, require typing the folder name
        const confirmName = await customPrompt(`To delete this folder, please type its name to confirm: "${name}"`, '');
        
        if (confirmName !== name) {
            if (confirmName !== null) {
                await customAlert('Folder name did not match. Deletion cancelled.');
            }
            return;
        }
    } else {
        // For files, simple confirmation
        const confirmed = await customConfirm(`Are you sure you want to delete this ${type}? ${name}`);
        
        if (!confirmed) return;
    }
    
    try {
        const data = await API.delete(`/files?path=${encodeURIComponent(path)}`);
        
        if (data.error) {
            await customAlert('Error deleting ' + type + ': ' + data.error);
            return;
        }
        
        addToChangeLog(`Delete /${path}`);
        await loadFiles(currentPath);
    } catch (error) {
        console.error('Error deleting ' + type + ':', error);
        await customAlert('Failed to delete ' + type);
    }
}

async function renameFileOrFolder(path, oldName) {
    const newName = await customPrompt('Enter new name:', oldName);
    
    if (!newName || newName === oldName) return;
    
    try {
        const data = await API.post(`/files?path=${encodeURIComponent(path)}`, {
            action: 'rename',
            newName: newName
        });
        
        if (data.error) {
            await customAlert('Error renaming: ' + data.error);
            return;
        }
        
        addToChangeLog(`Rename /${path} to ${newName}`);
        await loadFiles(currentPath);
    } catch (error) {
        console.error('Error renaming:', error);
        await customAlert('Failed to rename');
    }
}

async function createFolder() {
    const folderName = await customPrompt('Enter folder name:', '');
    
    if (!folderName) return;
    
    const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    
    try {
        const data = await API.post(`/files?path=${encodeURIComponent(folderPath)}`, {
            action: 'mkdir'
        });
        
        if (data.error) {
            await customAlert('Error creating folder: ' + data.error);
            return;
        }
        
        addToChangeLog(`Create folder /${folderPath}`);
        await loadFiles(currentPath);
    } catch (error) {
        console.error('Error creating folder:', error);
        await customAlert('Failed to create folder');
    }
}

async function uploadFiles(files) {
    for (const file of files) {
        try {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                const content = e.target.result.split(',')[1]; // Get base64 content
                const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
                
                try {
                    const data = await API.post(`/files/content?path=${encodeURIComponent(filePath)}`, {
                        content: content,
                        is_base64: true
                    });
                    
                    if (data.error) {
                        await customAlert(`Error uploading ${file.name}: ${data.error}`);
                    } else {
                        addToChangeLog(`Upload /${filePath}`);
                    }
                } catch (error) {
                    console.error('Error uploading file:', error);
                    await customAlert(`Failed to upload ${file.name}`);
                }
            };
            
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error reading file:', error);
        }
    }
    
    // Refresh after a short delay to allow uploads to complete
    setTimeout(() => loadFiles(currentPath), 1000);
}

function openImageViewer(path) {
    const img = document.getElementById('image-viewer-img');
    img.src = `/api/files/download?path=${encodeURIComponent(path)}`;
    document.getElementById('image-viewer-modal').classList.add('active');
    addToChangeLog(`View image /${path}`);
}

function showChangeLog() {
    const output = document.getElementById('changelog-output');
    output.innerHTML = '<div class="changelog-line">Loading...</div>';
    
    // Fetch from backend
    API.get('/files/changelog').then(data => {
        output.innerHTML = '';
        
        const entries = data.entries || [];
        if (entries.length === 0) {
            output.innerHTML = '<div class="changelog-line">No actions recorded yet</div>';
        } else {
            entries.forEach(entry => {
                const lineDiv = document.createElement('div');
                lineDiv.className = 'changelog-line';
                lineDiv.textContent = entry;
                output.appendChild(lineDiv);
            });
        }
    }).catch(error => {
        console.error('Error loading changelog:', error);
        output.innerHTML = '<div class="changelog-line">Failed to load changelog</div>';
    });
    
    document.getElementById('changelog-modal').classList.add('active');
}

function showContextMenu(event, row) {
    const menu = document.getElementById('file-context-menu');
    contextMenuTarget = row;
    
    const isDirectory = row.dataset.isDirectory === 'true';
    const isEditable = row.dataset.editable === 'true';
    const fileName = row.dataset.name;
    const isImage = /\.(webp|jpg|jpeg|png)$/i.test(fileName);
    
    // Show/hide edit option
    const editOption = document.getElementById('context-edit');
    if (isDirectory || !isEditable) {
        editOption.style.display = 'none';
    } else {
        editOption.style.display = 'block';
    }
    
    // Show/hide open picture option
    const openPictureOption = document.getElementById('context-open-picture');
    if (isDirectory || !isImage) {
        openPictureOption.style.display = 'none';
    } else {
        openPictureOption.style.display = 'block';
    }
    
    // Show/hide download option
    const downloadOption = document.getElementById('context-download');
    if (isDirectory) {
        downloadOption.style.display = 'none';
    } else {
        downloadOption.style.display = 'block';
    }
    
    menu.style.display = 'block';
    
    // Position the menu at the click location
    // Adjust if it would go off screen
    const menuWidth = 150;
    const menuHeight = 200; // approximate
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let x = event.clientX;
    let y = event.clientY;
    
    if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 10;
    }
    
    if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 10;
    }
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

function hideContextMenu() {
    document.getElementById('file-context-menu').style.display = 'none';
    contextMenuTarget = null;
}

function initFileManagerEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('file-refresh-btn');
    if (refreshBtn && !refreshBtn.dataset.listenerAdded) {
        refreshBtn.addEventListener('click', () => loadFiles(currentPath));
        refreshBtn.dataset.listenerAdded = 'true';
    }
    
    // Change-Log button
    const changelogBtn = document.getElementById('file-changelog-btn');
    if (changelogBtn && !changelogBtn.dataset.listenerAdded) {
        changelogBtn.addEventListener('click', showChangeLog);
        changelogBtn.dataset.listenerAdded = 'true';
    }
    
    // Create folder button
    const createFolderBtn = document.getElementById('create-folder-btn');
    if (createFolderBtn && !createFolderBtn.dataset.listenerAdded) {
        createFolderBtn.addEventListener('click', createFolder);
        createFolderBtn.dataset.listenerAdded = 'true';
    }
    
    // Upload file button
    const uploadBtn = document.getElementById('upload-file-btn');
    const uploadInput = document.getElementById('file-upload-input');
    if (uploadBtn && !uploadBtn.dataset.listenerAdded) {
        uploadBtn.addEventListener('click', () => uploadInput.click());
        uploadBtn.dataset.listenerAdded = 'true';
    }
    
    if (uploadInput && !uploadInput.dataset.listenerAdded) {
        uploadInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                uploadFiles(Array.from(e.target.files));
                e.target.value = ''; // Reset input
            }
        });
        uploadInput.dataset.listenerAdded = 'true';
    }
    
    // Search
    const searchInput = document.getElementById('file-search');
    if (searchInput && !searchInput.dataset.listenerAdded) {
        searchInput.addEventListener('input', (e) => {
            currentFileSearch = e.target.value.toLowerCase().trim();
            renderFiles();
        });
        searchInput.dataset.listenerAdded = 'true';
    }
    
    // Sort
    const sortSelect = document.getElementById('file-sort');
    if (sortSelect && !sortSelect.dataset.listenerAdded) {
        sortSelect.addEventListener('change', (e) => {
            currentSortBy = e.target.value;
            renderFiles();
        });
        sortSelect.dataset.listenerAdded = 'true';
    }
    
    // File editor close
    const editorClose = document.getElementById('file-editor-close');
    if (editorClose && !editorClose.dataset.listenerAdded) {
        editorClose.addEventListener('click', () => {
            document.getElementById('file-editor-modal').classList.remove('active');
        });
        editorClose.dataset.listenerAdded = 'true';
    }
    
    // File editor save
    const editorSave = document.getElementById('file-editor-save');
    if (editorSave && !editorSave.dataset.listenerAdded) {
        editorSave.addEventListener('click', saveFileFromEditor);
        editorSave.dataset.listenerAdded = 'true';
    }
    
    // File editor cancel
    const editorCancel = document.getElementById('file-editor-cancel');
    if (editorCancel && !editorCancel.dataset.listenerAdded) {
        editorCancel.addEventListener('click', () => {
            document.getElementById('file-editor-modal').classList.remove('active');
        });
        editorCancel.dataset.listenerAdded = 'true';
    }
    
    // Context menu actions
    const contextDownload = document.getElementById('context-download');
    if (contextDownload && !contextDownload.dataset.listenerAdded) {
        contextDownload.addEventListener('click', () => {
            if (contextMenuTarget) {
                downloadFile(contextMenuTarget.dataset.path);
                hideContextMenu();
            }
        });
        contextDownload.dataset.listenerAdded = 'true';
    }
    
    const contextEdit = document.getElementById('context-edit');
    if (contextEdit && !contextEdit.dataset.listenerAdded) {
        contextEdit.addEventListener('click', () => {
            if (contextMenuTarget) {
                openFileEditor(contextMenuTarget.dataset.path, contextMenuTarget.dataset.name);
                hideContextMenu();
            }
        });
        contextEdit.dataset.listenerAdded = 'true';
    }
    
    const contextOpenPicture = document.getElementById('context-open-picture');
    if (contextOpenPicture && !contextOpenPicture.dataset.listenerAdded) {
        contextOpenPicture.addEventListener('click', () => {
            if (contextMenuTarget) {
                openImageViewer(contextMenuTarget.dataset.path);
                hideContextMenu();
            }
        });
        contextOpenPicture.dataset.listenerAdded = 'true';
    }
    
    const contextRename = document.getElementById('context-rename');
    if (contextRename && !contextRename.dataset.listenerAdded) {
        contextRename.addEventListener('click', () => {
            if (contextMenuTarget) {
                renameFileOrFolder(contextMenuTarget.dataset.path, contextMenuTarget.dataset.name);
                hideContextMenu();
            }
        });
        contextRename.dataset.listenerAdded = 'true';
    }
    
    const contextDelete = document.getElementById('context-delete');
    if (contextDelete && !contextDelete.dataset.listenerAdded) {
        contextDelete.addEventListener('click', () => {
            if (contextMenuTarget) {
                const isDirectory = contextMenuTarget.dataset.isDirectory === 'true';
                deleteFileOrFolder(contextMenuTarget.dataset.path, contextMenuTarget.dataset.name, isDirectory);
                hideContextMenu();
            }
        });
        contextDelete.dataset.listenerAdded = 'true';
    }
    
    // Hide context menu on click elsewhere
    document.addEventListener('click', () => {
        hideContextMenu();
    });
    
    // Image viewer close
    const imageViewerClose = document.getElementById('image-viewer-close');
    if (imageViewerClose && !imageViewerClose.dataset.listenerAdded) {
        imageViewerClose.addEventListener('click', () => {
            document.getElementById('image-viewer-modal').classList.remove('active');
        });
        imageViewerClose.dataset.listenerAdded = 'true';
    }
    
    // Changelog close
    const changelogClose = document.getElementById('changelog-close');
    if (changelogClose && !changelogClose.dataset.listenerAdded) {
        changelogClose.addEventListener('click', () => {
            document.getElementById('changelog-modal').classList.remove('active');
        });
        changelogClose.dataset.listenerAdded = 'true';
    }
    
    // Drag and drop
    const dropOverlay = document.getElementById('file-drop-overlay');
    const fileManagerPage = document.getElementById('file-manager-page');
    
    if (fileManagerPage && !fileManagerPage.dataset.dragListenerAdded) {
        fileManagerPage.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropOverlay.style.display = 'flex';
        });
        
        fileManagerPage.addEventListener('dragleave', (e) => {
            if (e.target === fileManagerPage) {
                dropOverlay.style.display = 'none';
            }
        });
        
        fileManagerPage.addEventListener('drop', (e) => {
            e.preventDefault();
            dropOverlay.style.display = 'none';
            
            if (e.dataTransfer.files.length > 0) {
                uploadFiles(Array.from(e.dataTransfer.files));
            }
        });
        
        fileManagerPage.dataset.dragListenerAdded = 'true';
    }
}

// Initialize
loadPage('status');
startOfflineCheck();
