use reqwest::Client;
use serde_json::Value;
use std::error::Error;

pub struct PluginClient {
    client: Client,
    base_url: String,
    api_key: String,
}

impl PluginClient {
    pub async fn new(
        host: &str,
        port: u16,
        api_key: &str,
    ) -> Result<Self, Box<dyn Error>> {
        let base_url = format!("http://{}:{}/api", host, port);
        let client = Client::new();

        // Test connection with handshake
        let handshake_url = format!("{}/handshake", base_url);
        let response = client.get(&handshake_url).send().await?;

        if !response.status().is_success() {
            return Err("Failed to connect to plugin".into());
        }

        Ok(PluginClient {
            client,
            base_url,
            api_key: api_key.to_string(),
        })
    }

    async fn get(&self, endpoint: &str) -> Result<Value, Box<dyn Error>> {
        let url = format!("{}{}", self.base_url, endpoint);
        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Request failed: {}", response.status()).into());
        }

        Ok(response.json().await?)
    }

    async fn post(&self, endpoint: &str, body: Value) -> Result<Value, Box<dyn Error>> {
        let url = format!("{}{}", self.base_url, endpoint);
        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Request failed: {}", response.status()).into());
        }

        Ok(response.json().await?)
    }

    pub async fn get_metrics(&self) -> Result<Value, Box<dyn Error>> {
        self.get("/metrics").await
    }

    pub async fn get_players(&self) -> Result<Value, Box<dyn Error>> {
        self.get("/players").await
    }

    pub async fn get_player(&self, uuid: &str) -> Result<Value, Box<dyn Error>> {
        self.get(&format!("/player?uuid={}", uuid)).await
    }

    pub async fn player_action(&self, uuid: &str, action: &str) -> Result<Value, Box<dyn Error>> {
        let body = serde_json::json!({
            "action": action
        });
        self.post(&format!("/player?uuid={}", uuid), body).await
    }

    pub async fn get_whitelist(&self) -> Result<Value, Box<dyn Error>> {
        self.get("/whitelist").await
    }

    pub async fn add_to_whitelist(&self, name: &str, uuid: &str) -> Result<Value, Box<dyn Error>> {
        let body = serde_json::json!({
            "name": name,
            "uuid": uuid
        });
        self.post("/whitelist", body).await
    }

    pub async fn get_blacklist(&self) -> Result<Value, Box<dyn Error>> {
        self.get("/blacklist").await
    }

    pub async fn add_to_blacklist(&self, name: &str, uuid: &str) -> Result<Value, Box<dyn Error>> {
        let body = serde_json::json!({
            "name": name,
            "uuid": uuid
        });
        self.post("/blacklist", body).await
    }

    pub async fn get_plugins(&self) -> Result<Value, Box<dyn Error>> {
        self.get("/plugins").await
    }

    pub async fn get_server_info(&self) -> Result<Value, Box<dyn Error>> {
        self.get("/server").await
    }

    pub async fn get_console(&self) -> Result<Value, Box<dyn Error>> {
        self.get("/console").await
    }

    pub async fn execute_command(&self, command: &str) -> Result<Value, Box<dyn Error>> {
        let body = serde_json::json!({
            "command": command
        });
        self.post("/command", body).await
    }

    pub async fn remove_from_whitelist(&self, uuid: &str) -> Result<Value, Box<dyn Error>> {
        let endpoint = format!("/whitelist?uuid={}", uuid);
        let url = format!("{}{}", self.base_url, endpoint);
        let response = self
            .client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Request failed: {}", response.status()).into());
        }

        Ok(response.json().await?)
    }

    pub async fn remove_from_blacklist(&self, uuid: &str) -> Result<Value, Box<dyn Error>> {
        let endpoint = format!("/blacklist?uuid={}", uuid);
        let url = format!("{}{}", self.base_url, endpoint);
        let response = self
            .client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Request failed: {}", response.status()).into());
        }

        Ok(response.json().await?)
    }

    pub async fn get_ops(&self) -> Result<Value, Box<dyn Error>> {
        self.get("/ops").await
    }

    pub async fn add_to_ops(&self, name: &str, uuid: &str) -> Result<Value, Box<dyn Error>> {
        let body = serde_json::json!({
            "name": name,
            "uuid": uuid
        });
        self.post("/ops", body).await
    }

    pub async fn remove_from_ops(&self, uuid: &str) -> Result<Value, Box<dyn Error>> {
        let endpoint = format!("/ops?uuid={}", uuid);
        let url = format!("{}{}", self.base_url, endpoint);
        let response = self
            .client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Request failed: {}", response.status()).into());
        }

        Ok(response.json().await?)
    }

    pub async fn get_chat(&self) -> Result<Value, Box<dyn Error>> {
        self.get("/chat").await
    }

    pub async fn send_chat(&self, message: &str) -> Result<Value, Box<dyn Error>> {
        let body = serde_json::json!({
            "message": message
        });
        self.post("/chat", body).await
    }

    pub async fn get_settings(&self) -> Result<Value, Box<dyn Error>> {
        self.get("/settings").await
    }

    pub async fn update_properties(&self, properties: Value) -> Result<Value, Box<dyn Error>> {
        let body = serde_json::json!({
            "properties": properties
        });
        self.post("/settings/properties", body).await
    }

    pub async fn update_gamerules(&self, gamerules: Value) -> Result<Value, Box<dyn Error>> {
        let body = serde_json::json!({
            "gamerules": gamerules
        });
        self.post("/settings/gamerules", body).await
    }

    pub async fn restart_server(&self) -> Result<Value, Box<dyn Error>> {
        self.post("/restart", serde_json::json!({})).await
    }
    
    pub async fn get_server_icon(&self) -> Result<Value, Box<dyn Error>> {
        self.get("/server-icon").await
    }
}
