const { query } = require('../config/db');

/**
 * 撤销退款（用于申诉改判）
 */
const reverseRefund = async ({ dispute_id, buyer_id, seller_id, item_id, refund_amount, reason }) => {
  try {
    const refundAmount = parseFloat(refund_amount);

    // 获取买家当前余额
    const [buyers] = await query('SELECT wallet_balance FROM users WHERE id = ?', [buyer_id]);
    if (buyers.length === 0) {
      throw new Error('买家不存在');
    }

    const buyerBalanceBefore = parseFloat(buyers[0].wallet_balance || 0);
    const buyerBalanceAfter = Math.max(0, buyerBalanceBefore - refundAmount); // 从买家收回退款

    // 更新买家余额（收回退款）
    await query(
      'UPDATE users SET wallet_balance = ? WHERE id = ?',
      [buyerBalanceAfter, buyer_id]
    );

    // 退回卖家被扣的款
    const [sellers] = await query('SELECT wallet_balance FROM users WHERE id = ?', [seller_id]);
    if (sellers.length > 0) {
      const sellerBalanceBefore = parseFloat(sellers[0].wallet_balance || 0);
      const sellerBalanceAfter = sellerBalanceBefore + refundAmount; // 退回给卖家

      await query(
        'UPDATE users SET wallet_balance = ? WHERE id = ?',
        [sellerBalanceAfter, seller_id]
      );

      // 记录卖家退回交易
      await query(
        `INSERT INTO transactions 
         (user_id, type, amount, balance_before, balance_after, related_item_id, related_dispute_id, description)
         VALUES (?, 'refund', ?, ?, ?, ?, ?, ?)`,
        [seller_id, refundAmount, sellerBalanceBefore, sellerBalanceAfter, item_id, dispute_id, `申诉改判：退回退款 ${reason}`]
      );
    }

    // 记录买家退回交易
    await query(
      `INSERT INTO transactions 
       (user_id, type, amount, balance_before, balance_after, related_item_id, related_dispute_id, description)
       VALUES (?, 'refund', ?, ?, ?, ?, ?, ?)`,
      [buyer_id, -refundAmount, buyerBalanceBefore, buyerBalanceAfter, item_id, dispute_id, `申诉改判：收回退款 ${reason}`]
    );

    console.log(`✅ 撤销退款成功: 买家 ${buyer_id} 退回 ${refundAmount} 元，卖家 ${seller_id} 收回 ${refundAmount} 元`);
    return { success: true };
  } catch (error) {
    console.error('❌ 撤销退款失败:', error);
    throw error;
  }
};

/**
 * 处理全额退款
 */
const processFullRefund = async ({ dispute_id, buyer_id, seller_id, item_id, refund_amount, reason }) => {
  try {
    // 获取商品信息
    const [items] = await query('SELECT price, buyer_id FROM items WHERE id = ?', [item_id]);
    if (items.length === 0) {
      throw new Error('商品不存在');
    }

    const item = items[0];
    const actualPrice = parseFloat(item.price || 0);

    // 如果退款金额大于商品价格，使用商品价格
    const refundAmount = Math.min(parseFloat(refund_amount), actualPrice);

    // 获取买家当前余额
    const [buyers] = await query('SELECT wallet_balance FROM users WHERE id = ?', [buyer_id]);
    if (buyers.length === 0) {
      throw new Error('买家不存在');
    }

    const balanceBefore = parseFloat(buyers[0].wallet_balance || 0);
    const balanceAfter = balanceBefore + refundAmount;

    // 更新买家余额（退款）
    await query(
      'UPDATE users SET wallet_balance = ? WHERE id = ?',
      [balanceAfter, buyer_id]
    );

    // 从卖家余额中扣款
    const [sellers] = await query('SELECT wallet_balance FROM users WHERE id = ?', [seller_id]);
    if (sellers.length > 0) {
      const sellerBalanceBefore = parseFloat(sellers[0].wallet_balance || 0);
      const sellerBalanceAfter = Math.max(0, sellerBalanceBefore - refundAmount); // 确保余额不为负

      await query(
        'UPDATE users SET wallet_balance = ? WHERE id = ?',
        [sellerBalanceAfter, seller_id]
      );

      // 记录卖家扣款交易
      await query(
        `INSERT INTO transactions 
         (user_id, type, amount, balance_before, balance_after, related_item_id, related_dispute_id, description)
         VALUES (?, 'refund', ?, ?, ?, ?, ?, ?)`,
        [seller_id, -refundAmount, sellerBalanceBefore, sellerBalanceAfter, item_id, dispute_id, `退款给买家: ${reason}`]
      );
    }

    // 记录买家退款交易
    await query(
      `INSERT INTO transactions 
       (user_id, type, amount, balance_before, balance_after, related_item_id, related_dispute_id, description)
       VALUES (?, 'refund', ?, ?, ?, ?, ?, ?)`,
      [buyer_id, refundAmount, balanceBefore, balanceAfter, item_id, dispute_id, `退款给买家: ${reason}`]
    );

    console.log(`✅ 全额退款成功: 买家 ${buyer_id} 退款 ${refundAmount} 元，卖家 ${seller_id} 扣款 ${refundAmount} 元`);
    return { success: true, refundAmount };
  } catch (error) {
    console.error('❌ 处理全额退款失败:', error);
    throw error;
  }
};

/**
 * 处理部分退款
 */
const processPartialRefund = async ({ dispute_id, buyer_id, seller_id, item_id, refund_amount, reason }) => {
  try {
    // 获取商品信息
    const [items] = await query('SELECT price FROM items WHERE id = ?', [item_id]);
    if (items.length === 0) {
      throw new Error('商品不存在');
    }

    const item = items[0];
    const actualPrice = parseFloat(item.price || 0);
    const refundAmount = Math.min(parseFloat(refund_amount), actualPrice * 0.5); // 部分退款最多50%

    // 获取买家当前余额
    const [buyers] = await query('SELECT wallet_balance FROM users WHERE id = ?', [buyer_id]);
    if (buyers.length === 0) {
      throw new Error('买家不存在');
    }

    const balanceBefore = parseFloat(buyers[0].wallet_balance || 0);
    const balanceAfter = balanceBefore + refundAmount;

    // 更新买家余额（退款）
    await query(
      'UPDATE users SET wallet_balance = ? WHERE id = ?',
      [balanceAfter, buyer_id]
    );

    // 从卖家余额中扣款
    const [sellers] = await query('SELECT wallet_balance FROM users WHERE id = ?', [seller_id]);
    if (sellers.length > 0) {
      const sellerBalanceBefore = parseFloat(sellers[0].wallet_balance || 0);
      const sellerBalanceAfter = Math.max(0, sellerBalanceBefore - refundAmount);

      await query(
        'UPDATE users SET wallet_balance = ? WHERE id = ?',
        [sellerBalanceAfter, seller_id]
      );

      // 记录卖家扣款交易
      await query(
        `INSERT INTO transactions 
         (user_id, type, amount, balance_before, balance_after, related_item_id, related_dispute_id, description)
         VALUES (?, 'partial_refund', ?, ?, ?, ?, ?, ?)`,
        [seller_id, -refundAmount, sellerBalanceBefore, sellerBalanceAfter, item_id, dispute_id, `部分退款给买家: ${reason}`]
      );
    }

    // 记录买家退款交易
    await query(
      `INSERT INTO transactions 
       (user_id, type, amount, balance_before, balance_after, related_item_id, related_dispute_id, description)
       VALUES (?, 'partial_refund', ?, ?, ?, ?, ?, ?)`,
      [buyer_id, refundAmount, balanceBefore, balanceAfter, item_id, dispute_id, `部分退款给买家: ${reason}`]
    );

    console.log(`✅ 部分退款成功: 买家 ${buyer_id} 退款 ${refundAmount} 元，卖家 ${seller_id} 扣款 ${refundAmount} 元`);
    return { success: true, refundAmount };
  } catch (error) {
    console.error('❌ 处理部分退款失败:', error);
    throw error;
  }
};

/**
 * 处理购买支付
 */
const processPurchase = async ({ buyer_id, seller_id, item_id, amount, reason }) => {
  try {
    // 检查 wallet_balance 字段是否存在
    const dbName = process.env.DB_NAME || 'campus_trading';
    let hasWalletBalance = false;
    let hasTransactionsTable = false;
    
    try {
      const [walletCol] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'wallet_balance'",
        [dbName]
      );
      hasWalletBalance = walletCol.length > 0;
      
      const [transactionsTable] = await query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'transactions'",
        [dbName]
      );
      hasTransactionsTable = transactionsTable.length > 0;
    } catch (err) {
      console.log('检查字段和表时出错:', err);
    }

    if (!hasWalletBalance) {
      console.log('⚠️  wallet_balance 字段不存在，跳过支付处理');
      return { success: true, balanceAfter: 0 };
    }

    // 获取买家当前余额
    const [buyers] = await query('SELECT wallet_balance FROM users WHERE id = ?', [buyer_id]);
    if (buyers.length === 0) {
      throw new Error('买家不存在');
    }

    const balanceBefore = parseFloat(buyers[0].wallet_balance || 0);
    const purchaseAmount = parseFloat(amount);

    // 检查余额是否足够
    if (balanceBefore < purchaseAmount) {
      throw new Error('余额不足');
    }

    const balanceAfter = balanceBefore - purchaseAmount;

    // 更新买家余额
    await query(
      'UPDATE users SET wallet_balance = ? WHERE id = ?',
      [balanceAfter, buyer_id]
    );

    // 更新卖家余额（收入）
    const [sellers] = await query('SELECT wallet_balance FROM users WHERE id = ?', [seller_id]);
    if (sellers.length > 0) {
      const sellerBalanceBefore = parseFloat(sellers[0].wallet_balance || 0);
      const sellerBalanceAfter = sellerBalanceBefore + purchaseAmount;

      await query(
        'UPDATE users SET wallet_balance = ? WHERE id = ?',
        [sellerBalanceAfter, seller_id]
      );

      // 记录卖家收入（如果transactions表存在）
      if (hasTransactionsTable) {
        try {
          await query(
            `INSERT INTO transactions 
             (user_id, type, amount, balance_before, balance_after, related_item_id, description)
             VALUES (?, 'purchase', ?, ?, ?, ?, ?)`,
            [seller_id, purchaseAmount, sellerBalanceBefore, sellerBalanceAfter, item_id, `出售商品收入: ${reason}`]
          );
        } catch (err) {
          console.log('记录卖家交易失败（表可能不存在）:', err.message);
        }
      }
    }

    // 记录买家支出（如果transactions表存在）
    if (hasTransactionsTable) {
      try {
        await query(
          `INSERT INTO transactions 
           (user_id, type, amount, balance_before, balance_after, related_item_id, description)
           VALUES (?, 'purchase', ?, ?, ?, ?, ?)`,
          [buyer_id, -purchaseAmount, balanceBefore, balanceAfter, item_id, reason]
        );
      } catch (err) {
        console.log('记录买家交易失败（表可能不存在）:', err.message);
      }
    }

    console.log(`✅ 购买成功: 用户 ${buyer_id} 支付 ${purchaseAmount} 元`);
    return { success: true, balanceAfter };
  } catch (error) {
    console.error('❌ 处理购买失败:', error);
    throw error;
  }
};

module.exports = {
  processFullRefund,
  processPartialRefund,
  processPurchase,
  reverseRefund
};
