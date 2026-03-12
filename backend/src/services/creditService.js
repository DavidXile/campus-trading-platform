const { query } = require('../config/db');

/**
 * 处理纠纷相关的信用分变更
 */
const handleDisputeCredit = async (dispute, reviewResult, isAppeal = false, previousResult = null) => {
  try {
    const { id: disputeId, initiator_id, respondent_id } = dispute;
    console.log(`🔍 handleDisputeCredit 开始: 纠纷ID=${disputeId}, 结果=${reviewResult}, 申诉=${isAppeal}, 之前结果=${previousResult}`);
    
    // 判断谁申诉了（败诉方申诉）
    // 如果之前结果支持发起者，那么响应者是败诉方，响应者申诉
    // 如果之前结果支持响应者，那么发起者是败诉方，发起者申诉
    let appellantIsInitiator = false; // 申诉方是否是发起者
    if (isAppeal && previousResult) {
      if (previousResult === 'support_initiator') {
        // 之前支持发起者，响应者是败诉方，响应者申诉
        appellantIsInitiator = false;
      } else if (previousResult === 'support_respondent') {
        // 之前支持响应者，发起者是败诉方，发起者申诉
        appellantIsInitiator = true;
      } else if (previousResult === 'partial_refund' || previousResult === 'no_support') {
        // 部分退款或不支持，双方都可以申诉，但通常只有一方申诉
        // 这里简化处理，假设发起者申诉（实际应该从数据库查询谁申诉了）
        appellantIsInitiator = true;
      }
    }

    // 获取双方当前信用分
    const [users] = await query(
      'SELECT id, COALESCE(credit_score, 100) as credit_score FROM users WHERE id IN (?, ?)',
      [initiator_id, respondent_id]
    );

    const initiator = users.find(u => Number(u.id) === Number(initiator_id));
    const respondent = users.find(u => Number(u.id) === Number(respondent_id));

    if (!initiator || !respondent) {
      throw new Error('用户不存在');
    }

    // 确保信用分不为 NULL，默认为 100
    let initiatorScore = initiator.credit_score !== null && initiator.credit_score !== undefined 
      ? parseFloat(initiator.credit_score) 
      : 100;
    let respondentScore = respondent.credit_score !== null && respondent.credit_score !== undefined 
      ? parseFloat(respondent.credit_score) 
      : 100;

    // 如果是申诉审核且之前有结果，需要先撤销之前的信用分变化
    if (isAppeal && previousResult) {
      console.log(`🔄 撤销之前的信用分变化: 之前结果=${previousResult}`);
      
      // 计算之前的结果对应的信用分变化
      let previousInitiatorChange = 0;
      let previousRespondentChange = 0;
      
      if (previousResult === 'support_initiator') {
        previousInitiatorChange = 5;
        previousRespondentChange = -10;
      } else if (previousResult === 'support_respondent') {
        previousInitiatorChange = -10;
        previousRespondentChange = 5;
      } else if (previousResult === 'partial_refund') {
        previousInitiatorChange = -5;
        previousRespondentChange = -5;
      } else if (previousResult === 'no_support') {
        previousInitiatorChange = -5;
        previousRespondentChange = -5;
      }
      
      // 撤销之前的信用分变化（反向操作）
      if (previousInitiatorChange !== 0) {
        initiatorScore = Math.max(0, Math.min(100, initiatorScore - previousInitiatorChange));
        await query(
          'UPDATE users SET credit_score = ? WHERE id = ?',
          [initiatorScore, initiator_id]
        );
        console.log(`🔄 撤销发起者信用分变化: ${initiator_id} ${-previousInitiatorChange} (当前=${initiatorScore})`);
      }
      
      if (previousRespondentChange !== 0) {
        respondentScore = Math.max(0, Math.min(100, respondentScore - previousRespondentChange));
        await query(
          'UPDATE users SET credit_score = ? WHERE id = ?',
          [respondentScore, respondent_id]
        );
        console.log(`🔄 撤销响应者信用分变化: ${respondent_id} ${-previousRespondentChange} (当前=${respondentScore})`);
      }
    }

    let initiatorChange = 0;
    let respondentChange = 0;
    let initiatorDesc = '';
    let respondentDesc = '';

    if (isAppeal) {
      // 申诉审核：根据申诉结果和申诉方判断描述
      if (reviewResult === 'support_initiator') {
        // 申诉审核支持发起者：发起者+5，响应者-10
        initiatorChange = 5;
        respondentChange = -10;
        if (appellantIsInitiator) {
          // 发起者申诉成功
          initiatorDesc = '申诉成功，信用分+5';
          respondentDesc = '申诉被驳回，信用分-10';
        } else {
          // 响应者申诉被驳回
          initiatorDesc = '申诉被驳回，信用分+5';
          respondentDesc = '申诉被驳回，信用分-10';
        }
      } else if (reviewResult === 'support_respondent') {
        // 申诉审核支持响应者：发起者-15，响应者+5
        initiatorChange = -15;
        respondentChange = 5;
        if (appellantIsInitiator) {
          // 发起者申诉被驳回
          initiatorDesc = '申诉被驳回，信用分-15';
          respondentDesc = '申诉被驳回，信用分+5';
        } else {
          // 响应者申诉成功
          initiatorDesc = '申诉被驳回，信用分-15';
          respondentDesc = '申诉成功，信用分+5';
        }
      } else if (reviewResult === 'partial_refund') {
        // 部分支持：双方各-5
        initiatorChange = -5;
        respondentChange = -5;
        initiatorDesc = '申诉部分支持，信用分-5';
        respondentDesc = '申诉部分支持，信用分-5';
      } else {
        // 不支持：申诉方-20（恶意申诉）
        if (appellantIsInitiator) {
          initiatorChange = -20;
          respondentChange = 0;
          initiatorDesc = '申诉被驳回（恶意申诉），信用分-20';
          respondentDesc = '申诉被驳回，信用分不变';
        } else {
          initiatorChange = 0;
          respondentChange = -20;
          initiatorDesc = '申诉被驳回，信用分不变';
          respondentDesc = '申诉被驳回（恶意申诉），信用分-20';
        }
      }
    } else {
      // 初始审核
      if (reviewResult === 'support_initiator') {
        // 支持发起者：发起者+5，响应者-10
        initiatorChange = 5;
        respondentChange = -10;
        initiatorDesc = '纠纷审核支持发起者，信用分+5';
        respondentDesc = '纠纷审核不支持，信用分-10';
      } else if (reviewResult === 'support_respondent') {
        // 支持响应者：发起者-10，响应者+5
        initiatorChange = -10;
        respondentChange = 5;
        initiatorDesc = '纠纷审核不支持，信用分-10';
        respondentDesc = '纠纷审核支持响应者，信用分+5';
      } else if (reviewResult === 'partial_refund') {
        // 部分退款：双方各-5
        initiatorChange = -5;
        respondentChange = -5;
        initiatorDesc = '纠纷审核部分支持，信用分-5';
        respondentDesc = '纠纷审核部分支持，信用分-5';
      } else {
        // 不支持：双方各-5
        initiatorChange = -5;
        respondentChange = -5;
        initiatorDesc = '纠纷审核不支持，信用分-5';
        respondentDesc = '纠纷审核不支持，信用分-5';
      }
    }

    // 更新发起者信用分
    if (initiatorChange !== 0) {
      const newScore = Math.max(0, Math.min(100, initiatorScore + initiatorChange));
      console.log(`🔧 准备更新发起者信用分: 用户ID=${initiator_id}, 当前=${initiatorScore}, 变化=${initiatorChange}, 新值=${newScore}`);
      
      const [updateResult] = await query(
        'UPDATE users SET credit_score = ? WHERE id = ?',
        [newScore, initiator_id]
      );
      
      // UPDATE 返回的是 ResultSetHeader，包含 affectedRows 和 changedRows
      console.log(`🔧 UPDATE 结果: affectedRows=${updateResult?.affectedRows || 'N/A'}, changedRows=${updateResult?.changedRows || 'N/A'}`);

      // 验证更新是否成功
      const [verifyUsers] = await query(
        'SELECT credit_score FROM users WHERE id = ?',
        [initiator_id]
      );
      if (verifyUsers.length > 0) {
        const actualScore = verifyUsers[0].credit_score;
        console.log(`🔧 验证发起者信用分: 期望=${newScore}, 实际=${actualScore}`);
        if (parseFloat(actualScore) !== newScore) {
          throw new Error(`信用分更新失败: 期望 ${newScore}，实际 ${actualScore}`);
        }
      }

      // 记录信用变更
      // 确定 change_type：申诉成功用 'dispute_reward'，申诉被驳回用 'appeal_rejected'
      let changeType = 'dispute_penalty';
      if (isAppeal) {
        if (initiatorChange > 0 && initiatorDesc.includes('申诉成功')) {
          changeType = 'dispute_reward'; // 申诉成功
        } else if (initiatorChange < 0 && initiatorDesc.includes('申诉被驳回')) {
          changeType = 'appeal_rejected'; // 申诉被驳回
        } else {
          changeType = 'appeal_rejected'; // 默认
        }
      }
      
      await query(
        `INSERT INTO credit_records 
         (user_id, change_type, change_amount, score_before, score_after, related_dispute_id, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          initiator_id,
          changeType,
          initiatorChange,
          initiatorScore,
          newScore,
          disputeId,
          initiatorDesc
        ]
      );
      console.log(`✅ 更新发起者信用分: ${initiator_id} ${initiatorChange > 0 ? '+' : ''}${initiatorChange} (${initiatorScore} -> ${newScore})`);
    }

    // 更新响应者信用分
    if (respondentChange !== 0) {
      const newScore = Math.max(0, Math.min(100, respondentScore + respondentChange));
      console.log(`🔧 准备更新响应者信用分: 用户ID=${respondent_id}, 当前=${respondentScore}, 变化=${respondentChange}, 新值=${newScore}`);
      
      const [updateResult] = await query(
        'UPDATE users SET credit_score = ? WHERE id = ?',
        [newScore, respondent_id]
      );
      
      // UPDATE 返回的是 ResultSetHeader，包含 affectedRows 和 changedRows
      console.log(`🔧 UPDATE 结果: affectedRows=${updateResult?.affectedRows || 'N/A'}, changedRows=${updateResult?.changedRows || 'N/A'}`);

      // 验证更新是否成功
      const [verifyUsers] = await query(
        'SELECT credit_score FROM users WHERE id = ?',
        [respondent_id]
      );
      if (verifyUsers.length > 0) {
        const actualScore = verifyUsers[0].credit_score;
        console.log(`🔧 验证响应者信用分: 期望=${newScore}, 实际=${actualScore}`);
        if (parseFloat(actualScore) !== newScore) {
          throw new Error(`信用分更新失败: 期望 ${newScore}，实际 ${actualScore}`);
        }
      }

      // 记录信用变更
      // 确定 change_type：申诉成功用 'dispute_reward'，申诉被驳回用 'appeal_rejected'
      let changeType = 'dispute_penalty';
      if (isAppeal) {
        if (respondentChange > 0 && respondentDesc.includes('申诉成功')) {
          changeType = 'dispute_reward'; // 申诉成功
        } else if (respondentChange < 0 && respondentDesc.includes('申诉被驳回')) {
          changeType = 'appeal_rejected'; // 申诉被驳回
        } else {
          changeType = 'appeal_rejected'; // 默认
        }
      }
      
      await query(
        `INSERT INTO credit_records 
         (user_id, change_type, change_amount, score_before, score_after, related_dispute_id, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          respondent_id,
          changeType,
          respondentChange,
          respondentScore,
          newScore,
          disputeId,
          respondentDesc
        ]
      );
      console.log(`✅ 更新响应者信用分: ${respondent_id} ${respondentChange > 0 ? '+' : ''}${respondentChange} (${respondentScore} -> ${newScore})`);
    }

    console.log(`✅ 信用分更新成功: 发起者 ${initiatorChange}, 响应者 ${respondentChange}`);
    return { success: true };
  } catch (error) {
    console.error('❌ 处理信用分失败:', error);
    throw error;
  }
};

module.exports = {
  handleDisputeCredit
};

