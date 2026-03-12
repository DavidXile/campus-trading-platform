const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkCreditScores() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'campus_trading'
    });

    console.log('✅ 连接到数据库成功\n');

    const [users] = await connection.execute(
      'SELECT id, username, credit_score, COALESCE(credit_score, 100) as credit_score_display FROM users ORDER BY id'
    );

    console.log('用户信用分列表:');
    console.log('='.repeat(60));
    users.forEach(u => {
      console.log(`ID: ${u.id.toString().padEnd(3)} | 用户名: ${(u.username || '').padEnd(15)} | 信用分: ${u.credit_score === null ? 'NULL' : u.credit_score.toString().padEnd(3)} | 显示值: ${u.credit_score_display}`);
    });
    console.log('='.repeat(60));

    // 检查最近的信用记录
    console.log('\n最近的信用记录:');
    console.log('='.repeat(60));
    const [records] = await connection.execute(
      `SELECT user_id, change_type, change_amount, score_before, score_after, description, created_at 
       FROM credit_records 
       ORDER BY created_at DESC 
       LIMIT 10`
    );
    records.forEach(r => {
      console.log(`用户ID: ${r.user_id} | 类型: ${r.change_type} | 变化: ${r.change_amount > 0 ? '+' : ''}${r.change_amount} | ${r.score_before} → ${r.score_after} | ${r.description}`);
    });
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    console.error(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  checkCreditScores();
}

module.exports = checkCreditScores;

