const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkCreditRecordsStructure() {
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

    // 获取表结构
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'credit_records'
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'campus_trading']
    );

    console.log('\n📋 credit_records 表结构:');
    console.log('='.repeat(80));
    columns.forEach(col => {
      console.log(`${col.COLUMN_NAME.padEnd(25)} ${col.COLUMN_TYPE.padEnd(30)} NULL=${col.IS_NULLABLE} DEFAULT=${col.COLUMN_DEFAULT || 'NULL'} ${col.COLUMN_COMMENT || ''}`);
    });
    console.log('='.repeat(80));

    // 检查是否有 credit_before 字段
    const hasCreditBefore = columns.some(col => col.COLUMN_NAME === 'credit_before');
    const hasScoreBefore = columns.some(col => col.COLUMN_NAME === 'score_before');

    if (hasCreditBefore && !hasScoreBefore) {
      console.log('\n⚠️  发现 credit_before 字段，但代码使用的是 score_before');
      console.log('需要将 credit_before 重命名为 score_before');
    } else if (hasCreditBefore && hasScoreBefore) {
      console.log('\n⚠️  同时存在 credit_before 和 score_before 字段');
      console.log('需要删除 credit_before 字段');
    } else if (!hasCreditBefore && hasScoreBefore) {
      console.log('\n✅ 字段名称正确，使用 score_before');
    } else {
      console.log('\n⚠️  既没有 credit_before 也没有 score_before 字段');
    }

  } catch (error) {
    console.error('❌ 检查表结构失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

if (require.main === module) {
  checkCreditRecordsStructure();
}

module.exports = checkCreditRecordsStructure;

