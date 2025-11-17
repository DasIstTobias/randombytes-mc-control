use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{error, info};

use crate::AppState;

// Message types for WebSocket communication
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WsMessage {
    #[serde(rename = "metrics")]
    Metrics { data: serde_json::Value },
    #[serde(rename = "players")]
    Players { data: serde_json::Value },
    #[serde(rename = "server_info")]
    ServerInfo { data: serde_json::Value },
    #[serde(rename = "plugins")]
    Plugins { data: serde_json::Value },
    #[serde(rename = "console")]
    Console { data: serde_json::Value },
    #[serde(rename = "chat")]
    Chat { data: serde_json::Value },
    #[serde(rename = "logs")]
    Logs { data: serde_json::Value },
    #[serde(rename = "whitelist")]
    Whitelist { data: serde_json::Value },
    #[serde(rename = "blacklist")]
    Blacklist { data: serde_json::Value },
    #[serde(rename = "ops")]
    Ops { data: serde_json::Value },
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "pong")]
    Pong,
}

// Broadcaster for sending messages to all connected clients
pub struct Broadcaster {
    tx: broadcast::Sender<String>,
}

impl Broadcaster {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        Self { tx }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<String> {
        self.tx.subscribe()
    }

    pub fn send(&self, message: WsMessage) {
        if let Ok(json) = serde_json::to_string(&message) {
            let _ = self.tx.send(json);
        }
    }
}

// WebSocket handler
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.broadcaster.subscribe();

    info!("WebSocket client connected");

    // Send initial data
    let initial_messages = vec![
        get_initial_metrics(&state).await,
        get_initial_players(&state).await,
        get_initial_server_info(&state).await,
        get_initial_plugins(&state).await,
    ];

    for msg in initial_messages {
        if let Some(m) = msg {
            if let Ok(json) = serde_json::to_string(&m) {
                if sender.send(Message::Text(json)).await.is_err() {
                    return;
                }
            }
        }
    }

    // Task to forward broadcast messages to this client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Task to receive messages from client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    // Handle ping/pong or other client messages if needed
                    if text == "ping" {
                        // Echo pong back
                        continue;
                    }
                }
                Message::Close(_) => {
                    break;
                }
                _ => {}
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    info!("WebSocket client disconnected");
}

// Helper functions to get initial data
async fn get_initial_metrics(state: &AppState) -> Option<WsMessage> {
    let client = state.plugin_client.read().await;
    match client.get_metrics().await {
        Ok(data) => Some(WsMessage::Metrics { data }),
        Err(e) => {
            error!("Failed to get initial metrics: {}", e);
            None
        }
    }
}

async fn get_initial_players(state: &AppState) -> Option<WsMessage> {
    let client = state.plugin_client.read().await;
    match client.get_players().await {
        Ok(data) => Some(WsMessage::Players { data }),
        Err(e) => {
            error!("Failed to get initial players: {}", e);
            None
        }
    }
}

async fn get_initial_server_info(state: &AppState) -> Option<WsMessage> {
    let client = state.plugin_client.read().await;
    match client.get_server_info().await {
        Ok(mut data) => {
            // Override the IP with the actual server address from config
            if let Some(obj) = data.as_object_mut() {
                obj.insert(
                    "ip".to_string(),
                    serde_json::Value::String(state.config.plugin_host.clone()),
                );
            }
            Some(WsMessage::ServerInfo { data })
        }
        Err(e) => {
            error!("Failed to get initial server info: {}", e);
            None
        }
    }
}

async fn get_initial_plugins(state: &AppState) -> Option<WsMessage> {
    let client = state.plugin_client.read().await;
    match client.get_plugins().await {
        Ok(data) => Some(WsMessage::Plugins { data }),
        Err(e) => {
            error!("Failed to get initial plugins: {}", e);
            None
        }
    }
}

// Background task to periodically fetch and broadcast updates
pub async fn broadcast_updates(state: AppState) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(2));
    let mut last_metrics: Option<serde_json::Value> = None;
    let mut last_players: Option<serde_json::Value> = None;
    let mut last_server_info: Option<serde_json::Value> = None;
    let mut last_plugins: Option<serde_json::Value> = None;
    let mut last_console: Option<serde_json::Value> = None;
    let mut last_chat: Option<serde_json::Value> = None;
    let mut last_logs: Option<serde_json::Value> = None;
    let mut last_whitelist: Option<serde_json::Value> = None;
    let mut last_blacklist: Option<serde_json::Value> = None;
    let mut last_ops: Option<serde_json::Value> = None;

    loop {
        interval.tick().await;

        let client = state.plugin_client.read().await;

        // Fetch and broadcast metrics if changed
        if let Ok(data) = client.get_metrics().await {
            if last_metrics.as_ref() != Some(&data) {
                state.broadcaster.send(WsMessage::Metrics { data: data.clone() });
                last_metrics = Some(data);
            }
        }

        // Fetch and broadcast players if changed
        if let Ok(data) = client.get_players().await {
            if last_players.as_ref() != Some(&data) {
                state.broadcaster.send(WsMessage::Players { data: data.clone() });
                last_players = Some(data);
            }
        }

        // Fetch and broadcast server info if changed
        if let Ok(mut data) = client.get_server_info().await {
            // Override the IP with the actual server address from config
            if let Some(obj) = data.as_object_mut() {
                obj.insert(
                    "ip".to_string(),
                    serde_json::Value::String(state.config.plugin_host.clone()),
                );
            }
            if last_server_info.as_ref() != Some(&data) {
                state
                    .broadcaster
                    .send(WsMessage::ServerInfo { data: data.clone() });
                last_server_info = Some(data);
            }
        }

        // Fetch and broadcast plugins if changed
        if let Ok(data) = client.get_plugins().await {
            if last_plugins.as_ref() != Some(&data) {
                state.broadcaster.send(WsMessage::Plugins { data: data.clone() });
                last_plugins = Some(data);
            }
        }

        // Fetch and broadcast console logs if changed
        if let Ok(data) = client.get_console().await {
            if last_console.as_ref() != Some(&data) {
                state.broadcaster.send(WsMessage::Console { data: data.clone() });
                last_console = Some(data);
            }
        }

        // Fetch and broadcast chat if changed
        if let Ok(data) = client.get_chat().await {
            if last_chat.as_ref() != Some(&data) {
                state.broadcaster.send(WsMessage::Chat { data: data.clone() });
                last_chat = Some(data);
            }
        }

        // Fetch and broadcast logs if changed
        if let Ok(data) = client.get_logs().await {
            if last_logs.as_ref() != Some(&data) {
                state.broadcaster.send(WsMessage::Logs { data: data.clone() });
                last_logs = Some(data);
            }
        }

        // Fetch and broadcast whitelist if changed
        if let Ok(data) = client.get_whitelist().await {
            if last_whitelist.as_ref() != Some(&data) {
                state.broadcaster.send(WsMessage::Whitelist { data: data.clone() });
                last_whitelist = Some(data);
            }
        }

        // Fetch and broadcast blacklist if changed
        if let Ok(data) = client.get_blacklist().await {
            if last_blacklist.as_ref() != Some(&data) {
                state.broadcaster.send(WsMessage::Blacklist { data: data.clone() });
                last_blacklist = Some(data);
            }
        }

        // Fetch and broadcast ops if changed
        if let Ok(data) = client.get_ops().await {
            if last_ops.as_ref() != Some(&data) {
                state.broadcaster.send(WsMessage::Ops { data: data.clone() });
                last_ops = Some(data);
            }
        }
    }
}
