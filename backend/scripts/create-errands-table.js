const mysql = require('mysql2/promise');
require('dotenv').config();

async function createErrandsTable() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'campus_trading'
    });

    console.log('✅ 连接到数据库成功');

    // 检查表是否存在
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'errands'",
      [process.env.DB_NAME || 'campus_trading']
    );

    if (tables.length > 0) {
      console.log('ℹ️  errands 表已存在');
      await connection.end();
      return;
    }

    // 创建表
    await connection.execute(`
      CREATE TABLE errands (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL COMMENT '任务标题',
        description TEXT COMMENT '任务描述',
        location VARCHAR(200) NOT NULL COMMENT '跑腿地点',
        destination VARCHAR(200) COMMENT '目的地（可选）',
        reward DECIMAL(10, 2) NOT NULL COMMENT '报酬金额',
        category VARCHAR(50) COMMENT '任务分类',
        status ENUM('pending', 'accepted', 'completed', 'cancelled') DEFAULT 'pending' COMMENT '任务状态',
        publisher_id INT NOT NULL COMMENT '发布者ID',
        accepter_id INT NULL COMMENT '接单者ID',
        contact_info VARCHAR(200) COMMENT '联系方式',
        deadline DATETIME COMMENT '截止时间',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        accepted_at TIMESTAMP NULL COMMENT '接单时间',
        completed_at TIMESTAMP NULL COMMENT '完成时间',
        FOREIGN KEY (publisher_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (accepter_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_errands_publisher_id (publisher_id),
        INDEX idx_errands_accepter_id (accepter_id),
        INDEX idx_errands_status (status),
        INDEX idx_errands_category (category),
        INDEX idx_errands_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='跑腿任务表'
    `);

    console.log('✅ errands 表创建成功');

    const [allTables] = await connection.execute('SHOW TABLES');
    console.log('数据库表:', allTables.map(t => Object.values(t)[0]));

  } catch (error) {
    console.error('❌ 创建表失败:', error.message);
    console.error('完整错误:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

createErrandsTable();






