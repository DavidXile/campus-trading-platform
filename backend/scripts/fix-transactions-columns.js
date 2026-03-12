const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixTransactionsColumns() {
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

    const dbName = process.env.DB_NAME || 'campus_trading';

    // 检查 transactions 表是否存在
    const [tables] = await connection.execute(
      `SHOW TABLES LIKE 'transactions'`
    );

    if (tables.length === 0) {
      console.log('ℹ️  transactions 表不存在，请先运行 create-payment-credit-tables 脚本');
      return;
    }

    // 检查现有字段
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'transactions'`,
      [dbName]
    );

    const columnNames = columns.map(col => col.COLUMN_NAME);
    console.log('当前 transactions 表的字段:', columnNames.join(', '));

    // 添加缺失的字段
    if (!columnNames.includes('related_item_id')) {
      console.log('🔧 正在添加 related_item_id 字段...');
      await connection.execute(`
        ALTER TABLE transactions 
        ADD COLUMN related_item_id INT NULL COMMENT '关联的商品ID' AFTER balance_after
      `);
      await connection.execute(`
        ALTER TABLE transactions 
        ADD FOREIGN KEY (related_item_id) REFERENCES items(id) ON DELETE SET NULL
      `);
      console.log('✅ related_item_id 字段添加成功');
    } else {
      console.log('ℹ️  related_item_id 字段已存在');
    }

    if (!columnNames.includes('related_dispute_id')) {
      console.log('🔧 正在添加 related_dispute_id 字段...');
      await connection.execute(`
        ALTER TABLE transactions 
        ADD COLUMN related_dispute_id INT NULL COMMENT '关联的纠纷ID' AFTER related_item_id
      `);
      await connection.execute(`
        ALTER TABLE transactions 
        ADD FOREIGN KEY (related_dispute_id) REFERENCES disputes(id) ON DELETE SET NULL
      `);
      console.log('✅ related_dispute_id 字段添加成功');
    } else {
      console.log('ℹ️  related_dispute_id 字段已存在');
    }

    if (!columnNames.includes('related_errand_id')) {
      console.log('🔧 正在添加 related_errand_id 字段...');
      await connection.execute(`
        ALTER TABLE transactions 
        ADD COLUMN related_errand_id INT NULL COMMENT '关联的跑腿任务ID' AFTER related_dispute_id
      `);
      await connection.execute(`
        ALTER TABLE transactions 
        ADD FOREIGN KEY (related_errand_id) REFERENCES errands(id) ON DELETE SET NULL
      `);
      console.log('✅ related_errand_id 字段添加成功');
    } else {
      console.log('ℹ️  related_errand_id 字段已存在');
    }

    console.log('\n✅ 所有操作完成！');

  } catch (error) {
    console.error('❌ 修复 transactions 表字段失败:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  字段已存在，跳过');
    } else {
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

if (require.main === module) {
  fixTransactionsColumns();
}

module.exports = fixTransactionsColumns;

