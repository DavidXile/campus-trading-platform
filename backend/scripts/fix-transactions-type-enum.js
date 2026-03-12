const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixTransactionsTypeEnum() {
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

    // 检查 transactions 表是否存在
    const [tables] = await connection.execute(
      `SHOW TABLES LIKE 'transactions'`
    );

    if (tables.length === 0) {
      console.log('ℹ️  transactions 表不存在，请先运行 create-payment-credit-tables 脚本');
      return;
    }

    // 检查当前 type 字段的定义
    const [columns] = await connection.execute(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'type'`,
      [process.env.DB_NAME || 'campus_trading']
    );

    if (columns.length === 0) {
      console.log('ℹ️  transactions.type 字段不存在');
      return;
    }

    const currentType = columns[0].COLUMN_TYPE;
    console.log(`当前 type 字段定义: ${currentType}`);

    // 检查是否包含 'credit_adjustment'
    if (currentType.includes('credit_adjustment')) {
      console.log('ℹ️  type 字段已包含 credit_adjustment，无需修改');
      return;
    }

    // 修改 ENUM 定义，添加 'credit_adjustment'
    console.log('🔧 正在修改 transactions.type 字段，添加 credit_adjustment...');
    
    // 先检查是否还需要添加其他值
    const requiredValues = ['purchase', 'refund', 'partial_refund', 'credit_adjustment', 'deposit', 'errand_reward'];
    
    await connection.execute(`
      ALTER TABLE transactions 
      MODIFY COLUMN type ENUM('purchase', 'refund', 'partial_refund', 'credit_adjustment', 'deposit', 'errand_reward') NOT NULL COMMENT '交易类型'
    `);

    console.log('✅ transactions.type 字段已更新，现在包含: purchase, refund, partial_refund, credit_adjustment, deposit, errand_reward');

  } catch (error) {
    console.error('❌ 修改 transactions.type 字段失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

if (require.main === module) {
  fixTransactionsTypeEnum();
}

module.exports = fixTransactionsTypeEnum;

