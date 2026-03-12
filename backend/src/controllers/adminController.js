const { query } = require('../config/db');
const bcrypt = require('bcryptjs');
const paymentService = require('../services/paymentService');
const creditService = require('../services/creditService');
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

// 获取仪表板统计数据
const getDashboardStats = async (req, res) => {
  try {
    // 获取总用户数
    const [userCount] = await query('SELECT COUNT(*) as count FROM users');
    
    // 获取总商品数
    const [itemCount] = await query('SELECT COUNT(*) as count FROM items');
    
    // 获取在售商品数
    const [availableCount] = await query('SELECT COUNT(*) as count FROM items WHERE status = ?', ['available']);
    
    // 获取已售商品数
    const [soldCount] = await query('SELECT COUNT(*) as count FROM items WHERE status = ?', ['sold']);
    
    // 获取待审核纠纷数（如果disputes表存在）
    let pendingDisputesCount = 0;
    try {
      const [pendingDisputes] = await query(
        "SELECT COUNT(*) as count FROM disputes WHERE status IN ('pending_review', 'appealed')"
      );
      pendingDisputesCount = pendingDisputes[0].count;
    } catch (error) {
      // 如果disputes表不存在，返回0
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log('ℹ️  disputes表不存在，跳过纠纷统计');
      } else {
        throw error;
      }
    }
    
    // 获取最近7天注册的用户数
    const [recentUsers] = await query(
      'SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    
    // 获取最近7天发布的商品数
    const [recentItems] = await query(
      'SELECT COUNT(*) as count FROM items WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );

    res.json({
      success: true,
      stats: {
        totalUsers: userCount[0].count,
        totalItems: itemCount[0].count,
        availableItems: availableCount[0].count,
        soldItems: soldCount[0].count,
        pendingDisputes: pendingDisputesCount,
        recentUsers: recentUsers[0].count,
        recentItems: recentItems[0].count
      }
    });
  } catch (error) {
    console.error('获取统计数据错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取所有用户列表
const getAllUsers = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (pageNum - 1) * limitNum;

    // 检查字段是否存在，动态构建SQL
    let sql = 'SELECT id, username, email, role, created_at';
    try {
      const dbName = process.env.DB_NAME || 'campus_trading';
      
      // 检查封禁相关字段
      const [bannedCol] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_banned'",
        [dbName]
      );
      if (bannedCol.length > 0) {
        // 逐个检查每个字段是否存在
        const [banReasonCol] = await query(
          "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'ban_reason'",
          [dbName]
        );
        const [bannedAtCol] = await query(
          "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'banned_at'",
          [dbName]
        );
        const [banExpiresAtCol] = await query(
          "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'ban_expires_at'",
          [dbName]
        );
        
        if (banReasonCol.length > 0) sql += ', ban_reason';
        if (bannedAtCol.length > 0) sql += ', banned_at';
        if (banExpiresAtCol.length > 0) sql += ', ban_expires_at';
        sql += ', is_banned';
      }
      
      // 检查信用分字段
      const [creditCol] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'credit_score'",
        [dbName]
      );
      if (creditCol.length > 0) {
        sql += ', credit_score';
      }
    } catch (err) {
      console.log('检查字段时出错，使用基础字段:', err.message);
    }
    sql += ' FROM users WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (username LIKE ? OR email LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += ` ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const [users] = await query(sql, params);

    // 获取总数
    let countSql = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
    const countParams = [];
    if (search) {
      countSql += ' AND (username LIKE ? OR email LIKE ?)';
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern);
    }
    const [countResult] = await query(countSql, countParams);
    const total = countResult[0].count;

    res.json({
      success: true,
      users: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    console.error('错误详情:', error.message);
    res.status(500).json({
      success: false,
      message: `获取用户列表失败: ${error.message}`
    });
  }
};

// 更新用户角色
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: '无效的角色，必须是 user 或 admin'
      });
    }

    // 不能修改自己的角色
    if (parseInt(userId) === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: '不能修改自己的角色'
      });
    }

    await query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

    res.json({
      success: true,
      message: '用户角色更新成功'
    });
  } catch (error) {
    console.error('更新用户角色错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 删除用户
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // 不能删除自己
    if (parseInt(userId) === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: '不能删除自己的账户'
      });
    }

    await query('DELETE FROM users WHERE id = ?', [userId]);

    res.json({
      success: true,
      message: '用户删除成功'
    });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取所有商品（管理员视图，包括已售商品）
const getAllItems = async (req, res) => {
  try {
    const { status, search = '' } = req.query;
    const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (pageNum - 1) * limitNum;

    let sql = `
      SELECT i.*, u.username as seller_name, u.email as seller_email 
      FROM items i 
      LEFT JOIN users u ON i.seller_id = u.id 
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND i.status = ?';
      params.push(status);
    }

    if (search) {
      sql += ' AND (i.title LIKE ? OR i.description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += ` ORDER BY i.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const [items] = await query(sql, params);

    // 获取总数
    let countSql = 'SELECT COUNT(*) as count FROM items i WHERE 1=1';
    const countParams = [];
    if (status) {
      countSql += ' AND i.status = ?';
      countParams.push(status);
    }
    if (search) {
      countSql += ' AND (i.title LIKE ? OR i.description LIKE ?)';
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern);
    }
    const [countResult] = await query(countSql, countParams);
    const total = countResult[0].count;

    res.json({
      success: true,
      items: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取商品列表错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 删除商品（管理员）
const deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    await query('DELETE FROM items WHERE id = ?', [itemId]);

    res.json({
      success: true,
      message: '商品删除成功'
    });
  } catch (error) {
    console.error('删除商品错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取所有纠纷列表
const getAllDisputes = async (req, res) => {
  try {
    const { status, search = '' } = req.query;
    const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (pageNum - 1) * limitNum;

    // 优化查询：先排序再JOIN，避免大临时表
    // 先获取排序后的纠纷ID列表
    let subQuery = `
      SELECT d.id
      FROM disputes d
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      subQuery += ' AND d.status = ?';
      params.push(status);
      console.log('🔍 管理员查询纠纷，状态筛选:', status);
    }

    if (search) {
      // 如果搜索，需要先JOIN items表
      subQuery = `
        SELECT DISTINCT d.id
        FROM disputes d
        LEFT JOIN items i ON d.item_id = i.id
        WHERE 1=1
      `;
      if (status) {
        subQuery += ' AND d.status = ?';
      }
      subQuery += ' AND (i.title LIKE ? OR d.description LIKE ?)';
      const searchPattern = `%${search}%`;
      if (status) {
        params.push(status, searchPattern, searchPattern);
      } else {
        params.push(searchPattern, searchPattern);
      }
    }

    subQuery += ` ORDER BY d.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    // 获取排序后的ID列表
    const [sortedIds] = await query(subQuery, params);
    
    if (sortedIds.length === 0) {
      return res.json({
        success: true,
        disputes: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          pages: 0
        }
      });
    }

    const disputeIds = sortedIds.map(row => row.id);
    const placeholders = disputeIds.map(() => '?').join(',');

    // 使用IN子句获取完整数据，保持ID顺序
    let sql = `
      SELECT 
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
      WHERE d.id IN (${placeholders})
      ORDER BY FIELD(d.id, ${placeholders})
    `;

    const [disputes] = await query(sql, [...disputeIds, ...disputeIds]);

    // 安全解析JSON字段
    disputes.forEach(dispute => {
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

      try {
        if (dispute.appeal_evidence_images) {
          dispute.appeal_evidence_images = typeof dispute.appeal_evidence_images === 'string'
            ? JSON.parse(dispute.appeal_evidence_images)
            : dispute.appeal_evidence_images;
        } else {
          dispute.appeal_evidence_images = [];
        }
      } catch (e) {
        console.error('解析 appeal_evidence_images 失败:', e);
        dispute.appeal_evidence_images = [];
      }
    });

    // 获取总数
    let countSql = 'SELECT COUNT(*) as count FROM disputes d LEFT JOIN items i ON d.item_id = i.id WHERE 1=1';
    const countParams = [];
    if (status) {
      countSql += ' AND d.status = ?';
      countParams.push(status);
    }
    if (search) {
      countSql += ' AND (i.title LIKE ? OR d.description LIKE ?)';
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern);
    }
    const [countResult] = await query(countSql, countParams);
    const total = countResult[0].count;

    res.json({
      success: true,
      disputes: disputes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取纠纷列表错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取纠纷详情（管理员）
const getDisputeDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const [disputes] = await query(
      `SELECT 
        d.*,
        i.title as item_title,
        i.price as item_price,
        i.description as item_description,
        i.image_url as item_image,
        i.status as item_status,
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

    try {
      if (dispute.appeal_evidence_images) {
        dispute.appeal_evidence_images = typeof dispute.appeal_evidence_images === 'string'
          ? JSON.parse(dispute.appeal_evidence_images)
          : dispute.appeal_evidence_images;
      } else {
        dispute.appeal_evidence_images = [];
      }
    } catch (e) {
      console.error('解析 appeal_evidence_images 失败:', e);
      dispute.appeal_evidence_images = [];
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

// 审核纠纷（初始审核或申诉审核）
const reviewDispute = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { review_result, review_reason, is_appeal } = req.body;

    // 验证必填字段
    if (!review_result || !review_reason) {
      return res.status(400).json({
        success: false,
        message: '审核结果和审核理由都是必填项'
      });
    }

    // 验证审核结果
    const validResults = ['support_initiator', 'support_respondent', 'partial_refund', 'no_support'];
    if (!validResults.includes(review_result)) {
      return res.status(400).json({
        success: false,
        message: '无效的审核结果'
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

    // 检查纠纷状态
    if (is_appeal) {
      // 申诉审核
      if (dispute.status !== 'appealed') {
        return res.status(400).json({
          success: false,
          message: '该纠纷尚未申诉，无法进行申诉审核'
        });
      }

      // 获取最新待审核的申诉记录
      const [pendingAppeals] = await query(
        `SELECT * FROM appeals WHERE dispute_id = ? AND status = 'pending_review' ORDER BY created_at DESC LIMIT 1`,
        [id]
      );
      if (pendingAppeals.length === 0) {
        return res.status(400).json({
          success: false,
          message: '没有待审核的申诉记录'
        });
      }

      const appealRecord = pendingAppeals[0];

      // 更新申诉审核结果（appeals 表 + disputes 汇总字段）
      await query(
        `UPDATE appeals 
         SET review_result = ?, review_reason = ?, reviewer_id = ?, status = 'resolved', reviewed_at = NOW()
         WHERE id = ?`,
        [review_result, review_reason, userId, appealRecord.id]
      );

      await query(
        `UPDATE disputes 
         SET appeal_review_result = ?,
             appeal_review_reason = ?,
             status = 'appeal_resolved',
             appeal_reviewed_at = NOW()
         WHERE id = ?`,
        [review_result, review_reason, id]
      );

      // 申诉审核 - 需要处理改判情况
      // 获取商品信息和之前的最终结果（上一次申诉结果或初审结果）
      const [items] = await query(
        `SELECT i.*, i.buyer_id, i.seller_id 
         FROM items i 
         WHERE i.id = ?`,
        [dispute.item_id]
      );

      if (items.length > 0) {
        const item = items[0];
        const itemPrice = parseFloat(item.price || 0);
        const previousResult = dispute.appeal_review_result || dispute.admin_review_result;
        const newResult = review_result;

        // 撤销上一结果的退款（如果有）
        if (itemPrice > 0 && Number(dispute.initiator_id) === Number(item.buyer_id)) {
          if (previousResult === 'support_initiator') {
              await paymentService.reverseRefund({
                dispute_id: id,
                buyer_id: dispute.initiator_id,
                seller_id: dispute.respondent_id,
                item_id: dispute.item_id,
                refund_amount: itemPrice,
              reason: `申诉改判：撤销之前的全额退款（${review_reason}）`
              });
          } else if (previousResult === 'partial_refund') {
              const partialAmount = itemPrice * 0.5;
              await paymentService.reverseRefund({
                dispute_id: id,
                buyer_id: dispute.initiator_id,
                seller_id: dispute.respondent_id,
                item_id: dispute.item_id,
                refund_amount: partialAmount,
              reason: `申诉改判：撤销之前的部分退款（${review_reason}）`
              });
            }
        }

        // 应用新结果的退款
        if (newResult === 'support_initiator' && itemPrice > 0 && Number(dispute.initiator_id) === Number(item.buyer_id)) {
            await paymentService.processFullRefund({
              dispute_id: id,
              buyer_id: dispute.initiator_id,
              seller_id: dispute.respondent_id,
              item_id: dispute.item_id,
              refund_amount: itemPrice,
              reason: `申诉审核支持发起者，全额退款（${review_reason}）`
            });
        } else if (newResult === 'partial_refund' && itemPrice > 0 && Number(dispute.initiator_id) === Number(item.buyer_id)) {
          const refundAmount = itemPrice * 0.5;
            await paymentService.processPartialRefund({
              dispute_id: id,
              buyer_id: dispute.initiator_id,
              seller_id: dispute.respondent_id,
              item_id: dispute.item_id,
              refund_amount: refundAmount,
              reason: `申诉审核部分退款，退款50%（${review_reason}）`
            });
        }

        // 处理信用分调整（撤销上一结果，再应用新结果）
        await creditService.handleDisputeCredit(dispute, newResult, true, previousResult);
      }
    } else {
      // 初始审核
      if (dispute.status !== 'pending_review') {
        return res.status(400).json({
          success: false,
          message: '该纠纷状态不正确，无法进行审核'
        });
      }

      // 更新审核结果
      await query(
        `UPDATE disputes 
         SET admin_review_result = ?,
             admin_review_reason = ?,
             admin_reviewer_id = ?,
             status = 'resolved',
             reviewed_at = NOW()
         WHERE id = ?`,
        [review_result, review_reason, userId, id]
      );

      // 获取商品信息以确定退款金额
      const [items] = await query(
        `SELECT i.*, i.buyer_id, i.seller_id 
         FROM items i 
         WHERE i.id = ?`,
        [dispute.item_id]
      );

      if (items.length > 0) {
        const item = items[0];
        const itemPrice = parseFloat(item.price || 0);

        // 根据审核结果处理退款和信用分
        try {
          console.log(`🔍 开始处理审核结果: ${review_result}, 纠纷ID: ${id}`);
          
          if (review_result === 'support_initiator') {
            // 支持发起者：全额退款给买家（发起者）
            if (itemPrice > 0 && Number(dispute.initiator_id) === Number(item.buyer_id)) {
              console.log(`💰 处理全额退款: 买家 ${dispute.initiator_id}, 金额 ${itemPrice}`);
              await paymentService.processFullRefund({
                dispute_id: id,
                buyer_id: dispute.initiator_id,
                seller_id: dispute.respondent_id,
                item_id: dispute.item_id,
                refund_amount: itemPrice,
                reason: `纠纷审核支持发起者，全额退款（${review_reason}）`
              });
            }
            // 处理信用分
            console.log(`📊 处理信用分: 支持发起者`);
            await creditService.handleDisputeCredit(dispute, review_result, false);
          } else if (review_result === 'support_respondent') {
            // 支持响应者：不退款，但扣减发起者信用分
            console.log(`📊 处理信用分: 支持响应者`);
            await creditService.handleDisputeCredit(dispute, review_result, false);
          } else if (review_result === 'partial_refund') {
            // 部分退款：退款50%给买家
            const refundAmount = itemPrice * 0.5;
            if (refundAmount > 0 && Number(dispute.initiator_id) === Number(item.buyer_id)) {
              console.log(`💰 处理部分退款: 买家 ${dispute.initiator_id}, 金额 ${refundAmount}`);
              await paymentService.processPartialRefund({
                dispute_id: id,
                buyer_id: dispute.initiator_id,
                seller_id: dispute.respondent_id,
                item_id: dispute.item_id,
                refund_amount: refundAmount,
                reason: `纠纷审核部分退款，退款50%（${review_reason}）`
              });
            }
            // 处理信用分
            console.log(`📊 处理信用分: 部分退款`);
            await creditService.handleDisputeCredit(dispute, review_result, false);
          } else if (review_result === 'no_support') {
            // 不支持任何一方：不退款，双方都轻微扣分
            console.log(`📊 处理信用分: 不支持`);
            await creditService.handleDisputeCredit(dispute, review_result, false);
          }

          console.log(`✅ 审核结果处理完成: ${review_result}`);
        } catch (paymentError) {
          console.error('❌ 处理退款或信用分失败:', paymentError);
          console.error('错误详情:', paymentError.message);
          console.error('错误堆栈:', paymentError.stack);
          // 继续执行，不中断审核流程，但记录详细错误
        }
      }
    }

    // 发送通知给双方
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
        const notificationData = {
          id: dispute.id,
          item_id: dispute.item_id,
          item_title: dispute.item_title,
          status: is_appeal ? 'appeal_resolved' : 'resolved',
          review_result: review_result,
          review_reason: review_reason
        };

        // 通知发起者
        await sendDisputeNotification(io, dispute.initiator_id, is_appeal ? 'appeal_reviewed' : 'dispute_reviewed', notificationData);

        // 通知响应者
        await sendDisputeNotification(io, dispute.respondent_id, is_appeal ? 'appeal_reviewed' : 'dispute_reviewed', notificationData);
      }
    }

    res.json({
      success: true,
      message: is_appeal ? '申诉审核完成' : '纠纷审核完成'
    });
  } catch (error) {
    console.error('审核纠纷错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 封禁用户
const banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, ban_type = 'temporary', duration_days = null } = req.body;
    const adminId = req.user.userId;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '封禁原因不能为空'
      });
    }

    if (!['temporary', 'permanent'].includes(ban_type)) {
      return res.status(400).json({
        success: false,
        message: '封禁类型必须是 temporary 或 permanent'
      });
    }

    if (ban_type === 'temporary' && (!duration_days || duration_days <= 0)) {
      return res.status(400).json({
        success: false,
        message: '临时封禁必须指定封禁天数'
      });
    }

    // 不能封禁自己
    if (parseInt(userId) === adminId) {
      return res.status(400).json({
        success: false,
        message: '不能封禁自己的账户'
      });
    }

    // 检查用户是否存在
    const [users] = await query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 不能封禁其他管理员
    if (users[0].role === 'admin') {
      return res.status(400).json({
        success: false,
        message: '不能封禁其他管理员'
      });
    }

    await banService.banUser({
      user_id: userId,
      admin_id: adminId,
      reason: reason.trim(),
      ban_type,
      duration_days: ban_type === 'temporary' ? parseInt(duration_days) : null
    });

    res.json({
      success: true,
      message: '用户封禁成功'
    });
  } catch (error) {
    console.error('封禁用户错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 解封用户
const unbanUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.userId;

    // 检查用户是否存在
    const [users] = await query('SELECT id, is_banned FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    if (!users[0].is_banned) {
      return res.status(400).json({
        success: false,
        message: '该用户未被封禁'
      });
    }

    await banService.unbanUser({
      user_id: userId,
      admin_id: adminId
    });

    res.json({
      success: true,
      message: '用户解封成功'
    });
  } catch (error) {
    console.error('解封用户错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  updateUserRole,
  deleteUser,
  banUser,
  unbanUser,
  getAllItems,
  deleteItem,
  getAllDisputes,
  getDisputeDetail,
  reviewDispute
};

