const fs = require('fs');
const path = require('path');

const envContent = `# 数据库配置
DB_HOST=localhost
DB_USER=Otaku
DB_PASSWORD=234009
DB_NAME=campus_trading
DB_PORT=3306

# JWT 配置
JWT_SECRET=campus_trading_jwt_secret_key_2024

# 服务器配置
PORT=5000
NODE_ENV=development
`;

const envPath = path.join(__dirname, '.env');

try {
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('✅ .env 文件创建成功！');
  console.log('\n配置内容:');
  console.log('  数据库用户: Otaku');
  console.log('  数据库密码: 234009');
  console.log('  服务端口: 5000\n');
} catch (error) {
  console.log('❌ 创建 .env 文件失败:', error.message);
  process.exit(1);
}

