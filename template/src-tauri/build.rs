fn main() {
    // The hasgard-testing capability is compiled only with that feature, so release builds never grant it.
    let pattern = if std::env::var_os("CARGO_FEATURE_HASGARD_TESTING").is_some() {
        "./capabilities/**/*.json"
    } else {
        "./capabilities/*.json"
    };
    tauri_build::try_build(tauri_build::Attributes::new().capabilities_path_pattern(pattern))
        .expect("failed to build Tauri capabilities");
}
