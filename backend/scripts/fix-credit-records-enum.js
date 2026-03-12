const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixCreditRecordsEnum() {
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

    // 检查 credit_records 表是否存在
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'credit_records'",
      [process.env.DB_NAME || 'campus_trading']
    );

    if (tables.length === 0) {
      console.log('ℹ️  credit_records 表不存在，请先运行 create-payment-credit-tables 脚本');
      return;
    }

    // 获取当前的 ENUM 定义
    const [columns] = await connection.execute(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'credit_records' AND COLUMN_NAME = 'change_type'`,
      [process.env.DB_NAME || 'campus_trading']
    );

    if (columns.length === 0) {
      console.log('ℹ️  change_type 列不存在');
      return;
    }

    const currentEnum = columns[0].COLUMN_TYPE;
    console.log('当前 ENUM 定义:', currentEnum);

    // 定义需要的所有 ENUM 值
    const requiredValues = [
      'dispute_penalty',
      'dispute_reward',
      'ban_penalty',
      'admin_adjustment',
      'appeal_rejected'
    ];

    // 检查是否所有值都已存在
    const enumValues = currentEnum.match(/'([^']+)'/g)?.map(v => v.replace(/'/g, '')) || [];
    const missingValues = requiredValues.filter(v => !enumValues.includes(v));

    if (missingValues.length === 0) {
      console.log('✅ 所有必需的 ENUM 值都已存在');
      return;
    }

    console.log('缺失的 ENUM 值:', missingValues);

    // 构建新的 ENUM 定义（合并现有值和缺失值）
    const allValues = [...new Set([...enumValues, ...requiredValues])];
    const newEnum = `ENUM('${allValues.join("','")}')`;

    console.log('新的 ENUM 定义:', newEnum);

    // 更新 ENUM 定义
    await connection.execute(`
      ALTER TABLE credit_records 
      MODIFY COLUMN change_type ${newEnum} NOT NULL COMMENT '变更类型'
    `);

    console.log('✅ ENUM 定义更新成功');

    console.log('\n✅ 所有操作完成！');
  } catch (error) {
    console.error('❌ 修复 ENUM 失败:', error.message);
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
  fixCreditRecordsEnum();
}

module.exports = fixCreditRecordsEnum;

