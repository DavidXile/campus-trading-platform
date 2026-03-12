const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdmin() {
  let connection;

  try {
    // 连接到数据库
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'campus_trading'
    });

    console.log('✅ 连接到数据库成功');

    const email = '1230016747@student.must.edu.mo';
    const password = 'xile2004';
    const username = 'admin'; // 可以自定义用户名

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
      console.log('✅ role 字段已添加');
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
      console.log(`✅ 用户 ${email} 已存在，已更新为管理员角色`);
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
      console.log(`   用户ID: ${result.insertId}`);
      console.log(`   角色: admin`);
    }

  } catch (error) {
    console.error('❌ 创建管理员账户失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 执行创建
createAdmin();

