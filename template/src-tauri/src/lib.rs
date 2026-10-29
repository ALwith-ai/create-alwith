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
        .plugin(tauri_plugin_alwith_desktop_shell::init("en"))
        .plugin(alwith_module_store::tauri::init())
        .plugin(alwith_auth_client::tauri::init(Some(
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/native")
        )));
    // Signed updates from GitHub Releases exist only when alwith.app.json declares `updates`; the updater
    // plugin rejects a configuration without a public key, so it is registered only then.
    let builder = if tauri_plugin_alwith_desktop_shell::updates_configured(context.config()) {
        builder.plugin(tauri_plugin_updater::Builder::new().build())
    } else {
        builder
    };
    #[cfg(feature = "hasgard-testing")]
    let builder = builder.plugin(tauri_plugin_hasgard::init());
    builder
        .manage(runtime::RuntimeState::default())
        .manage(alwith_auth_client::pets::RuntimeAccess(pet_owner))
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

fn pet_owner(app: &tauri::AppHandle, session_id: String, owner: String) -> alwith_auth_client::pets::OwnerCheck {
    let client = app.state::<runtime::RuntimeState>().current();
    Box::pin(async move {
        let states = client?.run_states().await.map_err(|error| error.to_string())?;
        let matching: Vec<_> = states.iter().filter(|state| state.session_id == session_id).collect();
        Ok(matching.len() == 1 && matching[0].owner_id == owner && matching[0].execution_id.is_none())
    })
}
