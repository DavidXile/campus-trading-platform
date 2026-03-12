const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixCreditScoreDefaults() {
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

    // 检查 credit_score 字段是否存在
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'credit_score'`,
      [process.env.DB_NAME || 'campus_trading']
    );

    if (columns.length === 0) {
      console.log('ℹ️  credit_score 字段不存在，请先运行 create-payment-credit-tables 脚本');
      return;
    }

    // 更新所有 credit_score 为 NULL 的用户，设置为默认值 100
    const [result] = await connection.execute(
      `UPDATE users 
       SET credit_score = 100 
       WHERE credit_score IS NULL`
    );

    console.log(`✅ 已更新 ${result.affectedRows} 个用户的信用分为默认值 100`);

    // 确保字段有默认值
    if (columns[0].COLUMN_DEFAULT === null) {
      await connection.execute(`
        ALTER TABLE users 
        MODIFY COLUMN credit_score INT DEFAULT 100 COMMENT '信用分（0-100）'
      `);
      console.log('✅ 已设置 credit_score 字段的默认值为 100');
    } else {
      console.log('ℹ️  credit_score 字段已有默认值，跳过');
    }

    console.log('\n✅ 所有操作完成！');
  } catch (error) {
    console.error('❌ 修复信用分默认值失败:', error.message);
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
  fixCreditScoreDefaults();
}

module.exports = fixCreditScoreDefaults;

