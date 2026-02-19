# Simplified Hotel Management System

A basic hotel management application built with Java Swing and MySQL.

## Features (Simplified Version)
- **Login** - Simple login screen (no actual authentication)
- **Room Management** - Add rooms and view all rooms with their booking status
- **Bookings** - View booked rooms and checkout

## Removed Features
- Dashboard
- Customer management with detailed booking forms
- Room editing/updating
- Search and filtering
- Extended stay functionality

## Prerequisites
1. Java JDK 8 or higher
2. MySQL Server 5.7 or higher
3. NetBeans IDE (optional, but recommended)
4. MySQL Connector/J library

## Database Setup

1. Install and start MySQL server
2. Create a MySQL user (or use existing):
   ```sql
   CREATE USER 'keti'@'localhost' IDENTIFIED BY 'password';
   GRANT ALL PRIVILEGES ON hotelmanagement.* TO 'keti'@'localhost';
   FLUSH PRIVILEGES;
   ```

3. Run the database setup script:
   ```bash
   mysql -u keti -p < database_setup.sql
   ```
   Enter password: `password`

## Running the Application

### Option 1: Using NetBeans
1. Open NetBeans IDE
2. Go to File → Open Project
3. Navigate to the `Hotel-Management` folder
4. Right-click the project and select "Run"

### Option 2: Using Command Line
1. Ensure MySQL Connector/J is in the classpath
2. Compile:
   ```bash
   javac -cp ".:mysql-connector-java-8.0.x.jar" src/hotelmanagement/*.java
   ```
3. Run:
   ```bash
   java -cp ".:mysql-connector-java-8.0.x.jar:src" hotelmanagement.HotelManagement
   ```

## Project Structure
```
Hotel-Management/
├── src/
│   └── hotelmanagement/
│       ├── HotelManagement.java  # Main entry point
│       ├── Login.java             # Login screen
│       ├── Rooms.java             # Room management
│       └── Bookings.java          # View bookings
├── database_setup.sql             # Database schema
└── README.md                      # This file
```

## Database Connection
- **Host**: localhost
- **Database**: hotelmanagement
- **Username**: keti
- **Password**: password

**Note**: These credentials are hardcoded in the source files for simplicity. In production, use environment variables or configuration files.

## Usage Flow
1. Start application → Login screen appears
2. Click "Sign in" (no validation, just proceeds)
3. Rooms screen shows:
   - Form to add new rooms
   - Table showing all rooms with status
4. Navigate to Bookings to:
   - View currently booked rooms
   - Checkout rooms

## Known Issues (By Design - Bad Architecture)
- No separation of concerns (UI, logic, data mixed)
- Hardcoded database credentials
- No input validation
- No proper error handling
- No authentication
- Direct JDBC usage (no connection pooling)
- Resources not properly closed
- God classes with too many responsibilities

These issues are intentional to demonstrate poor architecture that needs refactoring.
