const mysql = require('mysql2/promise');
require('dotenv').config();

async function addUserAvatarField() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'campus_trading'
    });

    console.log('✅ 数据库连接成功');

    const dbName = process.env.DB_NAME || 'campus_trading';

    // 检查avatar字段是否已存在
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'`,
      [dbName]
    );

    if (columns.length > 0) {
      console.log('ℹ️  avatar 字段已存在，跳过');
      return;
    }

    // 添加avatar字段（LONGTEXT类型，用于存储base64图片）
    await connection.execute(`
      ALTER TABLE users
      ADD COLUMN avatar LONGTEXT DEFAULT NULL AFTER college
    `);
    console.log('✅ 已添加 avatar 字段');

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
  addUserAvatarField();
}

module.exports = addUserAvatarField;



