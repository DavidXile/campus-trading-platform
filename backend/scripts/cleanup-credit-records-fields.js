const mysql = require('mysql2/promise');
require('dotenv').config();

async function cleanupCreditRecordsFields() {
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
      console.log('ℹ️  credit_records 表不存在');
      return;
    }

    // 获取所有列名
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'credit_records'`,
      [process.env.DB_NAME || 'campus_trading']
    );

    const columnNames = columns.map(col => col.COLUMN_NAME);

    // 需要删除的旧字段
    const fieldsToRemove = ['credit_before', 'credit_after', 'dispute_id', 'reason'];

    // 检查并删除旧字段
    for (const fieldName of fieldsToRemove) {
      if (columnNames.includes(fieldName)) {
        try {
          // 先检查是否有外键约束
          if (fieldName === 'dispute_id') {
            // 查找所有外键约束
            const [constraints] = await connection.execute(`
              SELECT CONSTRAINT_NAME 
              FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
              WHERE TABLE_SCHEMA = ? 
              AND TABLE_NAME = 'credit_records' 
              AND COLUMN_NAME = 'dispute_id'
              AND REFERENCED_TABLE_NAME IS NOT NULL
            `, [process.env.DB_NAME || 'campus_trading']);
            
            // 删除所有相关的外键约束
            for (const constraint of constraints) {
              try {
                await connection.execute(`
                  ALTER TABLE credit_records 
                  DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}
                `);
                console.log(`✅ 删除 dispute_id 外键约束 ${constraint.CONSTRAINT_NAME} 成功`);
              } catch (fkError) {
                console.log(`⚠️  删除外键约束失败: ${fkError.message}`);
              }
            }
          }

          await connection.execute(`
            ALTER TABLE credit_records 
            DROP COLUMN ${fieldName}
          `);
          console.log(`✅ 删除 ${fieldName} 字段成功`);
        } catch (error) {
          console.error(`❌ 删除 ${fieldName} 字段失败:`, error.message);
        }
      } else {
        console.log(`ℹ️  ${fieldName} 字段不存在，跳过`);
      }
    }

    console.log('\n✅ 清理完成！');
  } catch (error) {
    console.error('❌ 清理字段失败:', error.message);
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
  cleanupCreditRecordsFields();
}

module.exports = cleanupCreditRecordsFields;

