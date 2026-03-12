const mysql = require('mysql2/promise');
require('dotenv').config();

async function alterImageColumn() {
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

    // 查询当前字段信息
    const [columns] = await connection.execute(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'image_url'`,
      [process.env.DB_NAME || 'campus_trading']
    );

    if (columns.length > 0 && columns[0].COLUMN_TYPE.toLowerCase() === 'longtext') {
      console.log('ℹ️  image_url 已经是 LONGTEXT，无需修改');
      return;
    }

    console.log('🔧 正在把 image_url 字段修改为 LONGTEXT ...');
    await connection.execute('ALTER TABLE items MODIFY image_url LONGTEXT NULL');
    console.log('✅ image_url 字段已修改为 LONGTEXT');
  } catch (error) {
    console.error('❌ 修改 image_url 字段失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

if (require.main === module) {
  alterImageColumn();
}

module.exports = alterImageColumn;





