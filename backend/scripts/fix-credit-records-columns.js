const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixCreditRecordsColumns() {
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

    // 检查需要添加的列是否存在
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'credit_records' 
       AND COLUMN_NAME IN ('score_before', 'score_after', 'related_dispute_id', 'description')`,
      [process.env.DB_NAME || 'campus_trading']
    );

    const existingColumns = columns.map(col => col.COLUMN_NAME);

    // 添加缺失的列
    if (!existingColumns.includes('score_before')) {
      await connection.execute(`
        ALTER TABLE credit_records 
        ADD COLUMN score_before INT NOT NULL DEFAULT 0 COMMENT '变更前信用分' AFTER change_amount
      `);
      console.log('✅ 添加 score_before 列成功');
    } else {
      console.log('ℹ️  score_before 列已存在，跳过');
    }

    if (!existingColumns.includes('score_after')) {
      await connection.execute(`
        ALTER TABLE credit_records 
        ADD COLUMN score_after INT NOT NULL DEFAULT 0 COMMENT '变更后信用分' AFTER score_before
      `);
      console.log('✅ 添加 score_after 列成功');
    } else {
      console.log('ℹ️  score_after 列已存在，跳过');
    }

    if (!existingColumns.includes('related_dispute_id')) {
      // 先检查是否有外键约束需要添加
      await connection.execute(`
        ALTER TABLE credit_records 
        ADD COLUMN related_dispute_id INT NULL COMMENT '关联的纠纷ID' AFTER score_after
      `);
      
      // 添加外键约束
      try {
        await connection.execute(`
          ALTER TABLE credit_records 
          ADD CONSTRAINT fk_credit_records_dispute 
          FOREIGN KEY (related_dispute_id) REFERENCES disputes(id) ON DELETE SET NULL
        `);
        console.log('✅ 添加 related_dispute_id 列和外键约束成功');
      } catch (fkError) {
        // 如果外键已存在或创建失败，只记录警告
        if (fkError.code === 'ER_DUP_KEYNAME' || fkError.code === 'ER_FK_DUP_NAME') {
          console.log('ℹ️  related_dispute_id 外键已存在，跳过');
        } else {
          console.log('⚠️  添加 related_dispute_id 外键失败（可能已存在）:', fkError.message);
        }
      }
    } else {
      console.log('ℹ️  related_dispute_id 列已存在，跳过');
    }

    if (!existingColumns.includes('description')) {
      await connection.execute(`
        ALTER TABLE credit_records 
        ADD COLUMN description TEXT NOT NULL COMMENT '变更描述' AFTER related_dispute_id
      `);
      console.log('✅ 添加 description 列成功');
    } else {
      console.log('ℹ️  description 列已存在，跳过');
    }

    console.log('\n✅ 所有操作完成！');
  } catch (error) {
    console.error('❌ 修复 credit_records 表失败:', error.message);
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
  fixCreditRecordsColumns();
}

module.exports = fixCreditRecordsColumns;

