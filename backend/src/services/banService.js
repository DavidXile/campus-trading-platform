const { query } = require('../config/db');

/**
 * 封禁用户
 */
const banUser = async ({ user_id, admin_id = null, reason, ban_type = 'temporary', duration_days = null, related_dispute_id = null }) => {
  try {
    // 计算到期时间
    let expiresAt = null;
    if (ban_type === 'temporary' && duration_days) {
      const expiresDate = new Date();
      expiresDate.setDate(expiresDate.getDate() + duration_days);
      expiresAt = expiresDate.toISOString().slice(0, 19).replace('T', ' ');
    }

    // 检查字段是否存在，动态构建SQL
    const dbName = process.env.DB_NAME || 'campus_trading';
    const [banExpiresAtCol] = await query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'ban_expires_at'",
      [dbName]
    );
    const [bannedAtCol] = await query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'banned_at'",
      [dbName]
    );
    const [banReasonCol] = await query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'ban_reason'",
      [dbName]
    );

    // 构建UPDATE语句
    let updateSql = 'UPDATE users SET is_banned = TRUE';
    const updateParams = [];

    if (banReasonCol.length > 0) {
      updateSql += ', ban_reason = ?';
      updateParams.push(reason);
    }

    if (bannedAtCol.length > 0) {
      updateSql += ', banned_at = NOW()';
    }

    if (banExpiresAtCol.length > 0) {
      updateSql += ', ban_expires_at = ?';
      updateParams.push(expiresAt);
    }

    updateSql += ' WHERE id = ?';
    updateParams.push(user_id);

    // 更新用户表
    await query(updateSql, updateParams);

    // 记录封禁记录
    await query(
      `INSERT INTO ban_records 
       (user_id, admin_id, reason, ban_type, expires_at, related_dispute_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, admin_id, reason, ban_type, expiresAt, related_dispute_id]
    );

    console.log(`✅ 用户 ${user_id} 已被封禁，原因: ${reason}`);
    return { success: true };
  } catch (error) {
    console.error('❌ 封禁用户失败:', error);
    throw error;
  }
};

/**
 * 解封用户
 */
const unbanUser = async ({ user_id, admin_id }) => {
  try {
    // 检查字段是否存在，动态构建SQL
    const dbName = process.env.DB_NAME || 'campus_trading';
    const [banExpiresAtCol] = await query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'ban_expires_at'",
      [dbName]
    );
    const [bannedAtCol] = await query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'banned_at'",
      [dbName]
    );
    const [banReasonCol] = await query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'ban_reason'",
      [dbName]
    );

    // 构建UPDATE语句
    let updateSql = 'UPDATE users SET is_banned = FALSE';
    const updateParams = [];

    if (banReasonCol.length > 0) {
      updateSql += ', ban_reason = NULL';
    }

    if (bannedAtCol.length > 0) {
      updateSql += ', banned_at = NULL';
    }

    if (banExpiresAtCol.length > 0) {
      updateSql += ', ban_expires_at = NULL';
    }

    updateSql += ' WHERE id = ?';
    updateParams.push(user_id);

    // 更新用户表
    await query(updateSql, updateParams);

    // 更新封禁记录
    await query(
      `UPDATE ban_records 
       SET is_active = FALSE, 
           lifted_at = NOW(), 
           lifted_by = ?
       WHERE user_id = ? AND is_active = TRUE`,
      [admin_id, user_id]
    );

    console.log(`✅ 用户 ${user_id} 已被解封`);
    return { success: true };
  } catch (error) {
    console.error('❌ 解封用户失败:', error);
    throw error;
  }
};


/**
 * 处理拒绝接受审核结果的情况
 */
const handleRejectResult = async (dispute, userId) => {
  try {
    const isInitiator = Number(dispute.initiator_id) === Number(userId);
    const isRespondent = Number(dispute.respondent_id) === Number(userId);

    if (!isInitiator && !isRespondent) {
      throw new Error('用户无权操作此纠纷');
    }

    // 更新拒绝状态
    if (isInitiator) {
      await query(
        'UPDATE disputes SET initiator_rejected = TRUE WHERE id = ?',
        [dispute.id]
      );
    } else {
      await query(
        'UPDATE disputes SET respondent_rejected = TRUE WHERE id = ?',
        [dispute.id]
      );
    }

    // 扣减信用分（拒绝接受结果）
    const [users] = await query('SELECT COALESCE(credit_score, 100) as credit_score FROM users WHERE id = ?', [userId]);
    if (users.length > 0) {
      const currentScore = users[0].credit_score !== null && users[0].credit_score !== undefined 
        ? parseFloat(users[0].credit_score) 
        : 100;
      const newScore = Math.max(0, currentScore - 10); // 扣10分

      await query(
        'UPDATE users SET credit_score = ? WHERE id = ?',
        [newScore, userId]
      );

      // 记录信用变更
      await query(
        `INSERT INTO credit_records 
         (user_id, change_type, change_amount, score_before, score_after, related_dispute_id, description)
         VALUES (?, 'ban_penalty', -10, ?, ?, ?, ?)`,
        [
          userId,
          currentScore,
          newScore,
          dispute.id,
          '拒绝接受审核结果，信用分-10'
        ]
      );
      console.log(`✅ 拒绝结果扣分成功: 用户 ${userId} ${currentScore} -> ${newScore} (-10)`);
    } else {
      throw new Error('用户不存在');
    }

    console.log(`✅ 处理拒绝结果成功: 用户 ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ 处理拒绝结果失败:', error);
    throw error;
  }
};

module.exports = {
  banUser,
  unbanUser,
  handleRejectResult
};

