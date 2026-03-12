const mysql = require('mysql2/promise');
require('dotenv').config();

async function createPaymentAndCreditTables() {
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

    // 1. 为用户表添加钱包余额和信用分字段
    console.log('🔧 正在为用户表添加钱包余额和信用分字段...');
    try {
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN wallet_balance DECIMAL(10, 2) DEFAULT 0.00 COMMENT '钱包余额' AFTER role,
        ADD COLUMN credit_score INT DEFAULT 100 COMMENT '信用分（0-100）' AFTER wallet_balance,
        ADD COLUMN is_banned BOOLEAN DEFAULT FALSE COMMENT '是否被封禁' AFTER credit_score,
        ADD COLUMN ban_reason TEXT NULL COMMENT '封禁原因' AFTER is_banned,
        ADD COLUMN banned_at TIMESTAMP NULL COMMENT '封禁时间' AFTER ban_reason,
        ADD COLUMN ban_expires_at TIMESTAMP NULL COMMENT '封禁到期时间（NULL表示永久封禁）' AFTER banned_at
      `);
      console.log('✅ 用户表字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  用户表字段已存在，跳过');
      } else {
        throw error;
      }
    }

    // 2. 创建交易记录表
    console.log('🔧 正在创建交易记录表...');
    const [transactionsTable] = await connection.execute(
      `SHOW TABLES LIKE 'transactions'`
    );

    if (transactionsTable.length === 0) {
      await connection.execute(`
        CREATE TABLE transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL COMMENT '用户ID',
          type ENUM('purchase', 'refund', 'partial_refund', 'credit_adjustment') NOT NULL COMMENT '交易类型',
          amount DECIMAL(10, 2) NOT NULL COMMENT '交易金额（正数为收入，负数为支出）',
          balance_before DECIMAL(10, 2) NOT NULL COMMENT '交易前余额',
          balance_after DECIMAL(10, 2) NOT NULL COMMENT '交易后余额',
          related_item_id INT NULL COMMENT '关联的商品ID',
          related_dispute_id INT NULL COMMENT '关联的纠纷ID',
          description TEXT NOT NULL COMMENT '交易描述',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (related_item_id) REFERENCES items(id) ON DELETE SET NULL,
          FOREIGN KEY (related_dispute_id) REFERENCES disputes(id) ON DELETE SET NULL,
          INDEX idx_transactions_user_id (user_id),
          INDEX idx_transactions_type (type),
          INDEX idx_transactions_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ 交易记录表创建成功');
    } else {
      console.log('ℹ️  交易记录表已存在，跳过创建');
    }

    // 3. 创建信用记录表
    console.log('🔧 正在创建信用记录表...');
    const [creditRecordsTable] = await connection.execute(
      `SHOW TABLES LIKE 'credit_records'`
    );

    if (creditRecordsTable.length === 0) {
      await connection.execute(`
        CREATE TABLE credit_records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL COMMENT '用户ID',
          change_type ENUM('dispute_penalty', 'dispute_reward', 'ban_penalty', 'admin_adjustment', 'appeal_rejected') NOT NULL COMMENT '变更类型',
          change_amount INT NOT NULL COMMENT '变更数量（正数为增加，负数为扣减）',
          score_before INT NOT NULL COMMENT '变更前信用分',
          score_after INT NOT NULL COMMENT '变更后信用分',
          related_dispute_id INT NULL COMMENT '关联的纠纷ID',
          description TEXT NOT NULL COMMENT '变更描述',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (related_dispute_id) REFERENCES disputes(id) ON DELETE SET NULL,
          INDEX idx_credit_records_user_id (user_id),
          INDEX idx_credit_records_type (change_type),
          INDEX idx_credit_records_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ 信用记录表创建成功');
    } else {
      console.log('ℹ️  信用记录表已存在，跳过创建');
    }

    // 4. 创建封禁记录表
    console.log('🔧 正在创建封禁记录表...');
    const [banRecordsTable] = await connection.execute(
      `SHOW TABLES LIKE 'ban_records'`
    );

    if (banRecordsTable.length === 0) {
      await connection.execute(`
        CREATE TABLE ban_records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL COMMENT '被封禁用户ID',
          admin_id INT NULL COMMENT '执行封禁的管理员ID',
          reason TEXT NOT NULL COMMENT '封禁原因',
          ban_type ENUM('temporary', 'permanent') NOT NULL COMMENT '封禁类型',
          banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '封禁时间',
          expires_at TIMESTAMP NULL COMMENT '到期时间（NULL表示永久封禁）',
          is_active BOOLEAN DEFAULT TRUE COMMENT '是否生效',
          lifted_at TIMESTAMP NULL COMMENT '解封时间',
          lifted_by INT NULL COMMENT '解封管理员ID',
          related_dispute_id INT NULL COMMENT '关联的纠纷ID',
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (lifted_by) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (related_dispute_id) REFERENCES disputes(id) ON DELETE SET NULL,
          INDEX idx_ban_records_user_id (user_id),
          INDEX idx_ban_records_active (is_active),
          INDEX idx_ban_records_created_at (banned_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ 封禁记录表创建成功');
    } else {
      console.log('ℹ️  封禁记录表已存在，跳过创建');
    }

    // 5. 为disputes表添加确认结果字段
    console.log('🔧 正在为disputes表添加确认结果字段...');
    try {
      await connection.execute(`
        ALTER TABLE disputes 
        ADD COLUMN initiator_confirmed BOOLEAN DEFAULT FALSE COMMENT '发起者是否确认结果' AFTER appeal_reviewed_at,
        ADD COLUMN respondent_confirmed BOOLEAN DEFAULT FALSE COMMENT '响应者是否确认结果' AFTER initiator_confirmed,
        ADD COLUMN initiator_confirmed_at TIMESTAMP NULL COMMENT '发起者确认时间' AFTER respondent_confirmed,
        ADD COLUMN respondent_confirmed_at TIMESTAMP NULL COMMENT '响应者确认时间' AFTER initiator_confirmed_at,
        ADD COLUMN initiator_rejected BOOLEAN DEFAULT FALSE COMMENT '发起者是否拒绝接受结果' AFTER respondent_confirmed_at,
        ADD COLUMN respondent_rejected BOOLEAN DEFAULT FALSE COMMENT '响应者是否拒绝接受结果' AFTER initiator_rejected
      `);
      console.log('✅ disputes表字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  disputes表字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('\n✅ 所有操作完成！');
  } catch (error) {
    console.error('❌ 创建表失败:', error.message);
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
  createPaymentAndCreditTables();
}

module.exports = createPaymentAndCreditTables;

