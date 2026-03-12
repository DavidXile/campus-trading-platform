const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createDefaultAdmin() {
  let connection;

  try {
    console.log('========================================');
    console.log('   创建默认管理员账户');
    console.log('========================================\n');

    // 连接到数据库
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'campus_trading'
    });

    console.log('✅ 连接到数据库成功\n');

    // 默认管理员账户信息
    const email = 'admin@campus.trading';
    const password = 'admin123456';
    const username = 'admin';

    // 检查数据库是否存在
    try {
      await connection.query('USE ' + (process.env.DB_NAME || 'campus_trading'));
    } catch (error) {
      console.log('⚠️  数据库不存在，请先运行数据库初始化\n');
      return false;
    }

    // 检查 users 表是否存在
    try {
      await connection.query('SELECT 1 FROM users LIMIT 1');
    } catch (error) {
      console.log('⚠️  users 表不存在，请先运行数据库初始化\n');
      return false;
    }

    // 先检查 role 字段是否存在，如果不存在则添加
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'",
      [process.env.DB_NAME || 'campus_trading']
    );

    if (columns.length === 0) {
      console.log('⚠️  检测到 role 字段不存在，正在添加...');
      await connection.execute(
        "ALTER TABLE users ADD COLUMN role ENUM('user', 'admin') DEFAULT 'user' AFTER password_hash"
      );
      // 检查索引是否已存在
      const [indexes] = await connection.execute(
        "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_role'",
        [process.env.DB_NAME || 'campus_trading']
      );
      if (indexes.length === 0) {
        await connection.execute(
          "CREATE INDEX idx_users_role ON users(role)"
        );
      }
      console.log('✅ role 字段已添加\n');
    }

    // 检查用户是否已存在
    const [existingUsers] = await connection.execute(
      'SELECT id, role FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      // 用户已存在，更新为管理员
      const userId = existingUsers[0].id;
      await connection.execute(
        'UPDATE users SET role = ? WHERE id = ?',
        ['admin', userId]
      );
      console.log(`✅ 用户已存在，已更新为管理员角色`);
      console.log(`   邮箱: ${email}`);
      console.log(`   密码: ${password}`);
      console.log(`   角色: admin\n`);
    } else {
      // 创建新用户
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // 插入新用户（直接设置为管理员）
      const [result] = await connection.execute(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, 'admin']
      );

      console.log(`✅ 管理员账户创建成功！`);
      console.log(`   用户名: ${username}`);
      console.log(`   邮箱: ${email}`);
      console.log(`   密码: ${password}`);
      console.log(`   用户ID: ${result.insertId}`);
      console.log(`   角色: admin\n`);
    }

    console.log('========================================');
    console.log('✅ 管理员账户准备就绪');
    console.log('========================================\n');
    console.log('登录信息:');
    console.log(`  邮箱: ${email}`);
    console.log(`  密码: ${password}\n`);
    console.log('可以使用此账户登录管理后台。\n');

    return true;

  } catch (error) {
    console.error('❌ 创建管理员账户失败:', error.message);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('   提示: 请先运行数据库初始化 (npm run init-db-complete)\n');
    }
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行创建
if (require.main === module) {
  createDefaultAdmin().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { createDefaultAdmin };

