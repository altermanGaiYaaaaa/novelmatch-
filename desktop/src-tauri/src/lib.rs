mod commands;
mod db;
mod error;
mod models;
mod services;
mod state;

use std::time::Duration;

use tauri::Manager;

use state::AppState;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            std::fs::create_dir_all(data_dir.join("logs"))?;
            std::fs::create_dir_all(data_dir.join("backups"))?;

            let database = db::Database::open(&data_dir.join("novelmatch.db"))?;

            let http = reqwest::Client::builder()
                .user_agent("NovelMatch/1.0")
                .timeout(Duration::from_secs(200))
                .redirect(reqwest::redirect::Policy::limited(5))
                .build()?;
            let book_http = services::book::build_client()?;

            app.manage(AppState::new(database, http, book_http));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap,
            commands::list_profiles,
            commands::get_profile,
            commands::create_profile,
            commands::update_profile,
            commands::delete_profile,
            commands::list_reference_books,
            commands::add_reference_book,
            commands::save_book_rating,
            commands::save_book_negatives,
            commands::delete_reference_book,
            commands::get_model_config,
            commands::save_model_config,
            commands::clear_model_config,
            commands::test_model_connection,
            commands::fetch_book_meta,
            commands::generate_profile,
            commands::evaluate_novel,
            commands::cancel_task,
            commands::list_evaluations,
            commands::get_evaluation,
            commands::delete_evaluation,
        ])
        .run(tauri::generate_context!())
        .expect("error while running NovelMatch");
}
