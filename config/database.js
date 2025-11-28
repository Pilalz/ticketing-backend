const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on('connect', () => {
  console.log('Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

const testConnection = async () => {
  try {
    const client = await pool.connect();
    
    // Test 1: Cek database yang sedang digunakan
    const dbResult = await client.query('SELECT current_database()');
    console.log('📊 Current Database:', dbResult.rows[0].current_database);
    
    // Test 2: Cek schema
    const schemaResult = await client.query('SELECT current_schema()');
    console.log('📊 Current Schema:', schemaResult.rows[0].current_schema);
    
    // Test 3: Lihat semua tabel
    const tablesResult = await client.query(`
      SELECT schemaname, tablename 
      FROM pg_tables 
      WHERE tablename ILIKE '%meeting%'
      ORDER BY schemaname, tablename
    `);
    console.log('📊 Tables found:', tablesResult.rows);
    
    // Test 4: Coba query langsung
    const testQuery = await client.query('SELECT * FROM "meetingSchedule" LIMIT 1');
    console.log('📊 Test query success! Found', testQuery.rowCount, 'rows');
    
    client.release();
  } catch (err) {
    console.error('❌ Connection test failed:', err.message);
  }
};

// Uncomment untuk test connection saat startup
// testConnection();

module.exports = pool;
