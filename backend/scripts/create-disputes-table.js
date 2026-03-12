const mysql = require('mysql2/promise');
require('dotenv').config();

async function createDisputesTable() {
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

    // 检查 disputes 表是否已存在
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'disputes'",
      [process.env.DB_NAME || 'campus_trading']
    );

    if (tables.length > 0) {
      console.log('ℹ️  disputes 表已存在，跳过创建');
      return;
    }

    // 创建 disputes 表
    await connection.execute(`
      CREATE TABLE disputes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_id INT NOT NULL,
        initiator_id INT NOT NULL,
        respondent_id INT NOT NULL,
        dispute_type ENUM('commodity_misrepresentation', 'no_show', 'price_dispute', 'other') NOT NULL,
        description TEXT NOT NULL,
        evidence_images JSON DEFAULT NULL,
        response_description TEXT DEFAULT NULL,
        response_evidence_images JSON DEFAULT NULL,
        status ENUM('pending_response', 'pending_review', 'resolved', 'appealed', 'appeal_resolved') DEFAULT 'pending_response',
        admin_review_result ENUM('support_initiator', 'support_respondent', 'partial_refund', 'no_support') DEFAULT NULL,
        admin_review_reason TEXT DEFAULT NULL,
        admin_reviewer_id INT DEFAULT NULL,
        reviewed_at TIMESTAMP NULL DEFAULT NULL,
        appeal_description TEXT DEFAULT NULL,
        appeal_evidence_images JSON DEFAULT NULL,
        appeal_review_result ENUM('support_initiator', 'support_respondent', 'partial_refund', 'no_support') DEFAULT NULL,
        appeal_review_reason TEXT DEFAULT NULL,
        appeal_reviewed_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        responded_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (initiator_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (respondent_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (admin_reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_disputes_item_id (item_id),
        INDEX idx_disputes_initiator_id (initiator_id),
        INDEX idx_disputes_respondent_id (respondent_id),
        INDEX idx_disputes_status (status),
        INDEX idx_disputes_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ disputes 表创建成功');

    // 检查 items 表是否有 disputed 状态
    const [statusColumns] = await connection.execute(
      "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'status'",
      [process.env.DB_NAME || 'campus_trading']
    );

    if (statusColumns.length > 0) {
      const columnType = statusColumns[0].COLUMN_TYPE;
      if (!columnType.includes('disputed')) {
        console.log('🔧 正在更新 items.status 字段，添加 disputed 状态...');
        await connection.execute(`
          ALTER TABLE items
          MODIFY COLUMN status ENUM('available', 'sold', 'disputed') DEFAULT 'available'
        `);
        console.log('✅ items.status 字段已更新');
      } else {
        console.log('ℹ️  items.status 字段已包含 disputed 状态，跳过');
      }
    }

    console.log('\n✅ 所有操作完成！');
  } catch (error) {
    console.error('❌ 创建纠纷表失败:', error.message);
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
  createDisputesTable();
}

module.exports = createDisputesTable;

