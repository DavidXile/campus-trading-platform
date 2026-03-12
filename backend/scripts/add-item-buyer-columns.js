const mysql = require('mysql2/promise');
require('dotenv').config();

async function addColumns() {
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

    // 检查 buyer_id 是否已存在
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'buyer_id'",
      [process.env.DB_NAME || 'campus_trading']
    );

    if (columns.length > 0) {
      console.log('ℹ️  buyer_id 字段已存在，跳过');
      return;
    }

    await connection.execute(`
      ALTER TABLE items
      ADD COLUMN buyer_id INT NULL AFTER seller_id,
      ADD COLUMN purchased_at TIMESTAMP NULL AFTER buyer_id,
      ADD CONSTRAINT fk_items_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE SET NULL
    `);

    await connection.execute('CREATE INDEX idx_items_buyer_id ON items(buyer_id)');

    console.log('✅ 已添加 buyer_id、purchased_at 字段');
  } catch (error) {
    console.error('❌ 添加字段失败:', error.message);
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
  addColumns();
}

module.exports = addColumns;






