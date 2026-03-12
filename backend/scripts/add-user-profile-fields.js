const mysql = require('mysql2/promise');
require('dotenv').config();

async function addUserProfileFields() {
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

    const hasColumn = async (columnName) => {
      const [columns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
        [dbName, columnName]
      );
      return columns.length > 0;
    };

    const missingPhone = !(await hasColumn('phone'));
    const missingCollege = !(await hasColumn('college'));

    if (!missingPhone && !missingCollege) {
      console.log('ℹ️  phone 与 college 字段已存在，跳过');
      return;
    }

    if (missingPhone) {
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN phone VARCHAR(20) DEFAULT NULL AFTER password_hash
      `);
      console.log('✅ 已添加 phone 字段');
    }

    if (missingCollege) {
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN college VARCHAR(100) DEFAULT NULL AFTER phone
      `);
      console.log('✅ 已添加 college 字段');
    }

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
  addUserProfileFields();
}

module.exports = addUserProfileFields;


