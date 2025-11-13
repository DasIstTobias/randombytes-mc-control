use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use std::{net::SocketAddr, sync::Arc};
use tokio::sync::RwLock;
use tower_http::services::ServeDir;
use tracing::{error, info};

mod config;
mod plugin_client;

use config::Config;
use plugin_client::PluginClient;

#[derive(Clone)]
struct AppState {
    plugin_client: Arc<RwLock<PluginClient>>,
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    info!("Starting RandomBytes MC Control Backend...");

    // Load configuration
    let config = match Config::load("backend.config") {
        Ok(cfg) => cfg,
        Err(e) => {
            error!("Failed to load configuration: {}", e);
            error!("Please create backend.config with plugin_host, plugin_port, and api_key");
            std::process::exit(1);
        }
    };

    info!("Loaded configuration:");
    info!("  Plugin host: {}", config.plugin_host);
    info!("  Plugin port: {}", config.plugin_port);
    info!("  Backend port: {}", config.backend_port);

    // Initialize plugin client
    let plugin_client = match PluginClient::new(
        &config.plugin_host,
        config.plugin_port,
        &config.api_key,
    )
    .await
    {
        Ok(client) => {
            info!("Successfully connected to plugin");
            Arc::new(RwLock::new(client))
        }
        Err(e) => {
            error!("Failed to connect to plugin: {}", e);
            error!("Make sure the Minecraft server and plugin are running");
            std::process::exit(1);
        }
    };

    let state = AppState { plugin_client };

    // Build application with routes
    let app = Router::new()
        // API routes
        .route("/api/metrics", get(get_metrics))
        .route("/api/players", get(get_players))
        .route("/api/player/:uuid", get(get_player))
        .route("/api/player/:uuid/action", post(player_action))
        .route("/api/whitelist", get(get_whitelist))
        .route("/api/whitelist/add", post(add_to_whitelist))
        .route("/api/blacklist", get(get_blacklist))
        .route("/api/blacklist/add", post(add_to_blacklist))
        .route("/api/plugins", get(get_plugins))
        .route("/api/server", get(get_server_info))
        .route("/api/console", get(get_console))
        .route("/api/command", post(execute_command))
        // Serve frontend
        .nest_service("/", ServeDir::new("frontend"))
        .with_state(state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.backend_port));
    info!("Backend server listening on http://{}", addr);
    info!("Open your browser to http://localhost:{}", config.backend_port);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// API handlers

async fn get_metrics(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_metrics().await {
        Ok(metrics) => Ok(Json(metrics)),
        Err(e) => {
            error!("Failed to get metrics: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn get_players(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_players().await {
        Ok(players) => Ok(Json(players)),
        Err(e) => {
            error!("Failed to get players: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn get_player(
    State(state): State<AppState>,
    axum::extract::Path(uuid): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_player(&uuid).await {
        Ok(player) => Ok(Json(player)),
        Err(e) => {
            error!("Failed to get player: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

#[derive(Deserialize)]
struct PlayerAction {
    action: String,
}

async fn player_action(
    State(state): State<AppState>,
    axum::extract::Path(uuid): axum::extract::Path<String>,
    Json(payload): Json<PlayerAction>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.player_action(&uuid, &payload.action).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to perform player action: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn get_whitelist(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_whitelist().await {
        Ok(whitelist) => Ok(Json(whitelist)),
        Err(e) => {
            error!("Failed to get whitelist: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

#[derive(Deserialize)]
struct AddToList {
    name: String,
    uuid: String,
}

async fn add_to_whitelist(
    State(state): State<AppState>,
    Json(payload): Json<AddToList>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.add_to_whitelist(&payload.name, &payload.uuid).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to add to whitelist: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn get_blacklist(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_blacklist().await {
        Ok(blacklist) => Ok(Json(blacklist)),
        Err(e) => {
            error!("Failed to get blacklist: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn add_to_blacklist(
    State(state): State<AppState>,
    Json(payload): Json<AddToList>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.add_to_blacklist(&payload.name, &payload.uuid).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to add to blacklist: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn get_plugins(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_plugins().await {
        Ok(plugins) => Ok(Json(plugins)),
        Err(e) => {
            error!("Failed to get plugins: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn get_server_info(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_server_info().await {
        Ok(info) => Ok(Json(info)),
        Err(e) => {
            error!("Failed to get server info: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn get_console(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_console().await {
        Ok(logs) => Ok(Json(logs)),
        Err(e) => {
            error!("Failed to get console: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

#[derive(Deserialize)]
struct ExecuteCommand {
    command: String,
}

async fn execute_command(
    State(state): State<AppState>,
    Json(payload): Json<ExecuteCommand>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.execute_command(&payload.command).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to execute command: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

// Error handling

enum ApiError {
    PluginError(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match self {
            ApiError::PluginError(msg) => (StatusCode::BAD_GATEWAY, msg),
        };

        let body = serde_json::json!({
            "error": message
        });

        (status, Json(body)).into_response()
    }
}
