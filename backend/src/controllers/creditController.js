const { query } = require('../config/db');

// 获取当前用户的信用记录
const getMyCreditRecords = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // 获取信用记录总数
    const [countResult] = await query(
      'SELECT COUNT(*) as total FROM credit_records WHERE user_id = ?',
      [userId]
    );
    const total = countResult[0]?.total || 0;

    // 获取信用记录列表
    // 注意：LIMIT 和 OFFSET 必须使用数字，不能使用占位符
    const [records] = await query(
      `SELECT 
        cr.*,
        d.id as dispute_id,
        d.item_id,
        i.title as item_title
      FROM credit_records cr
      LEFT JOIN disputes d ON cr.related_dispute_id = d.id
      LEFT JOIN items i ON d.item_id = i.id
      WHERE cr.user_id = ?
      ORDER BY cr.created_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
      [userId]
    );

    res.json({
      success: true,
      records: records || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取信用记录错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

module.exports = {
  getMyCreditRecords
};

