-- Database setup for simplified Hotel Management System
-- Run this script to create the database and tables

-- Create database
CREATE DATABASE IF NOT EXISTS hotelmanagement;
USE hotelmanagement;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS rooms;

-- Create rooms table (simplified - no separate reservation table)
CREATE TABLE rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    roomnumber VARCHAR(10) NOT NULL,
    floor VARCHAR(50) NOT NULL,
    room_type VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    booked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some sample data
INSERT INTO rooms (roomnumber, floor, room_type, price, booked) VALUES
('101', 'Ground', 'Suite Single Bed', 150.00, false),
('102', 'Ground', 'Suite Double Bed', 200.00, false),
('201', 'First Floor', 'Suite Presidential', 500.00, false),
('202', 'First Floor', 'Suite Family', 300.00, true),
('301', 'Second floor', 'Suite Single Bed', 160.00, false);

-- Show the data
SELECT * FROM rooms;

-- Instructions:
-- 1. Make sure MySQL is running
-- 2. Run this script: mysql -u keti -p < database_setup.sql
-- 3. Enter password when prompted: password
-- 4. Or run in MySQL Workbench or command line client
