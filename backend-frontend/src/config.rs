use serde::Deserialize;
use std::fs;

#[derive(Debug, Deserialize)]
pub struct Config {
    pub plugin_host: String,
    pub plugin_port: u16,
    pub api_key: String,
    #[serde(default = "default_backend_port")]
    pub backend_port: u16,
}

fn default_backend_port() -> u16 {
    8080
}

impl Config {
    pub fn load(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        if !std::path::Path::new(path).exists() {
            return Err(format!("Configuration file not found: {}", path).into());
        }

        let content = fs::read_to_string(path)?;
        let lines: Vec<&str> = content.lines().collect();

        let mut plugin_host = None;
        let mut plugin_port = None;
        let mut api_key = None;
        let mut backend_port = default_backend_port();

        for line in lines {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            if let Some(pos) = line.find('=') {
                let key = line[..pos].trim();
                let value = line[pos + 1..].trim();

                match key {
                    "plugin_host" => plugin_host = Some(value.to_string()),
                    "plugin_port" => {
                        plugin_port = Some(value.parse().map_err(|_| "Invalid plugin_port")?)
                    }
                    "api_key" => api_key = Some(value.to_string()),
                    "backend_port" => {
                        backend_port = value.parse().map_err(|_| "Invalid backend_port")?
                    }
                    _ => {}
                }
            }
        }

        Ok(Config {
            plugin_host: plugin_host.ok_or("Missing plugin_host")?,
            plugin_port: plugin_port.ok_or("Missing plugin_port")?,
            api_key: api_key.ok_or("Missing api_key")?,
            backend_port,
        })
    }
}
