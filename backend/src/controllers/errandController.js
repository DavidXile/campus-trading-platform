const { query } = require('../config/db');

// 辅助函数：将ISO日期时间字符串转换为MySQL DATETIME格式
const formatDateTimeForMySQL = (dateTimeString) => {
  if (!dateTimeString) return null;
  try {
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) return null;
    // 格式化为 MySQL DATETIME 格式: YYYY-MM-DD HH:MM:SS
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (err) {
    console.error('日期格式转换错误:', err);
    return null;
  }
};

// 发布跑腿任务
const createErrand = async (req, res) => {
  try {
    const { title, description, location, destination, reward, category, contact_info, deadline } = req.body;
    const publisher_id = req.user.userId;

    // 验证必填字段
    if (!title || !location || reward === undefined || reward === null || reward === '') {
      return res.status(400).json({
        success: false,
        message: '标题、地点和报酬是必填项'
      });
    }

    // 转换并验证报酬格式
    const rewardNum = parseFloat(reward);
    if (isNaN(rewardNum) || rewardNum <= 0) {
      return res.status(400).json({
        success: false,
        message: '报酬必须是一个大于0的数字'
      });
    }

    // 验证报酬范围 (DECIMAL(10,2) 最大值为 99999999.99)
    const MAX_REWARD = 99999999.99;
    if (rewardNum > MAX_REWARD) {
      return res.status(400).json({
        success: false,
        message: `报酬不能超过 ¥${MAX_REWARD.toLocaleString('zh-CN')}`
      });
    }

    // 转换日期时间格式为MySQL格式
    const deadlineFormatted = formatDateTimeForMySQL(deadline);
    if (deadline && !deadlineFormatted) {
      return res.status(400).json({
        success: false,
        message: '截止时间格式不正确'
      });
    }

    // 插入新跑腿任务
    const [result] = await query(
      `INSERT INTO errands (title, description, location, destination, reward, category, contact_info, deadline, publisher_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || '', location, destination || '', rewardNum, category || '', contact_info || '', deadlineFormatted, publisher_id]
    );

    res.status(201).json({
      success: true,
      message: '跑腿任务发布成功',
      errandId: result.insertId
    });

  } catch (error) {
    console.error('发布跑腿任务错误:', error.message);
    console.error('完整错误:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// 获取跑腿任务列表
const getErrands = async (req, res) => {
  try {
    const { status, category, search } = req.query;
    const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const offset = (pageNum - 1) * limitNum;

    let sql = `
      SELECT e.*, 
             u1.username as publisher_name, u1.email as publisher_email,
             u2.username as accepter_name, u2.email as accepter_email
      FROM errands e
      LEFT JOIN users u1 ON e.publisher_id = u1.id
      LEFT JOIN users u2 ON e.accepter_id = u2.id
      WHERE 1=1
    `;
    const params = [];

    // 默认只显示待接单的任务
    if (!status) {
      sql += ' AND e.status = ?';
      params.push('pending');
    } else if (status !== 'all') {
      sql += ' AND e.status = ?';
      params.push(status);
    }

    if (category) {
      sql += ' AND e.category = ?';
      params.push(category);
    }

    if (search) {
      sql += ' AND (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ` ORDER BY e.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const [errands] = await query(sql, params);

    // 获取总数
    let countSql = 'SELECT COUNT(*) as count FROM errands e WHERE 1=1';
    const countParams = [];
    if (!status) {
      countSql += ' AND e.status = ?';
      countParams.push('pending');
    } else if (status !== 'all') {
      countSql += ' AND e.status = ?';
      countParams.push(status);
    }
    if (category) {
      countSql += ' AND e.category = ?';
      countParams.push(category);
    }
    if (search) {
      countSql += ' AND (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)';
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }
    const [countResult] = await query(countSql, countParams);
    const total = countResult[0].count;

    res.json({
      success: true,
      errands: errands,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取跑腿任务列表错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取单个跑腿任务详情
const getErrandById = async (req, res) => {
  try {
    const { id } = req.params;

    // 动态检查字段是否存在
    const dbName = process.env.DB_NAME || 'campus_trading';
    let selectFields = `e.*, 
              u1.username as publisher_name, u1.email as publisher_email,
             u2.username as accepter_name, u2.email as accepter_email`;
    
    try {
      const [confirmedFields] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'errands' AND COLUMN_NAME IN ('confirmed_by_publisher', 'confirmed_by_accepter')",
        [dbName]
      );
      if (confirmedFields.length > 0) {
        selectFields += ', e.confirmed_by_publisher, e.confirmed_by_accepter';
      }
    } catch (e) {
      // 忽略检查错误
    }

    const [errands] = await query(
      `SELECT ${selectFields}
       FROM errands e
       LEFT JOIN users u1 ON e.publisher_id = u1.id
       LEFT JOIN users u2 ON e.accepter_id = u2.id
       WHERE e.id = ?`,
      [id]
    );

    if (errands.length === 0) {
      return res.status(404).json({
        success: false,
        message: '跑腿任务不存在'
      });
    }

    res.json({
      success: true,
      errand: errands[0]
    });
  } catch (error) {
    console.error('获取跑腿任务详情错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 接单（接受跑腿任务）
const acceptErrand = async (req, res) => {
  try {
    const { id } = req.params;
    const accepter_id = req.user.userId;

    // 检查任务是否存在
    const [errands] = await query('SELECT * FROM errands WHERE id = ?', [id]);
    if (errands.length === 0) {
      return res.status(404).json({
        success: false,
        message: '跑腿任务不存在'
      });
    }

    const errand = errands[0];

    // 检查任务状态
    if (errand.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: '该任务已被接单或已完成'
      });
    }

    // 不能接自己的任务
    if (errand.publisher_id === accepter_id) {
      return res.status(400).json({
        success: false,
        message: '不能接自己的任务'
      });
    }

    // 更新任务状态
    await query(
      'UPDATE errands SET status = ?, accepter_id = ?, accepted_at = NOW() WHERE id = ?',
      ['accepted', accepter_id, id]
    );

    res.json({
      success: true,
      message: '接单成功'
    });
  } catch (error) {
    console.error('接单错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 确认完成任务（需要双方都确认才能完成）
const confirmCompleteErrand = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // 检查任务是否存在
    const [errands] = await query('SELECT * FROM errands WHERE id = ?', [id]);
    if (errands.length === 0) {
      return res.status(404).json({
        success: false,
        message: '跑腿任务不存在'
      });
    }

    const errand = errands[0];

    // 检查任务状态
    if (errand.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: '该任务尚未被接单'
      });
    }

    // 只有接单者或发布者可以确认完成
    if (errand.accepter_id !== userId && errand.publisher_id !== userId) {
      return res.status(403).json({
        success: false,
        message: '您没有权限确认完成此任务'
      });
    }

    // 判断是发布者还是接单者
    const isPublisher = Number(errand.publisher_id) === Number(userId);
    const isAccepter = Number(errand.accepter_id) === Number(userId);

    // 检查确认字段是否存在
    const dbName = process.env.DB_NAME || 'campus_trading';
    let hasConfirmedFields = false;
    try {
      const [confirmedFields] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'errands' AND COLUMN_NAME IN ('confirmed_by_publisher', 'confirmed_by_accepter')",
        [dbName]
      );
      hasConfirmedFields = confirmedFields.length >= 2;
    } catch (err) {
      console.log('检查确认字段时出错:', err);
    }

    // 如果确认字段存在，使用双方确认机制
    if (hasConfirmedFields) {
      // 更新确认状态
      if (isPublisher) {
        await query(
          'UPDATE errands SET confirmed_by_publisher = TRUE WHERE id = ?',
          [id]
        );
      } else if (isAccepter) {
        await query(
          'UPDATE errands SET confirmed_by_accepter = TRUE WHERE id = ?',
          [id]
        );
      }

      // 重新获取任务状态，检查是否双方都已确认
      const [updatedErrands] = await query('SELECT confirmed_by_publisher, confirmed_by_accepter FROM errands WHERE id = ?', [id]);
      const updatedErrand = updatedErrands[0];

      // 处理MySQL BOOLEAN类型（可能返回0/1或true/false）
      const publisherConfirmed = updatedErrand.confirmed_by_publisher === 1 || updatedErrand.confirmed_by_publisher === true || updatedErrand.confirmed_by_publisher === '1';
      const accepterConfirmed = updatedErrand.confirmed_by_accepter === 1 || updatedErrand.confirmed_by_accepter === true || updatedErrand.confirmed_by_accepter === '1';

      // 如果双方都已确认，标记为已完成
      if (publisherConfirmed && accepterConfirmed) {
        await query(
          'UPDATE errands SET status = ?, completed_at = NOW() WHERE id = ?',
          ['completed', id]
        );

        res.json({
          success: true,
          message: '任务已完成',
          completed: true
        });
      } else {
        // 只有一方确认
        const waitingFor = isPublisher ? '接单者' : '发布者';
        res.json({
          success: true,
          message: `已确认完成，等待${waitingFor}确认`,
          completed: false
        });
      }
    } else {
      // 如果确认字段不存在，直接标记为已完成（简化流程）
      await query(
        'UPDATE errands SET status = ?, completed_at = NOW() WHERE id = ?',
        ['completed', id]
      );

      res.json({
        success: true,
        message: '任务已完成',
        completed: true
      });
    }
  } catch (error) {
    console.error('确认完成任务错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 完成任务（保留向后兼容，但实际使用 confirmCompleteErrand）
const completeErrand = confirmCompleteErrand;

// 取消任务
const cancelErrand = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // 检查任务是否存在
    const [errands] = await query('SELECT * FROM errands WHERE id = ?', [id]);
    if (errands.length === 0) {
      return res.status(404).json({
        success: false,
        message: '跑腿任务不存在'
      });
    }

    const errand = errands[0];

    // 只有发布者可以取消任务
    if (errand.publisher_id !== userId) {
      return res.status(403).json({
        success: false,
        message: '只有发布者可以取消任务'
      });
    }

    // 如果任务已被接单，不能取消
    if (errand.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: '任务已被接单，无法取消'
      });
    }

    // 如果任务已完成，不能取消
    if (errand.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: '任务已完成，无法取消'
      });
    }

    // 更新任务状态
    await query(
      'UPDATE errands SET status = ? WHERE id = ?',
      ['cancelled', id]
    );

    res.json({
      success: true,
      message: '任务已取消'
    });
  } catch (error) {
    console.error('取消任务错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取我的跑腿任务（发布的和接单的）
const getMyErrands = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type = 'all', status } = req.query; // type: 'published', 'accepted', 'all'

    let sql = `
      SELECT e.*, 
             u1.username as publisher_name, u1.email as publisher_email,
             u2.username as accepter_name, u2.email as accepter_email
      FROM errands e
      LEFT JOIN users u1 ON e.publisher_id = u1.id
      LEFT JOIN users u2 ON e.accepter_id = u2.id
      WHERE 1=1
    `;
    const params = [];

    if (type === 'published') {
      sql += ' AND e.publisher_id = ?';
      params.push(userId);
    } else if (type === 'accepted') {
      sql += ' AND e.accepter_id = ?';
      params.push(userId);
    } else {
      sql += ' AND (e.publisher_id = ? OR e.accepter_id = ?)';
      params.push(userId, userId);
    }

    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY e.created_at DESC';

    const [errands] = await query(sql, params);

    res.json({
      success: true,
      errands: errands
    });
  } catch (error) {
    console.error('获取我的跑腿任务错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 更新跑腿任务（仅发布者，且任务未被接单）
const updateErrand = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { title, description, location, destination, reward, category, contact_info, deadline } = req.body;

    // 检查任务是否存在
    const [errands] = await query('SELECT * FROM errands WHERE id = ?', [id]);
    if (errands.length === 0) {
      return res.status(404).json({
        success: false,
        message: '跑腿任务不存在'
      });
    }

    const errand = errands[0];

    // 只有发布者可以更新
    if (errand.publisher_id !== userId) {
      return res.status(403).json({
        success: false,
        message: '只有发布者可以更新任务'
      });
    }

    // 如果任务已被接单，不能更新
    if (errand.status === 'accepted' || errand.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: '任务已被接单或已完成，无法更新'
      });
    }

    // 构建更新字段
    const updateFields = [];
    const updateParams = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      updateParams.push(title);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateParams.push(description);
    }
    if (location !== undefined) {
      updateFields.push('location = ?');
      updateParams.push(location);
    }
    if (destination !== undefined) {
      updateFields.push('destination = ?');
      updateParams.push(destination);
    }
    if (reward !== undefined) {
      const rewardNum = parseFloat(reward);
      if (isNaN(rewardNum) || rewardNum <= 0) {
        return res.status(400).json({
          success: false,
          message: '报酬必须是一个大于0的数字'
        });
      }
      // 验证报酬范围 (DECIMAL(10,2) 最大值为 99999999.99)
      const MAX_REWARD = 99999999.99;
      if (rewardNum > MAX_REWARD) {
        return res.status(400).json({
          success: false,
          message: `报酬不能超过 ¥${MAX_REWARD.toLocaleString('zh-CN')}`
        });
      }
      updateFields.push('reward = ?');
      updateParams.push(rewardNum);
    }
    if (category !== undefined) {
      updateFields.push('category = ?');
      updateParams.push(category);
    }
    if (contact_info !== undefined) {
      updateFields.push('contact_info = ?');
      updateParams.push(contact_info);
    }
    if (deadline !== undefined) {
      const deadlineFormatted = formatDateTimeForMySQL(deadline);
      if (deadline && !deadlineFormatted) {
        return res.status(400).json({
          success: false,
          message: '截止时间格式不正确'
        });
      }
      updateFields.push('deadline = ?');
      updateParams.push(deadlineFormatted);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有要更新的字段'
      });
    }

    updateParams.push(id);
    await query(
      `UPDATE errands SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );

    res.json({
      success: true,
      message: '任务更新成功'
    });
  } catch (error) {
    console.error('更新跑腿任务错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 删除跑腿任务（仅发布者，且任务未被接单）
const deleteErrand = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // 检查任务是否存在
    const [errands] = await query('SELECT * FROM errands WHERE id = ?', [id]);
    if (errands.length === 0) {
      return res.status(404).json({
        success: false,
        message: '跑腿任务不存在'
      });
    }

    const errand = errands[0];

    // 只有发布者可以删除
    if (errand.publisher_id !== userId) {
      return res.status(403).json({
        success: false,
        message: '只有发布者可以删除任务'
      });
    }

    // 如果任务已被接单，不能删除
    if (errand.status === 'accepted' || errand.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: '任务已被接单或已完成，无法删除'
      });
    }

    await query('DELETE FROM errands WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '任务删除成功'
    });
  } catch (error) {
    console.error('删除跑腿任务错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

module.exports = {
  createErrand,
  getErrands,
  getErrandById,
  acceptErrand,
  completeErrand,
  cancelErrand,
  getMyErrands,
  updateErrand,
  deleteErrand
};

