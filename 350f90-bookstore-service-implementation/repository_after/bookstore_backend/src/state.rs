use crate::models::Book;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub type BookStore = Arc<Mutex<HashMap<Uuid, Book>>>;

pub struct AppState {
    pub books: BookStore,
}
