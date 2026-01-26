const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  port:3306,
  password: 'root123',
  database: 'user_management',
//   connectionLimit: 10,
  queueLimit: 0
});

// Add this test block
pool.getConnection()
  .then(conn => {
    console.log("MySQL Connected successfully to 2026 database");
    conn.release();
  })
  .catch(err => {
    console.error("MySQL Connection Failed:", err.message);
  });

module.exports = pool;
