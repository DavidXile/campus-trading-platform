const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function fixMySQLAuth() {
  console.log('正在修复MySQL认证方式...\n');
  
  // 确保加载.env文件
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
  
  const password = process.env.DB_PASSWORD || '234009';
  const user = process.env.DB_USER || 'root';
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306');

  console.log(`尝试连接: ${user}@${host}:${port}\n`);
  
  let connection;
  
  try {
    // 先尝试用当前认证方式连接
    connection = await mysql.createConnection({
      host,
      user,
      password: password.trim(),
      port
    });
    
    console.log('✅ 连接成功，检查认证方式...\n');
    
    // 检查当前认证方式
    const [users] = await connection.query(
      "SELECT user, host, plugin FROM mysql.user WHERE user = ? AND host = ?",
      [user, host === 'localhost' ? 'localhost' : '%']
    );
    
    if (users.length > 0) {
      const currentPlugin = users[0].plugin;
      console.log(`当前认证方式: ${currentPlugin}`);
      
      if (currentPlugin !== 'mysql_native_password') {
        console.log('正在修改为 mysql_native_password...\n');
        
        // 修改认证方式
        const hostName = host === 'localhost' ? 'localhost' : '%';
        await connection.query(
          `ALTER USER '${user}'@'${hostName}' IDENTIFIED WITH mysql_native_password BY ?`,
          [password]
        );
        await connection.query('FLUSH PRIVILEGES');
        
        console.log('✅ 认证方式已修改为 mysql_native_password\n');
        console.log('⚠️  请重启MySQL服务以使更改生效！\n');
        console.log('方法: 按 Win+R，输入 services.msc，找到MySQL服务并重启\n');
      } else {
        console.log('✅ 认证方式已经是 mysql_native_password，无需修改\n');
      }
    }
    
    await connection.end();
    return true;
  } catch (error) {
    if (connection) {
      try {
        await connection.end();
      } catch (e) {}
    }
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('❌ 无法连接MySQL，可能是密码错误\n');
      console.log('当前配置:');
      console.log(`  DB_USER: ${user}`);
      console.log(`  DB_PASSWORD: ${password ? '***已设置***' : '未设置'}`);
      console.log(`  DB_HOST: ${host}`);
      console.log(`  DB_PORT: ${port}\n`);
      console.log('请检查 backend/.env 文件中的 DB_PASSWORD 是否正确\n');
      console.log('如果密码是 234009，请确保 .env 文件中没有引号或多余空格\n');
      return false;
    } else {
      console.log(`❌ 错误: ${error.message}\n`);
      return false;
    }
  }
}

if (require.main === module) {
  fixMySQLAuth().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { fixMySQLAuth };

