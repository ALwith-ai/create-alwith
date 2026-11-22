mod runtime;

use tauri::Manager;

pub fn run() {
    let context = tauri::generate_context!();
    let builder = tauri::Builder::default()
        .runtime(tauri_runtime_wry::Wry::default())
        .plugin(tauri_plugin_log::Builder::new().level(log::LevelFilter::Info).build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_os::init())
        .plugin(alwith_desktop_shell::init("en"))
        .plugin(tauri_plugin_dialog::init())
        // Application extensions: packages under the app's data directory, the precompiled native
        // implementation from resources/native while developing.
        .plugin(alwith_extension::init(alwith_extension::Config {
            root: None,
            development_directory: native_development_directory(),
        }))
        // Model providers (API keys, custom providers) and skill documents: module-chat's plugin over this app's Runtime.
        .plugin(alwith_chat::init(alwith_chat::runtime_fn(|app| {
            app.state::<runtime::RuntimeState>().current()
        })))
        .plugin(alwith_store::init())
        // ALwith account token refresh and the desktop Vibemon; its owner decision runs over this app's Runtime.
        .plugin(alwith_auth::init(alwith_auth::Config {
            development_directory: native_development_directory(),
            vibemon: Some(alwith_auth::VibemonOwner::new(vibemon_owner)),
        }));
    // alwith:updates:begin
    // Signed updates from GitHub Releases, as `updates` in alwith.app.json declares them.
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    // alwith:updates:end
    #[cfg(feature = "hasgard-testing")]
    let builder = builder.plugin(tauri_plugin_hasgard::init());
    builder
        .manage(runtime::RuntimeState::default())
        .invoke_handler(tauri::generate_handler![
            runtime::runtime_start,
            runtime::runtime_send
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event && window.label() == "main" {
                runtime::shutdown_blocking(window.app_handle());
            }
        })
        .run(context)
        .expect("error while running tauri application");
}

/// Debug builds load the staged native libraries from the project; release builds use the bundled resources.
fn native_development_directory() -> Option<std::path::PathBuf> {
    #[cfg(debug_assertions)]
    {
        Some(std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/native"))
    }
    #[cfg(not(debug_assertions))]
    {
        None
    }
}

fn vibemon_owner(app: &tauri::AppHandle, session_id: String, owner: String) -> alwith_auth::OwnerCheck {
    let client = app.state::<runtime::RuntimeState>().current();
    Box::pin(async move {
        let states = client?.run_states().await.map_err(|error| error.to_string())?;
        let matching: Vec<_> = states.iter().filter(|state| state.session_id == session_id).collect();
        Ok(matching.len() == 1 && matching[0].owner_id == owner && matching[0].execution_id.is_none())
    })
}
