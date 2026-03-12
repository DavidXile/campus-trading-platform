const { query } = require('../config/db');
const { authenticateToken } = require('../middlewares/authMiddleware');

/**
 * 充值钱包（模拟充值，实际应该对接支付接口）
 */
const depositWallet = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    // 验证金额
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: '充值金额必须大于0'
      });
    }

    if (amount > 10000) {
      return res.status(400).json({
        success: false,
        message: '单次充值金额不能超过10000元'
      });
    }

    // 获取当前余额
    const [users] = await query('SELECT wallet_balance FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const balanceBefore = parseFloat(users[0].wallet_balance || 0);
    const balanceAfter = balanceBefore + parseFloat(amount);

    // 更新余额
    await query(
      'UPDATE users SET wallet_balance = ? WHERE id = ?',
      [balanceAfter, userId]
    );

    // 记录交易（检查字段是否存在）
    try {
      // 先检查表是否存在以及有哪些字段
      const [columns] = await query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'transactions'`,
        [process.env.DB_NAME || 'campus_trading']
      );
      
      const columnNames = columns.map(col => col.COLUMN_NAME);
      const hasType = columnNames.includes('type');
      
      if (hasType) {
        // 检查 type 字段是否支持 'deposit'
        const [typeEnum] = await query(
          `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'type'`,
          [process.env.DB_NAME || 'campus_trading']
        );
        
        const typeValue = typeEnum[0]?.COLUMN_TYPE?.includes("'deposit'") ? 'deposit' : 'credit_adjustment';
        
        await query(
          `INSERT INTO transactions 
           (user_id, type, amount, balance_before, balance_after, description)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, typeValue, parseFloat(amount), balanceBefore, balanceAfter, `钱包充值: ${amount}元（模拟）`]
        );
      }
    } catch (txError) {
      // 如果插入交易记录失败，不影响充值操作
      console.error('记录交易失败（不影响充值）:', txError.message);
    }

    res.json({
      success: true,
      message: '充值成功',
      balance: balanceAfter
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

/**
 * 获取钱包余额和交易记录
 */
const getWalletInfo = async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '未授权访问'
      });
    }

    // 检查 wallet_balance 字段是否存在
    try {
      // 获取余额（如果字段不存在，会抛出错误）
      const [users] = await query('SELECT wallet_balance FROM users WHERE id = ?', [userId]);
      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      const balance = parseFloat(users[0].wallet_balance || 0);

      // 获取最近的交易记录（如果表不存在，返回空数组）
      let transactions = [];
      try {
        // 先检查表是否存在以及有哪些字段
        const [columns] = await query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'transactions'`,
          [process.env.DB_NAME || 'campus_trading']
        );
        
        const columnNames = columns.map(col => col.COLUMN_NAME);
        
        // 兼容新旧字段名：优先使用 related_item_id，如果没有则使用 item_id
        const itemIdField = columnNames.includes('related_item_id') ? 'related_item_id' : 
                           (columnNames.includes('item_id') ? 'item_id' : null);
        const disputeIdField = columnNames.includes('related_dispute_id') ? 'related_dispute_id' : 
                               (columnNames.includes('dispute_id') ? 'dispute_id' : null);
        const hasRelatedErrandId = columnNames.includes('related_errand_id');
        
        // 根据实际存在的字段构建查询
        let selectFields = 'id, user_id, type, amount, balance_before, balance_after, description, created_at';
        if (itemIdField) {
          selectFields += `, ${itemIdField} AS related_item_id`;
        }
        if (disputeIdField) {
          selectFields += `, ${disputeIdField} AS related_dispute_id`;
        }
        if (hasRelatedErrandId) {
          selectFields += ', related_errand_id';
        }
        
        const [txs] = await query(
          `SELECT ${selectFields}
           FROM transactions 
           WHERE user_id = ? 
           ORDER BY created_at DESC 
           LIMIT 50`,
          [userId]
        );
        transactions = txs || [];
      } catch (txError) {
        // 如果 transactions 表不存在或查询失败，返回空数组
        transactions = [];
      }

      return res.json({
        success: true,
        balance: balance,
        transactions: transactions
      });
    } catch (dbError) {
      // 如果 wallet_balance 字段不存在
      if (dbError.code === 'ER_BAD_FIELD_ERROR' || dbError.message.includes('wallet_balance')) {
        return res.status(500).json({
          success: false,
          message: '钱包功能未初始化，请运行数据库迁移脚本: npm run create-payment-credit-tables'
        });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('获取钱包信息失败:', error);
    return res.status(500).json({
      success: false,
      message: error.message || '服务器内部错误'
    });
  }
};

module.exports = {
  depositWallet,
  getWalletInfo
};

