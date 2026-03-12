const mysql = require('mysql2/promise');
require('dotenv').config();

async function addErrandConfirmationFields() {
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

    // 检查 confirmed_by_publisher 字段是否已存在
    const [col1] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'errands' AND COLUMN_NAME = 'confirmed_by_publisher'`,
      [dbName]
    );

    if (col1.length === 0) {
      console.log('🔧 正在添加 confirmed_by_publisher 字段...');
      await connection.execute(`
        ALTER TABLE errands
        ADD COLUMN confirmed_by_publisher BOOLEAN DEFAULT FALSE AFTER completed_at
      `);
      console.log('✅ confirmed_by_publisher 字段已添加');
    } else {
      console.log('ℹ️  confirmed_by_publisher 字段已存在，跳过');
    }

    // 检查 confirmed_by_accepter 字段是否已存在
    const [col2] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'errands' AND COLUMN_NAME = 'confirmed_by_accepter'`,
      [dbName]
    );

    if (col2.length === 0) {
      console.log('🔧 正在添加 confirmed_by_accepter 字段...');
      await connection.execute(`
        ALTER TABLE errands
        ADD COLUMN confirmed_by_accepter BOOLEAN DEFAULT FALSE AFTER confirmed_by_publisher
      `);
      console.log('✅ confirmed_by_accepter 字段已添加');
    } else {
      console.log('ℹ️  confirmed_by_accepter 字段已存在，跳过');
    }

    console.log('\n✅ 所有字段添加完成！');

  } catch (error) {
    console.error('❌ 添加跑腿确认字段失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

if (require.main === module) {
  addErrandConfirmationFields();
}

module.exports = addErrandConfirmationFields;

