const mysql = require('mysql2/promise');
require('dotenv').config();

async function addConversationPermanentDeleteFields() {
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

    // 检查 permanently_deleted_by_user1 字段是否已存在
    const [columns1] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'permanently_deleted_by_user1'`,
      [dbName]
    );

    if (columns1.length === 0) {
      console.log('🔧 正在添加 permanently_deleted_by_user1 字段...');
      await connection.execute(
        'ALTER TABLE conversations ADD COLUMN permanently_deleted_by_user1 BOOLEAN DEFAULT FALSE COMMENT "用户1是否永久删除此会话"'
      );
      console.log('✅ permanently_deleted_by_user1 字段已添加');
    } else {
      console.log('ℹ️  permanently_deleted_by_user1 字段已存在，跳过');
    }

    // 检查 permanently_deleted_by_user2 字段是否已存在
    const [columns2] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'permanently_deleted_by_user2'`,
      [dbName]
    );

    if (columns2.length === 0) {
      console.log('🔧 正在添加 permanently_deleted_by_user2 字段...');
      await connection.execute(
        'ALTER TABLE conversations ADD COLUMN permanently_deleted_by_user2 BOOLEAN DEFAULT FALSE COMMENT "用户2是否永久删除此会话"'
      );
      console.log('✅ permanently_deleted_by_user2 字段已添加');
    } else {
      console.log('ℹ️  permanently_deleted_by_user2 字段已存在，跳过');
    }

    // 检查 messages 表是否有 deleted_by_user 字段（用于标记消息对某个用户不可见）
    const [msgColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'deleted_by_users'`,
      [dbName]
    );

    if (msgColumns.length === 0) {
      console.log('🔧 正在添加 messages.deleted_by_users 字段...');
      await connection.execute(
        'ALTER TABLE messages ADD COLUMN deleted_by_users JSON NULL COMMENT "永久删除此消息的用户ID列表（JSON数组）"'
      );
      console.log('✅ messages.deleted_by_users 字段已添加');
    } else {
      console.log('ℹ️  messages.deleted_by_users 字段已存在，跳过');
    }

    console.log('\n✅ 所有字段添加完成！');

  } catch (error) {
    console.error('❌ 添加字段失败:', error.message);
    console.error('完整错误:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

if (require.main === module) {
  addConversationPermanentDeleteFields();
}

module.exports = addConversationPermanentDeleteFields;

