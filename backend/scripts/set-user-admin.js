const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * 将指定用户设置为管理员
 * 使用方法: node scripts/set-user-admin.js [userId]
 * 如果不提供userId，默认设置为用户ID 1
 */
async function setUserAdmin() {
  let connection;

  try {
    // 从命令行参数获取用户ID，默认为1
    const userId = process.argv[2] || 1;

    // 连接到数据库
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'campus_trading'
    });

    console.log('✅ 连接到数据库成功\n');

    // 检查用户是否存在
    const [users] = await connection.execute(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      console.error(`❌ 用户ID ${userId} 不存在`);
      process.exit(1);
    }

    const user = users[0];
    console.log(`当前用户信息:`);
    console.log(`  用户ID: ${user.id}`);
    console.log(`  用户名: ${user.username}`);
    console.log(`  邮箱: ${user.email}`);
    console.log(`  当前角色: ${user.role || 'user'}\n`);

    // 检查 role 字段是否存在
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'",
      [process.env.DB_NAME || 'campus_trading']
    );

    if (columns.length === 0) {
      console.log('⚠️  检测到 role 字段不存在，正在添加...');
      await connection.execute(
        "ALTER TABLE users ADD COLUMN role ENUM('user', 'admin') DEFAULT 'user' AFTER password_hash"
      );
      await connection.execute(
        "CREATE INDEX idx_users_role ON users(role)"
      );
      console.log('✅ role 字段已添加\n');
    }

    // 更新用户角色为管理员
    await connection.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      ['admin', userId]
    );

    console.log(`✅ 用户 ${user.username} (ID: ${userId}) 已成功设置为管理员！\n`);
    console.log('现在该用户可以访问管理后台了。');

  } catch (error) {
    console.error('❌ 设置管理员失败:', error.message);
    console.error('完整错误:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行
if (require.main === module) {
  setUserAdmin();
}

module.exports = setUserAdmin;

