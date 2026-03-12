const { query } = require('../config/db');
const banService = require('../services/banService');

// 获取io实例的辅助函数
const getIO = (req) => {
  return req.app.get('io');
};

// 发送纠纷通知的辅助函数
const sendDisputeNotification = async (io, userId, notificationType, disputeData) => {
  if (!io) return;
  
  const userRoom = `user_${userId}`;
  console.log(`📬 发送纠纷通知到用户房间: ${userRoom}, 类型: ${notificationType}`);
  
  io.to(userRoom).emit('dispute_notification', {
    type: notificationType,
    dispute: disputeData,
    timestamp: new Date().toISOString()
  });
};

// 发起纠纷
const createDispute = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { item_id, dispute_type, description, evidence_images } = req.body;

    // 验证必填字段
    if (!item_id || !dispute_type || !description) {
      return res.status(400).json({
        success: false,
        message: '商品ID、纠纷类型和描述都是必填项'
      });
    }

    // 验证描述长度
    if (description.length < 10 || description.length > 500) {
      return res.status(400).json({
        success: false,
        message: '纠纷描述应为10-500个字符'
      });
    }

    // 验证证据图片数量
    if (evidence_images && Array.isArray(evidence_images)) {
      if (evidence_images.length === 0 || evidence_images.length > 3) {
        return res.status(400).json({
          success: false,
          message: '请上传1-3张证据图片'
        });
      }
    }

    // 验证纠纷类型
    const validTypes = ['commodity_misrepresentation', 'no_show', 'price_dispute', 'other'];
    if (!validTypes.includes(dispute_type)) {
      return res.status(400).json({
        success: false,
        message: '无效的纠纷类型'
      });
    }

    // 检查商品是否存在且已售出（动态检查字段）
    const dbName = process.env.DB_NAME || 'campus_trading';
    let itemSelectFields = 'id, seller_id, status';
    try {
      const [buyerIdCol] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'buyer_id'",
        [dbName]
      );
      if (buyerIdCol.length > 0) {
        itemSelectFields += ', buyer_id';
      }
      const [purchasedAtCol] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'purchased_at'",
        [dbName]
      );
      if (purchasedAtCol.length > 0) {
        itemSelectFields += ', purchased_at';
      }
    } catch (err) {
      console.log('检查 items 表字段时出错:', err);
    }

    const [items] = await query(
      `SELECT ${itemSelectFields} FROM items WHERE id = ?`,
      [item_id]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    const item = items[0];

    // 验证用户是否有权限发起纠纷（必须是买家或卖家）
    const itemBuyerId = item.buyer_id || null;
    if (Number(item.seller_id) !== Number(userId) && (!itemBuyerId || Number(itemBuyerId) !== Number(userId))) {
      return res.status(403).json({
        success: false,
        message: '您无权对此商品发起纠纷'
      });
    }

    // 确定发起者和响应者
    const initiator_id = userId;
    const respondent_id = Number(item.seller_id) === Number(userId) 
      ? (itemBuyerId ? Number(itemBuyerId) : null)
      : Number(item.seller_id);

    if (!respondent_id) {
      return res.status(400).json({
        success: false,
        message: '该商品尚未被购买，无法发起纠纷'
      });
    }

    // 检查 disputes 表是否存在
    let disputesTableExists = false;
    try {
      const [tables] = await query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'disputes'",
        [dbName]
      );
      disputesTableExists = tables.length > 0;
    } catch (err) {
      console.log('检查 disputes 表时出错:', err);
    }

    if (!disputesTableExists) {
      return res.status(500).json({
        success: false,
        message: '纠纷功能未初始化，请先运行: npm run create-disputes-table'
      });
    }

    // 检查 items 表的 status 字段是否支持 'disputed' 状态
    let canUpdateToDisputed = true;
    try {
      const [statusCol] = await query(
        "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'status'",
        [dbName]
      );
      if (statusCol.length > 0) {
        const columnType = statusCol[0].COLUMN_TYPE;
        if (!columnType.includes('disputed')) {
          canUpdateToDisputed = false;
        }
      }
    } catch (err) {
      console.log('检查 items.status 字段时出错:', err);
    }

    // 允许同一订单多次纠纷，不再阻止已有纠纷
    // 创建纠纷
    const evidenceJson = evidence_images && Array.isArray(evidence_images) 
      ? JSON.stringify(evidence_images) 
      : null;

    const [result] = await query(
      `INSERT INTO disputes 
       (item_id, initiator_id, respondent_id, dispute_type, description, evidence_images, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'pending_response')`,
      [item_id, initiator_id, respondent_id, dispute_type, description, evidenceJson]
    );

    // 更新商品状态为 disputed（如果支持）
    if (canUpdateToDisputed) {
      try {
        await query('UPDATE items SET status = ? WHERE id = ?', ['disputed', item_id]);
      } catch (err) {
        console.log('更新商品状态为 disputed 失败（可能不支持该状态）:', err.message);
      }
    }

    // 发送通知给响应者
    const io = getIO(req);
    if (io) {
      const [disputeInfo] = await query(
        `SELECT d.*, i.title as item_title 
         FROM disputes d 
         LEFT JOIN items i ON d.item_id = i.id 
         WHERE d.id = ?`,
        [result.insertId]
      );
      
      if (disputeInfo.length > 0) {
        const dispute = disputeInfo[0];
        // 安全解析JSON字段
        try {
          if (dispute.evidence_images) {
            dispute.evidence_images = typeof dispute.evidence_images === 'string' 
              ? JSON.parse(dispute.evidence_images) 
              : dispute.evidence_images;
          } else {
            dispute.evidence_images = [];
          }
        } catch (e) {
          console.error('解析 evidence_images 失败:', e);
          dispute.evidence_images = [];
        }
        
        await sendDisputeNotification(io, respondent_id, 'new_dispute', {
          id: dispute.id,
          item_id: dispute.item_id,
          item_title: dispute.item_title,
          initiator_id: dispute.initiator_id,
          dispute_type: dispute.dispute_type,
          description: dispute.description,
          status: dispute.status
        });
      }
    }

    res.status(201).json({
      success: true,
      message: '纠纷已提交，等待对方响应',
      dispute_id: result.insertId
    });
  } catch (error) {
    console.error('发起纠纷错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 响应纠纷
const respondToDispute = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { response_description, response_evidence_images } = req.body;

    // 验证必填字段
    if (!response_description) {
      return res.status(400).json({
        success: false,
        message: '响应描述是必填项'
      });
    }

    // 验证描述长度
    if (response_description.length < 10 || response_description.length > 500) {
      return res.status(400).json({
        success: false,
        message: '响应描述应为10-500个字符'
      });
    }

    // 验证证据图片数量
    if (response_evidence_images && Array.isArray(response_evidence_images)) {
      if (response_evidence_images.length > 3) {
        return res.status(400).json({
          success: false,
          message: '最多上传3张证据图片'
        });
      }
    }

    // 检查纠纷是否存在
    const [disputes] = await query(
      'SELECT * FROM disputes WHERE id = ?',
      [id]
    );

    if (disputes.length === 0) {
      return res.status(404).json({
        success: false,
        message: '纠纷不存在'
      });
    }

    const dispute = disputes[0];

    // 验证用户是否有权限响应（必须是响应者）
    if (Number(dispute.respondent_id) !== Number(userId)) {
      return res.status(403).json({
        success: false,
        message: '您无权响应此纠纷'
      });
    }

    // 检查纠纷状态
    if (dispute.status !== 'pending_response') {
      return res.status(400).json({
        success: false,
        message: '该纠纷已处理，无法响应'
      });
    }

    // 检查是否超时（48小时）
    const createdAt = new Date(dispute.created_at);
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);

    if (hoursDiff > 48) {
      // 超时，自动支持发起者
      await query(
        `UPDATE disputes 
         SET status = 'pending_review', 
         admin_review_result = 'support_initiator',
         admin_review_reason = '响应超时，自动支持发起者',
         reviewed_at = NOW()
         WHERE id = ?`,
        [id]
      );

      return res.status(400).json({
        success: false,
        message: '响应时间已过期（48小时），系统已自动处理'
      });
    }

    // 更新纠纷响应
    const responseEvidenceJson = response_evidence_images && Array.isArray(response_evidence_images)
      ? JSON.stringify(response_evidence_images)
      : null;

    await query(
      `UPDATE disputes 
       SET response_description = ?, 
           response_evidence_images = ?, 
           status = 'pending_review',
           responded_at = NOW()
       WHERE id = ?`,
      [response_description, responseEvidenceJson, id]
    );

    // 发送通知给发起者和管理员
    const io = getIO(req);
    if (io) {
      const [disputeInfo] = await query(
        `SELECT d.*, i.title as item_title 
         FROM disputes d 
         LEFT JOIN items i ON d.item_id = i.id 
         WHERE d.id = ?`,
        [id]
      );
      
      if (disputeInfo.length > 0) {
        const dispute = disputeInfo[0];
        // 安全解析JSON字段
        try {
          if (dispute.response_evidence_images) {
            dispute.response_evidence_images = typeof dispute.response_evidence_images === 'string'
              ? JSON.parse(dispute.response_evidence_images)
              : dispute.response_evidence_images;
          } else {
            dispute.response_evidence_images = [];
          }
        } catch (e) {
          console.error('解析 response_evidence_images 失败:', e);
          dispute.response_evidence_images = [];
        }
        
        // 通知发起者
        await sendDisputeNotification(io, dispute.initiator_id, 'dispute_responded', {
          id: dispute.id,
          item_id: dispute.item_id,
          item_title: dispute.item_title,
          status: dispute.status
        });

        // 通知所有管理员（需要查询所有管理员）
        const [admins] = await query('SELECT id FROM users WHERE role = ?', ['admin']);
        for (const admin of admins) {
          await sendDisputeNotification(io, admin.id, 'dispute_pending_review', {
            id: dispute.id,
            item_id: dispute.item_id,
            item_title: dispute.item_title,
            status: dispute.status
          });
        }
      }
    }

    res.json({
      success: true,
      message: '响应已提交，等待平台审核'
    });
  } catch (error) {
    console.error('响应纠纷错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取纠纷详情
const getDisputeById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const [disputes] = await query(
      `SELECT 
        d.*,
        i.title as item_title,
        i.price as item_price,
        i.image_url as item_image,
        initiator.username as initiator_name,
        initiator.email as initiator_email,
        respondent.username as respondent_name,
        respondent.email as respondent_email,
        reviewer.username as reviewer_name
       FROM disputes d
       LEFT JOIN items i ON d.item_id = i.id
       LEFT JOIN users initiator ON d.initiator_id = initiator.id
       LEFT JOIN users respondent ON d.respondent_id = respondent.id
       LEFT JOIN users reviewer ON d.admin_reviewer_id = reviewer.id
       WHERE d.id = ?`,
      [id]
    );

    if (disputes.length === 0) {
      return res.status(404).json({
        success: false,
        message: '纠纷不存在'
      });
    }

    const dispute = disputes[0];

    // 验证用户是否有权限查看（必须是发起者、响应者或管理员）
    const isInitiator = Number(dispute.initiator_id) === Number(userId);
    const isRespondent = Number(dispute.respondent_id) === Number(userId);
    
    // 检查是否是管理员（需要从token中获取role，这里简化处理）
    // 实际应该从req.user中获取role信息
    if (!isInitiator && !isRespondent) {
      // 这里应该检查是否是管理员，暂时允许查看
      // 实际应该添加管理员检查中间件
    }

    // 安全解析JSON字段
    try {
      if (dispute.evidence_images) {
        dispute.evidence_images = typeof dispute.evidence_images === 'string'
          ? JSON.parse(dispute.evidence_images)
          : dispute.evidence_images;
      } else {
        dispute.evidence_images = [];
      }
    } catch (e) {
      console.error('解析 evidence_images 失败:', e);
      dispute.evidence_images = [];
    }

    try {
      if (dispute.response_evidence_images) {
        dispute.response_evidence_images = typeof dispute.response_evidence_images === 'string'
          ? JSON.parse(dispute.response_evidence_images)
          : dispute.response_evidence_images;
      } else {
        dispute.response_evidence_images = [];
      }
    } catch (e) {
      console.error('解析 response_evidence_images 失败:', e);
      dispute.response_evidence_images = [];
    }

    res.json({
      success: true,
      dispute
    });
  } catch (error) {
    console.error('获取纠纷详情错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取我的纠纷列表
const getMyDisputes = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type } = req.query; // 'initiated' 或 'responded'

    // 分页参数，避免大结果集导致排序内存耗尽
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    // 使用 UNION 替代 OR，以充分利用索引，避免 Out of sort memory 错误
    let countSql, sql, params, total;

    if (type === 'initiated') {
      // 只查询发起的纠纷
      countSql = `SELECT COUNT(*) as total FROM disputes d WHERE d.initiator_id = ?`;
      const [countResult] = await query(countSql, [userId]);
      total = countResult[0].total;

      sql = `
        SELECT 
          d.*,
          i.title as item_title,
          i.price as item_price,
          i.image_url as item_image,
          'initiator' as user_role
        FROM disputes d
        LEFT JOIN items i ON d.item_id = i.id
        WHERE d.initiator_id = ?
        ORDER BY d.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
      params = [userId];
    } else if (type === 'responded') {
      // 只查询响应的纠纷
      countSql = `SELECT COUNT(*) as total FROM disputes d WHERE d.respondent_id = ?`;
      const [countResult] = await query(countSql, [userId]);
      total = countResult[0].total;

      sql = `
        SELECT 
          d.*,
          i.title as item_title,
          i.price as item_price,
          i.image_url as item_image,
          'respondent' as user_role
        FROM disputes d
        LEFT JOIN items i ON d.item_id = i.id
        WHERE d.respondent_id = ?
        ORDER BY d.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
      params = [userId];
    } else {
      // 查询所有相关的纠纷（使用 UNION ALL 优化，避免 OR 条件导致索引失效）
      // 先查询总数（使用 UNION ALL 因为一个纠纷不可能同时匹配两个条件）
      countSql = `
        SELECT COUNT(*) as total FROM (
          SELECT id FROM disputes WHERE initiator_id = ?
          UNION ALL
          SELECT id FROM disputes WHERE respondent_id = ?
        ) as combined
      `;
      const [countResult] = await query(countSql, [userId, userId]);
      total = countResult[0].total;

      // 使用 UNION ALL 合并两个查询，然后在外部排序和分页
      sql = `
        SELECT * FROM (
          SELECT 
            d.*,
            i.title as item_title,
            i.price as item_price,
            i.image_url as item_image,
            'initiator' as user_role
          FROM disputes d
          LEFT JOIN items i ON d.item_id = i.id
          WHERE d.initiator_id = ?
          UNION ALL
          SELECT 
            d.*,
            i.title as item_title,
            i.price as item_price,
            i.image_url as item_image,
            'respondent' as user_role
          FROM disputes d
          LEFT JOIN items i ON d.item_id = i.id
          WHERE d.respondent_id = ?
        ) as combined_results
        ORDER BY created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
      params = [userId, userId];
    }

    const [disputes] = await query(sql, params);

    // 解析JSON字段（安全处理，可能是字符串或已经是对象）
    disputes.forEach(dispute => {
      try {
        if (dispute.evidence_images) {
          if (typeof dispute.evidence_images === 'string') {
            // 如果是字符串，尝试解析
            dispute.evidence_images = JSON.parse(dispute.evidence_images);
          }
          // 如果已经是对象/数组，保持不变
        } else {
          dispute.evidence_images = [];
        }
      } catch (e) {
        console.error('解析 evidence_images 失败:', e);
        dispute.evidence_images = [];
      }

      try {
        if (dispute.response_evidence_images) {
          if (typeof dispute.response_evidence_images === 'string') {
            // 如果是字符串，尝试解析
            dispute.response_evidence_images = JSON.parse(dispute.response_evidence_images);
          }
          // 如果已经是对象/数组，保持不变
        } else {
          dispute.response_evidence_images = [];
        }
      } catch (e) {
        console.error('解析 response_evidence_images 失败:', e);
        dispute.response_evidence_images = [];
      }
    });

    res.json({
      success: true,
      disputes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取我的纠纷列表错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 确认处理结果
const confirmDisputeResult = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { action } = req.body; // 'accept' 或 'appeal'

    if (!['accept', 'appeal', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: '无效的操作'
      });
    }

    // 检查纠纷是否存在
    const [disputes] = await query('SELECT * FROM disputes WHERE id = ?', [id]);

    if (disputes.length === 0) {
      return res.status(404).json({
        success: false,
        message: '纠纷不存在'
      });
    }

    const dispute = disputes[0];

    // 验证用户权限
    if (Number(dispute.initiator_id) !== Number(userId) && 
        Number(dispute.respondent_id) !== Number(userId)) {
      return res.status(403).json({
        success: false,
        message: '您无权操作此纠纷'
      });
    }

    // 根据操作类型检查纠纷状态
    if (action === 'appeal') {
      // 申诉：允许在 resolved、appeal_resolved 或 appealed（如果上一次申诉已处理）状态下申诉
      const validAppealStatuses = ['resolved', 'appeal_resolved'];
      
      // 如果状态是 appealed，检查是否还有待审核的申诉
      if (dispute.status === 'appealed') {
        const [pendingAppeals] = await query(
          `SELECT COUNT(*) as count FROM appeals WHERE dispute_id = ? AND status = 'pending_review'`,
          [id]
        );
        // 如果没有待审核的申诉，说明上一次申诉已处理，可以再次申诉
        if (pendingAppeals[0].count === 0) {
          validAppealStatuses.push('appealed');
        }
      }
      
      if (!validAppealStatuses.includes(dispute.status)) {
        return res.status(400).json({
          success: false,
          message: '该纠纷状态不允许申诉，请先等待审核完成'
        });
      }
    } else {
      // accept 或 reject：只能在 resolved 或 appeal_resolved 状态下操作
    if (dispute.status !== 'resolved' && dispute.status !== 'appeal_resolved') {
      return res.status(400).json({
        success: false,
        message: '该纠纷尚未有处理结果'
      });
      }
    }

    const isInitiator = Number(dispute.initiator_id) === Number(userId);
    const isRespondent = Number(dispute.respondent_id) === Number(userId);

    if (action === 'accept') {
      // 接受结果，更新确认状态
      if (isInitiator) {
        await query(
          'UPDATE disputes SET initiator_confirmed = TRUE, initiator_confirmed_at = NOW() WHERE id = ?',
          [id]
        );
      } else if (isRespondent) {
        await query(
          'UPDATE disputes SET respondent_confirmed = TRUE, respondent_confirmed_at = NOW() WHERE id = ?',
          [id]
        );
      }

      // 判断用户是否是败诉方，如果是败诉方接受结果，给予信用分奖励
      const finalResult = dispute.appeal_review_result || dispute.admin_review_result;
      if (finalResult) {
        let isLosingParty = false;
        if (finalResult === 'support_initiator' && isRespondent) {
          // 支持发起者，响应者是败诉方
          isLosingParty = true;
        } else if (finalResult === 'support_respondent' && isInitiator) {
          // 支持响应者，发起者是败诉方
          isLosingParty = true;
        } else if (finalResult === 'partial_refund' || finalResult === 'no_support') {
          // 部分退款或不支持：双方都是败诉方
          isLosingParty = true;
        }

        if (isLosingParty) {
          // 败诉方接受结果，给予+2分奖励（鼓励服从安排）
          const [users] = await query('SELECT COALESCE(credit_score, 100) as credit_score FROM users WHERE id = ?', [userId]);
          if (users.length > 0) {
            const currentScore = users[0].credit_score !== null && users[0].credit_score !== undefined 
              ? parseFloat(users[0].credit_score) 
              : 100;
            const newScore = Math.max(0, Math.min(100, currentScore + 2)); // 奖励2分

            await query(
              'UPDATE users SET credit_score = ? WHERE id = ?',
              [newScore, userId]
            );

            // 记录信用变更
            await query(
              `INSERT INTO credit_records 
               (user_id, change_type, change_amount, score_before, score_after, related_dispute_id, description)
               VALUES (?, 'dispute_reward', 2, ?, ?, ?, ?)`,
              [
                userId,
                currentScore,
                newScore,
                dispute.id,
                '败诉方接受审核结果，信用分+2（鼓励服从安排）'
              ]
            );
            console.log(`✅ 败诉方接受结果奖励: 用户 ${userId} ${currentScore} -> ${newScore} (+2)`);
          }
        }
      }

      // 如果双方都确认了，更新订单状态
      const [updatedDispute] = await query('SELECT * FROM disputes WHERE id = ?', [id]);
      if (updatedDispute.length > 0 && updatedDispute[0].initiator_confirmed && updatedDispute[0].respondent_confirmed) {
        const [items] = await query('SELECT status FROM items WHERE id = ?', [dispute.item_id]);
        if (items.length > 0 && items[0].status === 'disputed') {
          // 根据处理结果更新订单状态
          const finalResult = dispute.appeal_review_result || dispute.admin_review_result;
          if (finalResult === 'support_initiator') {
            // 支持发起者，订单取消
            await query('UPDATE items SET status = ? WHERE id = ?', ['available', dispute.item_id]);
          } else {
            // 其他情况，订单完成
            await query('UPDATE items SET status = ? WHERE id = ?', ['sold', dispute.item_id]);
          }
        }
      }

      res.json({
        success: true,
        message: '已接受处理结果'
      });
    } else if (action === 'reject') {
      // 拒绝接受结果（不服从安排）
      await banService.handleRejectResult(dispute, userId);

      // 更新拒绝状态
      if (isInitiator) {
        await query(
          'UPDATE disputes SET initiator_rejected = TRUE WHERE id = ?',
          [id]
        );
      } else if (isRespondent) {
        await query(
          'UPDATE disputes SET respondent_rejected = TRUE WHERE id = ?',
          [id]
        );
      }

      res.json({
        success: true,
        message: '已记录拒绝接受结果，系统已自动处理'
      });
    } else if (action === 'appeal') {
      const { appeal_description, appeal_evidence_images } = req.body;

      if (!appeal_description || appeal_description.length < 10 || appeal_description.length > 500) {
        return res.status(400).json({
          success: false,
          message: '申诉描述应为10-500个字符'
        });
      }

      const appealEvidenceJson = appeal_evidence_images && Array.isArray(appeal_evidence_images)
        ? JSON.stringify(appeal_evidence_images)
        : null;

      // 记录新的申诉（允许多次申诉）
      const [appealResult] = await query(
        `INSERT INTO appeals 
         (dispute_id, appellant_id, description, evidence_images, status) 
         VALUES (?, ?, ?, ?, 'pending_review')`,
        [id, userId, appeal_description, appealEvidenceJson]
      );

      // 更新纠纷状态为申诉中，但保留之前的审核结果以便改判时对比
      await query(
        `UPDATE disputes 
         SET status = 'appealed',
             appeal_description = ?,
             appeal_evidence_images = ?,
             appeal_review_result = appeal_review_result, -- 保持上次申诉结果
             appeal_review_reason = appeal_review_reason
         WHERE id = ?`,
        [appeal_description, appealEvidenceJson, id]
      );

      // 发送通知给管理员
      const io = getIO(req);
      if (io) {
        const [disputeInfo] = await query(
          `SELECT d.*, i.title as item_title 
           FROM disputes d 
           LEFT JOIN items i ON d.item_id = i.id 
           WHERE d.id = ?`,
          [id]
        );
        
        if (disputeInfo.length > 0) {
          const disputeData = disputeInfo[0];
          
          // 通知所有管理员
          const [admins] = await query('SELECT id FROM users WHERE role = ?', ['admin']);
          for (const admin of admins) {
            await sendDisputeNotification(io, admin.id, 'dispute_appealed', {
              id: disputeData.id,
              item_id: disputeData.item_id,
              item_title: disputeData.item_title,
              status: 'appealed',
              appeal_id: appealResult.insertId
            });
          }
        }
      }

      res.json({
        success: true,
        message: '申诉已提交，等待平台审核'
      });
    }
  } catch (error) {
    console.error('确认纠纷结果错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

module.exports = {
  createDispute,
  respondToDispute,
  getDisputeById,
  getMyDisputes,
  confirmDisputeResult
};

