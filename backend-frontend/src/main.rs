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
    config: Arc<Config>,
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

    let state = AppState { 
        plugin_client,
        config: Arc::new(config),
    };

    // Build application with routes
    let app = Router::new()
        // API routes
        .route("/api/metrics", get(get_metrics))
        .route("/api/players", get(get_players))
        .route("/api/player/:uuid", get(get_player))
        .route("/api/player/:uuid/action", post(player_action))
        .route("/api/whitelist", get(get_whitelist))
        .route("/api/whitelist/add", post(add_to_whitelist))
        .route("/api/whitelist/remove", axum::routing::delete(remove_from_whitelist))
        .route("/api/blacklist", get(get_blacklist))
        .route("/api/blacklist/add", post(add_to_blacklist))
        .route("/api/blacklist/remove", axum::routing::delete(remove_from_blacklist))
        .route("/api/ops", get(get_ops))
        .route("/api/ops/add", post(add_to_ops))
        .route("/api/ops/remove", axum::routing::delete(remove_from_ops))
        .route("/api/plugins", get(get_plugins))
        .route("/api/server", get(get_server_info))
        .route("/api/server-icon", get(get_server_icon))
        .route("/api/geysermc", get(get_geysermc))
        .route("/api/console", get(get_console))
        .route("/api/command", post(execute_command))
        .route("/api/chat", get(get_chat))
        .route("/api/chat", post(send_chat))
        .route("/api/settings", get(get_settings))
        .route("/api/settings/properties", post(update_properties))
        .route("/api/settings/gamerules", post(update_gamerules))
        .route("/api/restart", post(restart_server))
        .route("/api/uuid-lookup", get(uuid_lookup))
        .route("/api/player-head/:uuid", get(get_player_head))
        // Custom recipes endpoints
        .route("/api/recipes", get(get_recipes))
        .route("/api/recipes", post(create_recipe))
        .route("/api/recipe/:id", get(get_recipe))
        .route("/api/recipe/:id", post(update_recipe))
        .route("/api/recipe/:id", axum::routing::delete(delete_recipe))
        // Logs endpoint
        .route("/api/logs", get(get_logs))
        // File manager endpoints
        .route("/api/files", get(list_files))
        .route("/api/files/content", get(read_file_content))
        .route("/api/files/content", post(write_file_content))
        .route("/api/files", post(file_action))
        .route("/api/files", axum::routing::delete(delete_file))
        .route("/api/files/download", get(download_file))
        .route("/api/files/changelog", get(get_file_changelog))
        // Serve frontend
        .nest_service("/", ServeDir::new("frontend"))
        .with_state(state.clone());

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], state.config.backend_port));
    info!("Backend server listening on http://{}", addr);
    info!("Open your browser to http://localhost:{}", state.config.backend_port);

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
        Ok(mut info) => {
            // Override the IP with the actual server address from config
            if let Some(obj) = info.as_object_mut() {
                obj.insert("ip".to_string(), serde_json::Value::String(state.config.plugin_host.clone()));
            }
            Ok(Json(info))
        }
        Err(e) => {
            error!("Failed to get server info: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn get_geysermc(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_geysermc().await {
        Ok(info) => Ok(Json(info)),
        Err(e) => {
            error!("Failed to get GeyserMC info: {}", e);
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

#[derive(Deserialize)]
struct RemoveQuery {
    uuid: String,
}

async fn remove_from_whitelist(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<RemoveQuery>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.remove_from_whitelist(&query.uuid).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to remove from whitelist: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn remove_from_blacklist(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<RemoveQuery>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.remove_from_blacklist(&query.uuid).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to remove from blacklist: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn get_ops(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_ops().await {
        Ok(ops) => Ok(Json(ops)),
        Err(e) => {
            error!("Failed to get ops: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn add_to_ops(
    State(state): State<AppState>,
    Json(payload): Json<AddToList>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.add_to_ops(&payload.name, &payload.uuid).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to add to ops: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn remove_from_ops(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<RemoveQuery>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.remove_from_ops(&query.uuid).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to remove from ops: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn get_chat(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_chat().await {
        Ok(logs) => Ok(Json(logs)),
        Err(e) => {
            error!("Failed to get chat: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

#[derive(Deserialize)]
struct ChatMessage {
    message: String,
}

async fn send_chat(
    State(state): State<AppState>,
    Json(payload): Json<ChatMessage>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.send_chat(&payload.message).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to send chat: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn get_settings(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_settings().await {
        Ok(settings) => Ok(Json(settings)),
        Err(e) => {
            error!("Failed to get settings: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

#[derive(Deserialize)]
struct UpdateProperties {
    properties: serde_json::Value,
}

async fn update_properties(
    State(state): State<AppState>,
    Json(payload): Json<UpdateProperties>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.update_properties(payload.properties).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to update properties: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

#[derive(Deserialize)]
struct UpdateGamerules {
    gamerules: serde_json::Value,
}

async fn update_gamerules(
    State(state): State<AppState>,
    Json(payload): Json<UpdateGamerules>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.update_gamerules(payload.gamerules).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to update gamerules: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn restart_server(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.restart_server().await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to restart server: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

#[derive(Deserialize)]
struct UuidLookupQuery {
    username: String,
}

async fn uuid_lookup(
    axum::extract::Query(query): axum::extract::Query<UuidLookupQuery>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Fetch UUID from Mojang API
    let url = format!("https://api.mojang.com/users/profiles/minecraft/{}", query.username);
    
    // Create a client that accepts invalid certificates (for self-signed certs in cert chain)
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| {
            error!("Failed to build HTTP client: {}", e);
            ApiError::PluginError("Failed to create HTTP client".to_string())
        })?;
    
    match client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(data) => {
                        if let Some(id) = data.get("id").and_then(|v| v.as_str()) {
                            // Format UUID with dashes
                            let formatted_uuid = format!(
                                "{}-{}-{}-{}-{}",
                                &id[0..8],
                                &id[8..12],
                                &id[12..16],
                                &id[16..20],
                                &id[20..32]
                            );
                            Ok(Json(serde_json::json!({
                                "uuid": formatted_uuid,
                                "name": data.get("name")
                            })))
                        } else {
                            Err(ApiError::PluginError("Player not found".to_string()))
                        }
                    }
                    Err(e) => {
                        error!("Failed to parse Mojang API response: {}", e);
                        Err(ApiError::PluginError("Failed to parse response".to_string()))
                    }
                }
            } else {
                Err(ApiError::PluginError("Player not found".to_string()))
            }
        }
        Err(e) => {
            error!("Failed to fetch UUID from Mojang API: {}", e);
            Err(ApiError::PluginError("Failed to fetch UUID".to_string()))
        }
    }
}

async fn get_player_head(
    axum::extract::Path(uuid): axum::extract::Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    // Remove dashes from UUID
    let uuid_no_dashes = uuid.replace("-", "");
    
    // Fetch player head from Crafatar API
    let url = format!("https://crafatar.com/avatars/{}?size=24&overlay", uuid_no_dashes);
    
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| {
            error!("Failed to build HTTP client: {}", e);
            ApiError::PluginError("Failed to create HTTP client".to_string())
        })?;
    
    match client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.bytes().await {
                    Ok(bytes) => {
                        // Return image with proper content type
                        Ok((
                            StatusCode::OK,
                            [(axum::http::header::CONTENT_TYPE, "image/png")],
                            bytes
                        ))
                    }
                    Err(e) => {
                        error!("Failed to read player head image: {}", e);
                        Err(ApiError::PluginError("Failed to read image".to_string()))
                    }
                }
            } else {
                Err(ApiError::PluginError("Player head not found".to_string()))
            }
        }
        Err(e) => {
            error!("Failed to fetch player head from Crafatar: {}", e);
            Err(ApiError::PluginError("Failed to fetch player head".to_string()))
        }
    }
}

async fn get_server_icon(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let client = state.plugin_client.read().await;
    
    match client.get_server_icon().await {
        Ok(response) => {
            if let Some(icon_data) = response.get("icon") {
                if let Some(icon_str) = icon_data.as_str() {
                    // Icon data is base64 encoded PNG
                    use base64::Engine;
                    if let Ok(icon_bytes) = base64::engine::general_purpose::STANDARD.decode(icon_str) {
                        return Ok((
                            StatusCode::OK,
                            [(axum::http::header::CONTENT_TYPE, "image/png")],
                            icon_bytes
                        ));
                    }
                }
            }
            // Return 404 if no icon available
            Err(ApiError::PluginError("Server icon not available".to_string()))
        }
        Err(e) => {
            error!("Failed to fetch server icon: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

// Custom Recipes handlers

async fn get_recipes(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_recipes().await {
        Ok(recipes) => Ok(Json(recipes)),
        Err(e) => {
            error!("Failed to get recipes: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn create_recipe(
    State(state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.create_recipe(payload).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to create recipe: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn get_recipe(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_recipe(&id).await {
        Ok(recipe) => Ok(Json(recipe)),
        Err(e) => {
            error!("Failed to get recipe: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn update_recipe(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.update_recipe(&id, payload).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to update recipe: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn delete_recipe(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.delete_recipe(&id).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to delete recipe: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn get_logs(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    match client.get_logs().await {
        Ok(logs) => Ok(Json(logs)),
        Err(e) => {
            error!("Failed to get logs: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

// File manager handlers

#[derive(Deserialize)]
struct FileQuery {
    path: Option<String>,
}

async fn list_files(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<FileQuery>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    let path = query.path.unwrap_or_default();
    match client.list_files(&path).await {
        Ok(files) => Ok(Json(files)),
        Err(e) => {
            error!("Failed to list files: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn read_file_content(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<FileQuery>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    let path = query.path.unwrap_or_default();
    match client.read_file(&path).await {
        Ok(content) => Ok(Json(content)),
        Err(e) => {
            error!("Failed to read file: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

#[derive(Deserialize)]
struct WriteFileRequest {
    content: String,
    #[serde(default)]
    is_base64: bool,
}

async fn write_file_content(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<FileQuery>,
    Json(payload): Json<WriteFileRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    let path = query.path.unwrap_or_default();
    match client.write_file(&path, &payload.content, payload.is_base64).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to write file: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

#[derive(Deserialize)]
struct FileActionRequest {
    action: String,
    #[serde(rename = "newName")]
    new_name: Option<String>,
}

async fn file_action(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<FileQuery>,
    Json(payload): Json<FileActionRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    let path = query.path.unwrap_or_default();
    
    match payload.action.as_str() {
        "rename" => {
            let new_name = payload.new_name.ok_or_else(|| ApiError::PluginError("newName required for rename action".to_string()))?;
            match client.rename_file(&path, &new_name).await {
                Ok(result) => Ok(Json(result)),
                Err(e) => {
                    error!("Failed to rename file: {}", e);
                    Err(ApiError::PluginError(e.to_string()))
                }
            }
        },
        "mkdir" => {
            match client.create_directory(&path).await {
                Ok(result) => Ok(Json(result)),
                Err(e) => {
                    error!("Failed to create directory: {}", e);
                    Err(ApiError::PluginError(e.to_string()))
                }
            }
        },
        _ => Err(ApiError::PluginError(format!("Unknown action: {}", payload.action)))
    }
}

async fn delete_file(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<FileQuery>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = state.plugin_client.read().await;
    let path = query.path.unwrap_or_default();
    match client.delete_file(&path).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Failed to delete file: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn download_file(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<FileQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let client = state.plugin_client.read().await;
    let path = query.path.unwrap_or_default();
    
    match client.read_file(&path).await {
        Ok(file_data) => {
            // Check for errors
            if file_data.get("error").is_some() {
                return Err(ApiError::PluginError(
                    file_data.get("error")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Failed to read file")
                        .to_string()
                ));
            }
            
            // Get file content
            let content = file_data.get("content")
                .and_then(|v| v.as_str())
                .ok_or_else(|| ApiError::PluginError("No content in response".to_string()))?;
            
            let is_base64 = file_data.get("encoding")
                .and_then(|v| v.as_str())
                .map(|s| s == "base64")
                .unwrap_or(false);
            
            // Decode content
            let bytes = if is_base64 {
                use base64::Engine;
                base64::engine::general_purpose::STANDARD.decode(content)
                    .map_err(|e| ApiError::PluginError(format!("Failed to decode base64: {}", e)))?
            } else {
                content.as_bytes().to_vec()
            };
            
            // Determine filename from path
            let filename = path.split('/').last().unwrap_or("download").to_string();
            
            // Determine content type
            let content_type = if filename.ends_with(".txt") {
                "text/plain"
            } else if filename.ends_with(".json") {
                "application/json"
            } else if filename.ends_with(".yml") || filename.ends_with(".yaml") {
                "text/yaml"
            } else if filename.ends_with(".properties") {
                "text/plain"
            } else if filename.ends_with(".jar") {
                "application/java-archive"
            } else if filename.ends_with(".log") {
                "text/plain"
            } else {
                "application/octet-stream"
            };
            
            let content_disposition = format!("attachment; filename=\"{}\"", filename);
            
            Ok((
                StatusCode::OK,
                [
                    (axum::http::header::CONTENT_TYPE, content_type.to_string()),
                    (axum::http::header::CONTENT_DISPOSITION, content_disposition)
                ],
                bytes
            ))
        },
        Err(e) => {
            error!("Failed to download file: {}", e);
            Err(ApiError::PluginError(e.to_string()))
        }
    }
}

async fn get_file_changelog(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, &'static str)> {
    let client = state.plugin_client.read().await;
    
    match client.get_file_changelog().await {
        Ok(data) => Ok(Json(data)),
        Err(_) => Err((StatusCode::INTERNAL_SERVER_ERROR, "Failed to get changelog"))
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
