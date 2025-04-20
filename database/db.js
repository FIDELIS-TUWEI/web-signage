const mysql = require('mysql2/promise');
const config = require('../backend/utils/config');

// Create a MySQL connection pool
const pool = mysql.createPool({
    host: config.MYSQL_HOST || 'mysql',
    user: config.MYSQL_USER,
    password: config.MYSQL_PASSWORD,
    database: config.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection to the MySQL database with retries
const testConnection = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
        try {
            const connection = await pool.getConnection();
            console.log('Successfully connected to the MySQL database');
            connection.release();
            return true;
        } catch (err) {
            console.error('Error connecting to the database:', err);
            await new Promise(res => setTimeout(res, 5000)); // wait 5 seconds before retrying
        }
    }
    return false;
};

// Create all required tables in the database
const createTables = async () => {
    try {
        const connection = await pool.getConnection();
        
        await connection.query('START TRANSACTION');

        //Users table
        await connection.query(`
            CREATE TABLE Users (
                user_id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                role ENUM('admin', 'editor', 'viewer') NOT NULL DEFAULT 'editor',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);

        //Displays table
        await connection.query(`
            CREATE TABLE Displays (
                display_id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                location VARCHAR(255),
                orientation ENUM('portrait', 'landscape') DEFAULT 'landscape',
                screen_size VARCHAR(50), //in inches
                status ENUM('active', 'inactive') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);

        //Content types table
        await connection.query(`
            CREATE TABLE Content_types (
                content_type_id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                description TEXT
            );    
        `);

        //Contents table for all uploaded media and text
        await connection.query(`
            CREATE TABLE Contents (
                content_id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                content_type_id INT NOT NULL,
                file_path VARCHAR(255),
                content_text TEXT,
                duration INT DEFAULT 10, -- duration in seconds
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (content_type_id) REFERENCES Content_types(id),
                FOREIGN KEY (created_by) REFERENCES Users(id)
            );
        `);

        //Playlists table to group content
        await connection.query(`
            CREATE TABLE Playlists (
                playlist_id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES Users(id)
            );
        `);

        //Playlist items to link content to playlists with order
        await connection.query(`
            CREATE TABLE Playlist_items (
                playlist_item_id INT PRIMARY KEY AUTO_INCREMENT,
                playlist_id INT NOT NULL,
                content_id INT NOT NULL,
                display_order INT NOT NULL,
                FOREIGN KEY (playlist_id) REFERENCES Playlists(id) ON DELETE CASCADE,
                FOREIGN KEY (content_id) REFERENCES Contents(id) ON DELETE CASCADE,
                UNIQUE KEY (playlist_id, content_id)
            );
        `);

        //Schedules table for time-based content
        await connection.query(`
            CREATE TABLE schedules (
                schedule_id INT PRIMARY KEY AUTO_INCREMENT,
                playlist_id INT NOT NULL,
                display_id INT NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                start_time TIME,
                end_time TIME,
                days_of_week VARCHAR(20), //e.g., "1,2,3,4,5" for weekdays
                priority INT DEFAULT 0,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (playlist_id) REFERENCES Playlists(id),
                FOREIGN KEY (display_id) REFERENCES Displays(id),
                FOREIGN KEY (created_by) REFERENCES Users(id)
            );    
        `);

        await connection.query(``);

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error creating tables:', error);
        throw error;
    }
};

// Check if the tables already exist
const checkTablesExist = async () => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = ? AND table_name = 'Users'
        `, [config.MYSQL_DATABASE]);
        
        connection.release();
        return rows[0].count > 0;
    } catch (error) {
        console.error('Error checking if tables exist:', error);
        throw error;
    }
};

// Generic query function to interact with the database
const query = (sql, params) => pool.query(sql, params);

module.exports = {
    testConnection,
    createTables,
    checkTablesExist,
    query
};