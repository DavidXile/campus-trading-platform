const mysql = require('mysql2/promise');
require('dotenv').config();

async function addDisputesIndexes() {
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

    // 检查索引是否已存在
    const [indexes] = await connection.execute(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'disputes' 
      AND INDEX_NAME = 'idx_disputes_status_created_at'
    `, [process.env.DB_NAME || 'campus_trading']);

    if (indexes.length > 0) {
      console.log('ℹ️  复合索引 idx_disputes_status_created_at 已存在，跳过创建');
    } else {
      // 添加复合索引：status + created_at，用于优化按状态筛选和排序的查询
      await connection.execute(`
        CREATE INDEX idx_disputes_status_created_at 
        ON disputes(status, created_at DESC)
      `);
      console.log('✅ 复合索引 idx_disputes_status_created_at 创建成功');
    }

    console.log('\n✅ 所有操作完成！');
  } catch (error) {
    console.error('❌ 添加索引失败:', error.message);
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
  addDisputesIndexes();
}

module.exports = addDisputesIndexes;

