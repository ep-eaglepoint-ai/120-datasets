# Minimal Authentication System from Scratch

This project implements a complete authentication system in Next.js using TypeScript, built entirely without external authentication libraries or managed services. It is designed to be pedagogical, demonstrating the core primitives of identity, password handling, and session management.

## Features

- **User Registration**: Create accounts with username, email, and password.
- **User Login**: Multi-identifier support (login with email or username).
- **Manual Password Hashing**: Implemented using Node.js `crypto` (`pbkdf2Sync`) with salt and timing-safe verification.
- **Custom Session Management**: Signed session tokens stored in HttpOnly cookies, implemented manually without JWT libraries.
- **Protected Routes**: Middleware-based route protection for the dashboard.
- **File-based Persistence**: A simple JSON-based database logic for demonstration purposes.

## Security Practices Implemented

1. **Password Hashing**: Never stores plain-text passwords. Uses unique salts and `sha512` hashing.
2. **Timing Attack Prevention**: Uses `timingSafeEqual` for sensitive comparisons (passwords and session signatures).
3. **Secure Cookies**: HttpOnly and SameSite flags set to prevent XSS and CSRF.
4. **Session Integrity**: Tokens are signed with a server secret to prevent tampering.

## Project Structure

- `src/lib/auth/password.ts`: Logic for hashing and verifying passwords.
- `src/lib/auth/session.ts`: Logic for creating, reading, and signing session cookies.
- `src/lib/db.ts`: Mock database logic using a JSON file.
- `src/app/api/auth/`: Backend API routes for register, login, and logout.
- `src/middleware.ts`: Next.js middleware for route protection.

## How to Run

1.  Navigate to the project root directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:4080](http://localhost:4080) in your browser.

## Credentials

You can register any user. For convenience, once registered, the data is persisted in `data/db.json`.
