//! Minimal Runtime relay for `@alwith/api/tauri`: Rust spawns `alwith-runtime --listen stdio://`,
//! the webview sends request lines through `runtime_send` and receives every frame through the
//! `runtime:lines` event; `runtime:exit` fires when the process ends.
use alwith_api::{ClientEvent, RuntimeClient, process::HideConsoleExt};
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

const LINES_EVENT: &str = "runtime:lines";
const EXIT_EVENT: &str = "runtime:exit";
const READY_TIMEOUT: Duration = Duration::from_secs(20);
const SHUTDOWN_GRACE: Duration = Duration::from_secs(3);

#[derive(Default)]
pub struct RuntimeState {
    connections: Mutex<HashMap<String, String>>,
    client: Mutex<Option<Arc<RuntimeClient>>>,
    starting: tokio::sync::Mutex<()>,
    /// Last successful ACP `initialize` result per agent. The webview may deliver the same request
    /// twice (Tauri's IPC protocol fallback after a reload re-sends pending invokes) and the adapter
    /// rejects a second handshake, so a repeated initialize is answered from here instead.
    initialized: Mutex<HashMap<String, Value>>,
}

impl RuntimeState {
    fn current(&self) -> Result<Arc<RuntimeClient>, String> {
        let client = self.client.lock().unwrap().clone().ok_or("alwith-runtime is not running")?;
        if let Some(reason) = client.closed() {
            return Err(reason);
        }
        Ok(client)
    }
    fn owns(&self, client: &Arc<RuntimeClient>) -> bool {
        self.client.lock().unwrap().as_ref().is_some_and(|current| Arc::ptr_eq(current, client))
    }
}

pub fn shutdown_blocking(app: &AppHandle) {
    let client = app.state::<RuntimeState>().client.lock().unwrap().take();
    if let Some(client) = client {
        tauri::async_runtime::block_on(client.close(SHUTDOWN_GRACE));
    }
}

fn sidecar_path(name: &str) -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|error| error.to_string())?;
    let directory = exe.parent().ok_or("executable has no parent directory")?;
    let file = if cfg!(windows) { format!("{name}.exe") } else { name.to_string() };
    let path = directory.join(file);
    if !path.is_file() {
        return Err(format!("sidecar {name} missing at {}", path.display()));
    }
    Ok(path)
}

fn resources_dir(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(debug_assertions)]
    {
        let _ = app;
        Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources"))
    }
    #[cfg(not(debug_assertions))]
    {
        app.path().resource_dir().map_err(|error| error.to_string())
    }
}

/// The engines table the Runtime launches agents from: Codex = bundled Bun running the ACP adapter,
/// which spawns the bundled Codex CLI.
fn engines_table(app: &AppHandle) -> Result<String, String> {
    let adapter = resources_dir(app)?.join("adapter/codex-acp-v2.mjs");
    if !adapter.is_file() {
        return Err(format!("ACP adapter missing at {}", adapter.display()));
    }
    Ok(json!({"codex": {
        "command": sidecar_path("bun")?,
        "args": ["--no-install", adapter],
        "env": {"CODEX_PATH": sidecar_path("codex")?}
    }})
    .to_string())
}

#[tauri::command]
pub async fn runtime_start(
    app: AppHandle, window: WebviewWindow, state: State<'_, RuntimeState>, connection_id: String,
) -> Result<(), String> {
    if connection_id.is_empty() {
        return Err("Missing connection identity".into());
    }
    state.connections.lock().unwrap().insert(window.label().into(), connection_id);
    let _starting = state.starting.lock().await;
    if state.current().is_ok() {
        return Ok(());
    }
    let stale = state.client.lock().unwrap().take();
    if let Some(stale) = stale {
        stale.close(SHUTDOWN_GRACE).await;
    }
    let journal = app.path().app_cache_dir().map_err(|error| error.to_string())?.join("runtime/sessions");
    let mut command = tokio::process::Command::new(sidecar_path("alwith-runtime")?);
    command
        .args(["--listen", "stdio://"])
        .env("ALWITH_RUNTIME_ENGINES", engines_table(&app)?)
        .env("ALWITH_RUNTIME_JOURNAL", journal)
        .env("ALWITH_RUNTIME_PARENT_PID", std::process::id().to_string())
        .env("RUST_LOG", "info")
        .hide_console();
    let client = tokio::time::timeout(READY_TIMEOUT, RuntimeClient::spawn(command))
        .await
        .map_err(|_| "alwith-runtime did not report ready in time")?
        .map_err(|error| error.to_string())?;
    let client = Arc::new(client);
    let mut events = client.events();
    *state.client.lock().unwrap() = Some(Arc::clone(&client));
    let identity = Arc::downgrade(&client);
    tauri::async_runtime::spawn(async move {
        'events: while let Some(first) = events.recv().await {
            let mut burst = vec![first];
            while let Ok(event) = events.try_recv() {
                burst.push(event);
            }
            let Some(client) = identity.upgrade() else { break };
            let state = app.state::<RuntimeState>();
            if !state.owns(&client) {
                break;
            }
            let mut lines = Vec::with_capacity(burst.len());
            for event in burst {
                match event {
                    ClientEvent::Closed { reason } => {
                        if !lines.is_empty() {
                            let _ = app.emit(LINES_EVENT, std::mem::take(&mut lines));
                        }
                        log::info!("alwith-runtime exited: {reason}");
                        state.client.lock().unwrap().take();
                        state.initialized.lock().unwrap().clear();
                        let _ = app.emit(EXIT_EVENT, json!({"code": null, "signal": null}));
                        break 'events;
                    }
                    ClientEvent::Runtime(alwith_api::RuntimeEvent::Wire { .. }) => {}
                    ClientEvent::Runtime(event) => {
                        if let alwith_api::RuntimeEvent::Exit { agent_id } = &event {
                            state.initialized.lock().unwrap().remove(agent_id);
                        }
                        let text = serde_json::to_value(event).expect("serialize Runtime event").to_string();
                        // Diagnostics only. Never slice by byte index: a multi-byte character at the cut
                        // would panic this task and silently stop every event reaching the webview.
                        eprintln!("[relay] event {}", text.chars().take(400).collect::<String>());
                        lines.push(text);
                    }
                    ClientEvent::Gap { .. } => lines.push(json!({"type":"lagged"}).to_string()),
                    ClientEvent::Other(value) => lines.push(value.to_string()),
                }
            }
            if !lines.is_empty() {
                let _ = app.emit(LINES_EVENT, lines);
            }
        }
    });
    Ok(())
}

#[derive(Deserialize)]
struct Request {
    id: u64,
    method: String,
    params: Option<Value>,
}

#[tauri::command]
pub async fn runtime_send(
    window: WebviewWindow, state: State<'_, RuntimeState>, line: String, connection_id: String,
) -> Result<(), String> {
    let request: Request = serde_json::from_str(&line).map_err(|error| error.to_string())?;
    let current = || state.connections.lock().unwrap().get(window.label()) == Some(&connection_id);
    if !current() {
        return Err("Window connection replaced".into());
    }
    let client = state.current()?;
    eprintln!("[relay] request {} {}", request.method, request.params.as_ref().map(|p| p.to_string()).unwrap_or_default().chars().take(300).collect::<String>());
    let handshake_agent = initialize_agent(&request).map(str::to_owned);
    if let Some(agent_id) = &handshake_agent
        && let Some(cached) = state.initialized.lock().unwrap().get(agent_id).cloned()
    {
        eprintln!("[relay] initialize for {agent_id} answered from cache");
        let response = json!({"connectionId": connection_id, "id": request.id, "result": cached, "error": null});
        return window.emit(LINES_EVENT, vec![response.to_string()]).map_err(|error| error.to_string());
    }
    if request.method == "start"
        && let Some(agent_id) = request.params.as_ref().and_then(|p| p.get("agentId")).and_then(Value::as_str)
        && client.agents().await.map(|agents| agents.iter().any(|a| a["agentId"] == agent_id && !a["pid"].is_null())).unwrap_or(false)
    {
        eprintln!("[relay] start for {agent_id} ignored: already running");
        let response = json!({"connectionId": connection_id, "id": request.id, "result": null, "error": null});
        return window.emit(LINES_EVENT, vec![response.to_string()]).map_err(|error| error.to_string());
    }
    let outcome = client.request(&request.method, request.params).await;
    if let (Some(agent_id), Ok(result)) = (&handshake_agent, &outcome) {
        state.initialized.lock().unwrap().insert(agent_id.clone(), result.clone());
    }
    if let Err(error) = &outcome {
        eprintln!("[relay] error {} -> {} {}", request.method, error.code, error.message);
    }
    if !state.owns(&client) || !current() {
        return Err("Runtime connection replaced".into());
    }
    let response = match outcome {
        Ok(result) => json!({"connectionId": connection_id, "id": request.id, "result": result, "error": null}),
        Err(error) => json!({"connectionId": connection_id, "id": request.id, "error": error}),
    };
    window.emit(LINES_EVENT, vec![response.to_string()]).map_err(|error| error.to_string())
}

/// The agent an ACP `initialize` handshake targets, when `request` is one.
fn initialize_agent(request: &Request) -> Option<&str> {
    let params = request.params.as_ref()?;
    if request.method != "acpRequest" || params.get("method")?.as_str()? != "initialize" {
        return None;
    }
    params.get("agentId")?.as_str()
}
