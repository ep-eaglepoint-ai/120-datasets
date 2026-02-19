use actix_web::{error, web, App, HttpResponse, HttpServer, Responder, ResponseError};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;
use validator::{Validate, ValidationError};
use thiserror::Error;

/* ===================== ERRORS ===================== */

#[derive(Debug, Error, Serialize)]
pub enum BookError {
    #[error("Book not found")]
    NotFound,
    #[error("Validation failed: {0}")]
    ValidationError(String),
    #[error("Immutable field update: {0}")]
    ImmutableUpdate(String),
    #[error("Internal server error")]
    InternalError,
}

impl BookError {
    fn error_type(&self) -> &str {
        match self {
            BookError::NotFound => "NotFound",
            BookError::ValidationError(_) => "ValidationError",
            BookError::ImmutableUpdate(_) => "ImmutableUpdate",
            BookError::InternalError => "InternalError",
        }
    }
}

impl ResponseError for BookError {
    fn error_response(&self) -> HttpResponse {
        let status = match self {
            BookError::NotFound => actix_web::http::StatusCode::NOT_FOUND,
            BookError::ValidationError(_) => actix_web::http::StatusCode::BAD_REQUEST,
            BookError::ImmutableUpdate(_) => actix_web::http::StatusCode::BAD_REQUEST,
            BookError::InternalError => actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
        };

        HttpResponse::build(status).json(serde_json::json!({
            "error": self.error_type(),
            "message": self.to_string()
        }))
    }
}

/* ===================== MODELS ===================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Book {
    id: Uuid,
    title: String,
    author: String,
    price: f64,
    stock: i64,
}

#[derive(Debug, Deserialize, Validate)]
struct CreateBook {
    #[validate(length(min = 1, message = "Title cannot be empty"))]
    title: String,
    #[validate(length(min = 1, message = "Author cannot be empty"))]
    author: String,
    #[validate(range(min = 0.01, message = "Price must be greater than 0"))]
    price: f64,
    #[validate(range(min = 0, message = "Stock must be 0 or greater"))]
    stock: i64,
}

#[derive(Debug, Deserialize, Validate)]
struct UpdateBook {
    #[validate(length(min = 1, message = "Author cannot be empty"))]
    author: Option<String>,
    #[validate(range(min = 0.01, message = "Price must be greater than 0"))]
    price: Option<f64>,
    #[validate(range(min = 0, message = "Stock must be 0 or greater"))]
    stock: Option<i64>,
    // JSON fields to catch unauthorized updates
    title: Option<serde_json::Value>,
    id: Option<serde_json::Value>,
}

/* ===================== STATE ===================== */

struct AppState {
    books: Arc<Mutex<HashMap<Uuid, Book>>>,
}

/* ===================== HANDLERS ===================== */

// CREATE
async fn create_book(
    data: web::Data<AppState>,
    payload: web::Json<CreateBook>,
) -> Result<impl Responder, BookError> {
    payload.validate().map_err(|e| BookError::ValidationError(e.to_string()))?;

    let mut books = data.books.lock().map_err(|_| BookError::InternalError)?;

    let book = Book {
        id: Uuid::new_v4(),
        title: payload.title.clone(),
        author: payload.author.clone(),
        price: payload.price,
        stock: payload.stock,
    };

    books.insert(book.id, book.clone());
    Ok(HttpResponse::Created().json(book))
}

// READ ALL
async fn get_books(data: web::Data<AppState>) -> Result<impl Responder, BookError> {
    let books = data.books.lock().map_err(|_| BookError::InternalError)?;
    let list: Vec<Book> = books.values().cloned().collect();
    Ok(HttpResponse::Ok().json(list))
}

// READ ONE
async fn get_book(
    data: web::Data<AppState>,
    id: web::Path<Uuid>,
) -> Result<impl Responder, BookError> {
    let books = data.books.lock().map_err(|_| BookError::InternalError)?;

    match books.get(&id.into_inner()) {
        Some(book) => Ok(HttpResponse::Ok().json(book)),
        None => Err(BookError::NotFound),
    }
}

// UPDATE (PATCH)
async fn update_book(
    data: web::Data<AppState>,
    id: web::Path<Uuid>,
    payload: web::Json<UpdateBook>,
) -> Result<impl Responder, BookError> {
    // Check for attempts to update title or id
    if payload.title.is_some() {
        return Err(BookError::ImmutableUpdate("title".into()));
    }
    if payload.id.is_some() {
        return Err(BookError::ImmutableUpdate("id".into()));
    }

    payload.validate().map_err(|e| BookError::ValidationError(e.to_string()))?;

    let mut books = data.books.lock().map_err(|_| BookError::InternalError)?;
    let book = books.get_mut(&id.into_inner()).ok_or(BookError::NotFound)?;

    if let Some(author) = &payload.author {
        book.author = author.clone();
    }
    if let Some(price) = payload.price {
        book.price = price;
    }
    if let Some(stock) = payload.stock {
        book.stock = stock;
    }

    Ok(HttpResponse::Ok().json(book.clone()))
}

// DELETE
async fn delete_book(
    data: web::Data<AppState>,
    id: web::Path<Uuid>,
) -> Result<impl Responder, BookError> {
    let mut books = data.books.lock().map_err(|_| BookError::InternalError)?;

    match books.remove(&id.into_inner()) {
        Some(_) => Ok(HttpResponse::NoContent().finish()),
        None => Err(BookError::NotFound),
    }
}

/* ===================== MAIN ===================== */

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let state = web::Data::new(AppState {
        books: Arc::new(Mutex::new(HashMap::new())),
    });

    println!("Starting bookstore service on 0.0.0.0:8080...");

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .app_data(web::JsonConfig::default().error_handler(|err, _req| {
                let err_msg = err.to_string();
                error::InternalError::from_response(
                    err,
                    BookError::ValidationError(err_msg).error_response(),
                )
                .into()
            }))
            .service(
                web::scope("/books")
                    .route("", web::post().to(create_book))
                    .route("", web::get().to(get_books))
                    .route("/{id}", web::get().to(get_book))
                    .route("/{id}", web::patch().to(update_book))
                    .route("/{id}", web::delete().to(delete_book)),
            )
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}

/* ===================== TESTS ===================== */

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_book_validation() {
        let book = CreateBook {
            title: "".into(),
            author: "Author".into(),
            price: 10.0,
            stock: 5,
        };
        assert!(book.validate().is_err());

        let book = CreateBook {
            title: "Title".into(),
            author: "".into(),
            price: 10.0,
            stock: 5,
        };
        assert!(book.validate().is_err());

        let book = CreateBook {
            title: "Title".into(),
            author: "Author".into(),
            price: -1.0,
            stock: 5,
        };
        assert!(book.validate().is_err());
    }

    #[test]
    fn test_update_book_validation() {
        let book = UpdateBook {
            author: Some("".into()),
            price: Some(10.0),
            stock: Some(5),
            title: None,
            id: None,
        };
        assert!(book.validate().is_err());

        let book = UpdateBook {
            author: Some("Author".into()),
            price: Some(0.0),
            stock: Some(5),
            title: None,
            id: None,
        };
        assert!(book.validate().is_err());
    }

    #[test]
    fn test_immutable_field_check() {
        let book = UpdateBook {
            author: Some("Author".into()),
            price: Some(10.0),
            stock: Some(5),
            title: Some(serde_json::Value::String("New Title".into())),
            id: None,
        };
        // This is handled in the handler, but the struct should allow these fields to exist
        assert!(book.title.is_some());
    }
}
