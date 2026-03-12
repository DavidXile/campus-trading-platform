const mysql = require('mysql2/promise');
require('dotenv').config();

async function addBanExpiresAtField() {
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

    // 检查 ban_expires_at 字段是否存在
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'ban_expires_at'`,
      [dbName]
    );

    if (columns.length > 0) {
      console.log('ℹ️  ban_expires_at 字段已存在，跳过');
      return;
    }

    // 检查 banned_at 字段是否存在，以确定添加位置
    const [bannedAtCol] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'banned_at'`,
      [dbName]
    );

    // 添加 ban_expires_at 字段
    if (bannedAtCol.length > 0) {
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN ban_expires_at TIMESTAMP NULL COMMENT '封禁到期时间（NULL表示永久封禁）' AFTER banned_at
      `);
    } else {
      // 如果没有 banned_at，检查 ban_reason
      const [banReasonCol] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'ban_reason'`,
        [dbName]
      );
      
      if (banReasonCol.length > 0) {
        await connection.execute(`
          ALTER TABLE users
          ADD COLUMN ban_expires_at TIMESTAMP NULL COMMENT '封禁到期时间（NULL表示永久封禁）' AFTER ban_reason
        `);
      } else {
        // 如果都没有，检查 is_banned
        const [isBannedCol] = await connection.execute(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_banned'`,
          [dbName]
        );
        
        if (isBannedCol.length > 0) {
          await connection.execute(`
            ALTER TABLE users
            ADD COLUMN ban_expires_at TIMESTAMP NULL COMMENT '封禁到期时间（NULL表示永久封禁）' AFTER is_banned
          `);
        } else {
          await connection.execute(`
            ALTER TABLE users
            ADD COLUMN ban_expires_at TIMESTAMP NULL COMMENT '封禁到期时间（NULL表示永久封禁）'
          `);
        }
      }
    }

    console.log('✅ 已添加 ban_expires_at 字段');

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
  addBanExpiresAtField();
}

module.exports = addBanExpiresAtField;

