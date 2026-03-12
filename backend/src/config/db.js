const mysql = require('mysql2/promise');

// 创建数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campus_trading',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 测试数据库连接
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ 数据库连接成功');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    return false;
  }
};

// 执行查询的辅助函数
const query = async (sql, params = []) => {
  try {
    const [rows] = await pool.execute(sql, params);
    // 与原生 mysql2 execute 返回格式保持一致，方便使用解构 [rows]
    return [rows];
  } catch (error) {
    // 只在开发环境或关键错误时输出详细日志
    if (process.env.NODE_ENV === 'development' && error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('数据库查询错误:', error.message);
      console.error('SQL:', sql);
    }
    throw error;
  }
};

module.exports = {
  pool,
  query,
  testConnection
};

