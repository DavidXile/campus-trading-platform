const mysql = require('mysql2/promise');
require('dotenv').config();

async function addDisputesCompositeIndexes() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'campus_trading'
    });

    console.log('✅ Connected to database successfully');

    // 检查并创建复合索引 (initiator_id, created_at) - 用于优化按发起者查询和排序
    try {
      await connection.execute(`
        CREATE INDEX idx_disputes_initiator_created 
        ON disputes(initiator_id, created_at DESC)
      `);
      console.log('✅ Composite index idx_disputes_initiator_created created successfully');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Index idx_disputes_initiator_created already exists, skipping');
      } else {
        throw error;
      }
    }

    // 检查并创建复合索引 (respondent_id, created_at) - 用于优化按响应者查询和排序
    try {
      await connection.execute(`
        CREATE INDEX idx_disputes_respondent_created 
        ON disputes(respondent_id, created_at DESC)
      `);
      console.log('✅ Composite index idx_disputes_respondent_created created successfully');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Index idx_disputes_respondent_created already exists, skipping');
      } else {
        throw error;
      }
    }

    console.log('\n✅ All operations completed!');
  } catch (error) {
    console.error('❌ Failed to add indexes:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

if (require.main === module) {
  addDisputesCompositeIndexes();
}

module.exports = addDisputesCompositeIndexes;

