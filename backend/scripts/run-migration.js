const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let connection;

  try {
    // 连接到 MySQL 服务器
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'campus_trading'
    });

    console.log('✅ 连接到数据库成功');

    // 检查 role 字段是否已存在
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'",
      [process.env.DB_NAME || 'campus_trading']
    );

    if (columns.length > 0) {
      console.log('ℹ️  role 字段已存在，跳过迁移');
      return;
    }

    // 读取迁移文件
    const migrationPath = path.join(__dirname, '..', 'database', 'migration_add_role.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // 分割 SQL 语句并执行
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      if (statement.trim() && !statement.trim().startsWith('--') && !statement.trim().startsWith('USE')) {
        await connection.execute(statement);
      }
    }

    console.log('✅ 数据库迁移成功：已添加 role 字段');

  } catch (error) {
    console.error('❌ 数据库迁移失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 只有直接运行此文件时才执行迁移
if (require.main === module) {
  runMigration();
}

module.exports = runMigration;






