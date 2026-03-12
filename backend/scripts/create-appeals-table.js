const mysql = require('mysql2/promise');
require('dotenv').config();

async function createAppealsTable() {
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

    // 检查 appeals 表是否已存在
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'appeals'",
      [process.env.DB_NAME || 'campus_trading']
    );

    if (tables.length > 0) {
      console.log('ℹ️ appeals 表已存在，跳过创建');
    } else {

    await connection.execute(`
      CREATE TABLE appeals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        dispute_id INT NOT NULL,
        appellant_id INT NOT NULL,
        description TEXT NOT NULL,
        evidence_images JSON DEFAULT NULL,
        status ENUM('pending_review', 'resolved') DEFAULT 'pending_review',
        review_result ENUM('support_initiator', 'support_respondent', 'partial_refund', 'no_support') DEFAULT NULL,
        review_reason TEXT DEFAULT NULL,
        reviewer_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (dispute_id) REFERENCES disputes(id) ON DELETE CASCADE,
        FOREIGN KEY (appellant_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_appeals_dispute_id (dispute_id),
        INDEX idx_appeals_status (status),
        INDEX idx_appeals_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

      console.log('✅ appeals 表创建成功');
    }

    // 检查并添加 disputes 表需要的字段
    const dbName = process.env.DB_NAME || 'campus_trading';
    
    // 检查 initiator_rejected 字段是否存在
    const [initiatorRejectedCol] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'disputes' AND COLUMN_NAME = 'initiator_rejected'",
      [dbName]
    );
    
    if (initiatorRejectedCol.length === 0) {
      console.log('🔧 正在为 disputes 表添加确认/拒绝字段...');
      try {
        await connection.execute(`
          ALTER TABLE disputes
          ADD COLUMN initiator_rejected BOOLEAN DEFAULT FALSE COMMENT '发起者是否拒绝接受结果',
          ADD COLUMN respondent_rejected BOOLEAN DEFAULT FALSE COMMENT '响应者是否拒绝接受结果',
          ADD COLUMN initiator_confirmed BOOLEAN DEFAULT FALSE COMMENT '发起者是否确认接受结果',
          ADD COLUMN respondent_confirmed BOOLEAN DEFAULT FALSE COMMENT '响应者是否确认接受结果',
          ADD COLUMN initiator_confirmed_at TIMESTAMP NULL DEFAULT NULL,
          ADD COLUMN respondent_confirmed_at TIMESTAMP NULL DEFAULT NULL
        `);
        console.log('✅ disputes 表字段添加成功');
      } catch (alterError) {
        if (alterError.code === 'ER_DUP_FIELDNAME') {
          console.log('ℹ️  disputes 表字段已存在，跳过');
        } else {
          console.error('⚠️  添加字段时出错:', alterError.message);
        }
      }
    } else {
      console.log('ℹ️  disputes 表已包含所需字段，跳过');
    }
  } catch (error) {
    console.error('❌ 创建 appeals 表失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

if (require.main === module) {
  createAppealsTable();
}

module.exports = createAppealsTable;

