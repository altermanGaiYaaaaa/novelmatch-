use std::collections::HashMap;
use std::sync::Mutex;

use reqwest::Client;
use tokio_util::sync::CancellationToken;

use crate::db::Database;

pub struct AppState {
    pub db: Database,
    pub http: Client,
    pub book_http: Client,
    pub tasks: Mutex<HashMap<String, CancellationToken>>,
}

impl AppState {
    pub fn new(db: Database, http: Client, book_http: Client) -> Self {
        Self {
            db,
            http,
            book_http,
            tasks: Mutex::new(HashMap::new()),
        }
    }

    pub fn register_task(&self, task_id: &str) -> CancellationToken {
        let token = CancellationToken::new();
        let mut tasks = self
            .tasks
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(previous) = tasks.insert(task_id.to_string(), token.clone()) {
            previous.cancel();
        }
        token
    }

    pub fn cancel_task(&self, task_id: &str) -> bool {
        let mut tasks = self
            .tasks
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(token) = tasks.remove(task_id) {
            token.cancel();
            true
        } else {
            false
        }
    }

    pub fn finish_task(&self, task_id: &str) {
        let mut tasks = self
            .tasks
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        tasks.remove(task_id);
    }
}
