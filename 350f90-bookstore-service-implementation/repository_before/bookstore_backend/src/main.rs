use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

/* ===================== MODELS ===================== */
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Book {
    id: Uuid,
    title: String,
    author: String,
    price: f64,
    stock: u32,
}

#[derive(Debug, Deserialize)]
struct CreateBook {
    title: String,
    author: String,
    price: f64,
    stock: u32,
}

#[derive(Debug, Deserialize)]
struct UpdateBook {
    author: Option<String>,
    price: Option<f64>,
    stock: Option<u32>,
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
) -> impl Responder {
    let mut books = data.books.lock().unwrap();
    let book = Book {
        id: Uuid::new_v4(),
        title: payload.title.clone(),
        author: payload.author.clone(),
        price: payload.price,
        stock: payload.stock,
    };
    books.insert(book.id, book.clone());
    HttpResponse::Created().json(book)
}

// READ ALL
async fn get_books(data: web::Data<AppState>) -> impl Responder {
    let books = data.books.lock().unwrap();
    let list: Vec<Book> = books.values().cloned().collect();
    HttpResponse::Ok().json(list)
}

// READ ONE
async fn get_book(
    data: web::Data<AppState>,
    id: web::Path<Uuid>,
) -> impl Responder {
    let books = data.books.lock().unwrap();
    match books.get(&id.into_inner()) {
        Some(book) => HttpResponse::Ok().json(book),
        None => HttpResponse::NotFound().json("Book not found"),
    }
}

// UPDATE
async fn update_book(
    data: web::Data<AppState>,
    id: web::Path<Uuid>,
    payload: web::Json<UpdateBook>,
) -> impl Responder {
    let mut books = data.books.lock().unwrap();
    let book = match books.get_mut(&id.into_inner()) {
        Some(b) => b,
        None => return HttpResponse::NotFound().json("Book not found"),
    };

    if let Some(author) = &payload.author {
        book.author = author.clone();
    }
    if let Some(price) = payload.price {
        book.price = price;
    }
    if let Some(stock) = payload.stock {
        book.stock = stock;
    }
    HttpResponse::Ok().json(book.clone())
}

// DELETE
async fn delete_book(
    data: web::Data<AppState>,
    id: web::Path<Uuid>,
) -> impl Responder {
    let mut books = data.books.lock().unwrap();
    match books.remove(&id.into_inner()) {
        Some(_) => HttpResponse::NoContent().finish(),
        None => HttpResponse::NotFound().json("Book not found"),
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
            .service(
                web::scope("/books")
                    .route("", web::post().to(create_book))
                    .route("", web::get().to(get_books))
                    .route("/{id}", web::get().to(get_book))
                    .route("/{id}", web::put().to(update_book))
                    .route("/{id}", web::delete().to(delete_book)),
            )
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
