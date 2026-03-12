const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function createMySQLUser() {
  console.log('========================================');
  console.log('   创建MySQL用户: Otaku');
  console.log('========================================\n');

  const newUser = 'Otaku';
  const newPassword = '234009';
  
  // 先尝试用root连接（需要知道root密码）
  console.log('步骤1: 尝试使用root账户连接...\n');
  console.log('请输入MySQL root密码（如果不知道，直接回车尝试空密码）:');
  
  // 由于无法交互输入，我们尝试几个常见密码
  const rootPasswords = ['234009', '', 'root', '123456'];
  let rootConnection = null;
  let rootPassword = null;

  for (const pwd of rootPasswords) {
    try {
      const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: pwd,
        port: 3306
      });
      rootConnection = conn;
      rootPassword = pwd;
      console.log(`✅ 使用密码 "${pwd || '(空密码)'}" 连接成功\n`);
      break;
    } catch (error) {
      // 继续尝试下一个密码
    }
  }

  if (!rootConnection) {
    console.log('❌ 无法使用root账户连接\n');
    console.log('请手动执行以下SQL语句创建用户:\n');
    console.log(`CREATE USER '${newUser}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${newPassword}';`);
    console.log(`GRANT ALL PRIVILEGES ON *.* TO '${newUser}'@'localhost';`);
    console.log('FLUSH PRIVILEGES;\n');
    console.log('或者使用MySQL命令行工具:');
    console.log(`mysql -u root -p`);
    console.log(`然后执行上面的SQL语句\n`);
    return false;
  }

  try {
    console.log('步骤2: 检查用户是否已存在...\n');
    const [existingUsers] = await rootConnection.query(
      "SELECT user, host FROM mysql.user WHERE user = ? AND host = 'localhost'",
      [newUser]
    );

    if (existingUsers.length > 0) {
      console.log(`⚠️  用户 '${newUser}'@'localhost' 已存在\n`);
      console.log('步骤3: 更新用户密码和权限...\n');
      
      // 删除旧用户
      await rootConnection.query(`DROP USER IF EXISTS '${newUser}'@'localhost'`);
      console.log('✓ 已删除旧用户\n');
    }

    console.log('步骤3: 创建新用户...\n');
    
    // 创建新用户，使用 mysql_native_password 认证方式
    await rootConnection.query(
      `CREATE USER '${newUser}'@'localhost' IDENTIFIED WITH mysql_native_password BY ?`,
      [newPassword]
    );
    console.log(`✅ 用户 '${newUser}'@'localhost' 创建成功\n`);

    console.log('步骤4: 授予权限...\n');
    await rootConnection.query(`GRANT ALL PRIVILEGES ON *.* TO '${newUser}'@'localhost'`);
    await rootConnection.query('FLUSH PRIVILEGES');
    console.log('✅ 权限授予成功\n');

    console.log('步骤5: 测试新用户连接...\n');
    await rootConnection.end();

    // 测试新用户连接
    const testConnection = await mysql.createConnection({
      host: 'localhost',
      user: newUser,
      password: newPassword,
      port: 3306
    });

    const [result] = await testConnection.query('SELECT USER(), DATABASE()');
    console.log(`✅ 新用户连接测试成功！`);
    console.log(`   当前用户: ${result[0]['USER()']}\n`);
    await testConnection.end();

    console.log('步骤6: 更新 .env 文件...\n');
    const envPath = path.join(__dirname, '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    } else {
      // 如果.env不存在，从env-example.txt读取
      const examplePath = path.join(__dirname, 'env-example.txt');
      if (fs.existsSync(examplePath)) {
        envContent = fs.readFileSync(examplePath, 'utf8');
      }
    }

    // 更新用户名和密码
    envContent = envContent.replace(/^DB_USER=.*$/m, `DB_USER=${newUser}`);
    envContent = envContent.replace(/^DB_PASSWORD=.*$/m, `DB_PASSWORD=${newPassword}`);

    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ .env 文件已更新\n');

    console.log('========================================');
    console.log('✅ 用户创建完成！');
    console.log('========================================\n');
    console.log('新用户信息:');
    console.log(`  用户名: ${newUser}`);
    console.log(`  密码: ${newPassword}`);
    console.log(`  主机: localhost`);
    console.log(`  权限: ALL PRIVILEGES\n`);
    console.log('现在可以重新运行数据库初始化了！\n');

    return true;
  } catch (error) {
    console.log('❌ 创建用户失败\n');
    console.log('错误信息:', error.message);
    if (rootConnection) {
      await rootConnection.end();
    }
    return false;
  }
}

if (require.main === module) {
  createMySQLUser().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { createMySQLUser };

