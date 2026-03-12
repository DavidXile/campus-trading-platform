const mysql = require('mysql2/promise');
require('dotenv').config();

async function addErrandFirstConfirmedAt() {
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

    const dbName = process.env.DB_NAME || 'campus_trading';

    // 检查 first_confirmed_at 字段是否已存在
    const [col] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'errands' AND COLUMN_NAME = 'first_confirmed_at'`,
      [dbName]
    );

    if (col.length === 0) {
      console.log('🔧 正在添加 first_confirmed_at 字段...');
      await connection.execute(`
        ALTER TABLE errands
        ADD COLUMN first_confirmed_at TIMESTAMP NULL DEFAULT NULL AFTER confirmed_by_accepter
      `);
      console.log('✅ first_confirmed_at 字段已添加');
    } else {
      console.log('ℹ️  first_confirmed_at 字段已存在，跳过');
    }

    console.log('\n✅ 所有字段添加完成！');

  } catch (error) {
    console.error('❌ 添加字段失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

if (require.main === module) {
  addErrandFirstConfirmedAt();
}

module.exports = addErrandFirstConfirmedAt;

