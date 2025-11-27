-- Create database
CREATE DATABASE ticketing_db;

-- Connect to database
\c ticketing_db;

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('secretary', 'director')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tickets table
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    guest_name VARCHAR(100) NOT NULL,
    company VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    purpose TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_room', 'completed', 'cancelled', 'rejected')),
    appointment_time TIMESTAMP NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default users (password: admin123 untuk keduanya)
INSERT INTO users (username, password, full_name, role) VALUES 
('secretary', '$2a$10$xQZ5Z5Z5Z5Z5Z5Z5Z5Z5ZuC5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z', 'Sekretaris', 'secretary'),
('director', '$2a$10$xQZ5Z5Z5Z5Z5Z5Z5Z5Z5ZuC5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z', 'Direktur', 'director');

-- Create indexes
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_appointment ON tickets(appointment_time);
CREATE INDEX idx_users_username ON users(username);
