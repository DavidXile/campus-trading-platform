const { query } = require('../config/db');
const paymentService = require('../services/paymentService');

// 创建新物品
const createItem = async (req, res) => {
  try {
    const { title, description, price, category, image_url } = req.body;
    const seller_id = req.user.userId;

    // 验证必填字段
    if (!title || price === undefined || price === null || price === '') {
      return res.status(400).json({
        success: false,
        message: '标题和价格是必填项'
      });
    }

    // 转换并验证价格格式（确保是数字）
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({
        success: false,
        message: '价格必须是一个大于0的数字'
      });
    }

    // 插入新物品
    const [result] = await query(
      'INSERT INTO items (title, description, price, category, image_url, seller_id) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description || '', priceNum, category || '', image_url || '', seller_id]
    );

    res.status(201).json({
      success: true,
      message: '物品发布成功',
      itemId: result.insertId
    });

  } catch (error) {
    console.error('创建物品错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取所有在售物品
const getItems = async (req, res) => {
  try {
    const { category, search } = req.query;
    const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(req.query.limit, 10) || 10, 1);

    let sql = `
      SELECT
        i.id,
        i.title,
        i.description,
        i.price,
        i.category,
        i.image_url,
        i.status,
        i.created_at,
        u.username as seller_name,
        u.email as seller_email
      FROM items i
      JOIN users u ON i.seller_id = u.id
      WHERE i.status = 'available'
    `;

    const params = [];
    const conditions = [];

    // 分类筛选
    if (category) {
      conditions.push('i.category = ?');
      params.push(category);
    }

    // 搜索功能（标题和描述）
    if (search) {
      conditions.push('(i.title LIKE ? OR i.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }

    // 分页
    const offset = (pageNum - 1) * limitNum;
    sql += ` ORDER BY i.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const [items] = await query(sql, params);

    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM items WHERE status = "available"';
    const countParams = [];
    const countConditions = [];

    if (category) {
      countConditions.push('category = ?');
      countParams.push(category);
    }

    if (search) {
      countConditions.push('(title LIKE ? OR description LIKE ?)');
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (countConditions.length > 0) {
      countSql += ' AND ' + countConditions.join(' AND ');
    }

    const [totalResult] = await query(countSql, countParams);
    const total = totalResult[0].total;

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
    console.error('获取物品列表错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 根据ID获取单个物品
const getItemById = async (req, res) => {
  try {
    const { id } = req.params;

    // 检查字段是否存在
    let buyerFields = '';
    try {
      const [buyerIdCol] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'buyer_id'",
        [process.env.DB_NAME || 'campus_trading']
      );
      const [purchasedAtCol] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'purchased_at'",
        [process.env.DB_NAME || 'campus_trading']
      );
      if (buyerIdCol.length > 0) {
        buyerFields += 'i.buyer_id,';
      }
      if (purchasedAtCol.length > 0) {
        buyerFields += 'i.purchased_at,';
      }
    } catch (err) {
      console.log('检查字段时出错，将跳过这些字段');
    }

    const [items] = await query(`
      SELECT
        i.id,
        i.title,
        i.description,
        i.price,
        i.category,
        i.image_url,
        i.status,
        i.created_at,
        ${buyerFields}
        u.id as seller_id,
        u.username as seller_name,
        u.email as seller_email,
        b.id as buyer_id,
        b.username as buyer_name,
        b.email as buyer_email
      FROM items i
      JOIN users u ON i.seller_id = u.id
      LEFT JOIN users b ON i.buyer_id = b.id
      WHERE i.id = ?
    `, [id]);

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: '物品不存在'
      });
    }

    const item = items[0];
    
    // 如果商品有 buyer_id 但状态不是 'sold'，自动修正状态
    if (item.buyer_id && item.status !== 'sold' && item.status !== 'disputed') {
      try {
        await query('UPDATE items SET status = ? WHERE id = ?', ['sold', item.id]);
        item.status = 'sold';
        console.log(`✅ 自动修正商品 ${item.id} 的状态为 'sold'`);
      } catch (err) {
        console.error('修正商品状态失败:', err);
      }
    }

    res.json({
      success: true,
      item
    });

  } catch (error) {
    console.error('获取物品详情错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 更新物品信息
const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, category, image_url, status } = req.body;
    const userId = req.user.userId;

    // 验证物品是否存在且属于当前用户
    const [items] = await query('SELECT id FROM items WHERE id = ? AND seller_id = ?', [id, userId]);
    if (items.length === 0) {
      return res.status(403).json({
        success: false,
        message: '无权修改此物品'
      });
    }

    // 构建更新语句
    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (price !== undefined && price !== null && price !== '') {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({
          success: false,
          message: '价格必须是一个大于0的数字'
        });
      }
      updates.push('price = ?');
      params.push(priceNum);
    }

    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }

    if (image_url !== undefined) {
      updates.push('image_url = ?');
      params.push(image_url);
    }

    if (status !== undefined && ['available', 'sold'].includes(status)) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有提供有效的更新字段'
      });
    }

    params.push(id);
    const sql = `UPDATE items SET ${updates.join(', ')} WHERE id = ?`;

    await query(sql, params);

    res.json({
      success: true,
      message: '物品更新成功'
    });

  } catch (error) {
    console.error('更新物品错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 删除物品
const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // 验证物品是否存在且属于当前用户
    // 检查 buyer_id 字段是否存在
    let buyerIdField = '';
    try {
      const [buyerIdCol] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'buyer_id'",
        [process.env.DB_NAME || 'campus_trading']
      );
      if (buyerIdCol.length > 0) {
        buyerIdField = ', buyer_id';
      }
    } catch (err) {
      console.log('检查 buyer_id 字段时出错');
    }
    const [items] = await query(`SELECT id, status${buyerIdField} FROM items WHERE id = ? AND seller_id = ?`, [id, userId]);
    if (items.length === 0) {
      return res.status(403).json({
        success: false,
        message: '无权删除此物品'
      });
    }

    const item = items[0];

    // 如果物品已售出，不允许删除（保护购买记录）
    if (item.status === 'sold' || (item.buyer_id !== undefined && item.buyer_id !== null)) {
      return res.status(400).json({
        success: false,
        message: '已售出的物品不能删除，以保护交易记录'
      });
    }

    // 删除物品（只有未售出的物品才能删除）
    await query('DELETE FROM items WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '物品删除成功'
    });

  } catch (error) {
    console.error('删除物品错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取用户的物品列表
const getUserItems = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status } = req.query;

    let sql = `
      SELECT
        id,
        title,
        description,
        price,
        category,
        image_url,
        status,
        created_at
      FROM items
      WHERE seller_id = ?
    `;

    const params = [userId];

    if (status && ['available', 'sold'].includes(status)) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const [items] = await query(sql, params);

    res.json({
      success: true,
      items: items
    });

  } catch (error) {
    console.error('获取用户物品错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 购买物品
const purchaseItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const [items] = await query('SELECT id, seller_id, status FROM items WHERE id = ?', [id]);
    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: '物品不存在'
      });
    }

    const item = items[0];

    if (item.seller_id === userId) {
      return res.status(400).json({
        success: false,
        message: '不能购买自己发布的物品'
      });
    }

    if (item.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: '该物品当前不可购买'
      });
    }

    // 检查字段是否存在，动态构建SQL
    let updateSql = 'UPDATE items SET status = ?';
    const updateParams = ['sold'];
    
    try {
      const [buyerIdCol] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'buyer_id'",
        [process.env.DB_NAME || 'campus_trading']
      );
      const [purchasedAtCol] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'purchased_at'",
        [process.env.DB_NAME || 'campus_trading']
      );
      
      if (buyerIdCol.length > 0) {
        updateSql += ', buyer_id = ?';
        updateParams.push(userId);
      }
      if (purchasedAtCol.length > 0) {
        updateSql += ', purchased_at = NOW()';
      }
    } catch (err) {
      console.log('检查字段时出错，将只更新状态');
    }
    
    // 先检查余额是否足够
    const [itemInfo] = await query('SELECT price, title FROM items WHERE id = ?', [id]);
    if (itemInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: '物品不存在'
      });
    }

    const itemPrice = parseFloat(itemInfo[0].price || 0);
    
    // 检查 wallet_balance 字段是否存在
    const dbName = process.env.DB_NAME || 'campus_trading';
    let hasWalletBalance = false;
    try {
      const [walletCol] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'wallet_balance'",
        [dbName]
      );
      hasWalletBalance = walletCol.length > 0;
    } catch (err) {
      console.log('检查 wallet_balance 字段时出错:', err);
    }

    // 如果钱包功能存在，检查余额
    if (hasWalletBalance) {
      const [buyers] = await query('SELECT wallet_balance FROM users WHERE id = ?', [userId]);
      if (buyers.length === 0) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      const balance = parseFloat(buyers[0].wallet_balance || 0);
      if (balance < itemPrice) {
        return res.status(400).json({
          success: false,
          message: `余额不足，当前余额：¥${balance.toFixed(2)}，需要：¥${itemPrice.toFixed(2)}`
        });
      }
    }

    // 更新商品状态
    updateSql += ' WHERE id = ?';
    updateParams.push(id);
    await query(updateSql, updateParams);

    // 处理支付（从买家钱包扣款，转入卖家钱包）
    if (hasWalletBalance && itemPrice > 0) {
      try {
        await paymentService.processPurchase({
          buyer_id: userId,
          seller_id: item.seller_id,
          item_id: id,
          amount: itemPrice,
          reason: `购买商品: ${itemInfo[0].title || '商品'}`
        });
      } catch (paymentError) {
        console.error('处理支付失败:', paymentError);
        // 如果支付失败，回滚商品状态
        try {
          let rollbackSql = 'UPDATE items SET status = ?';
          const rollbackParams = ['available'];
          // 检查 buyer_id 字段是否存在
          try {
            const [buyerIdCol] = await query(
              "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'buyer_id'",
              [dbName]
            );
            if (buyerIdCol.length > 0) {
              rollbackSql += ', buyer_id = NULL';
            }
          } catch (err) {
            // 忽略字段检查错误
          }
          rollbackSql += ' WHERE id = ?';
          rollbackParams.push(id);
          await query(rollbackSql, rollbackParams);
        } catch (rollbackError) {
          console.error('回滚商品状态失败:', rollbackError);
        }
        return res.status(400).json({
          success: false,
          message: paymentError.message || '支付失败，请稍后重试'
        });
      }
    }

    res.json({
      success: true,
      message: '购买成功'
    });
  } catch (error) {
    console.error('购买物品错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取已售出的物品（卖家视角）
const getSoldItems = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 检查 purchased_at 字段是否存在
    let purchasedAtField = '';
    try {
      const [columns] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'purchased_at'",
        [process.env.DB_NAME || 'campus_trading']
      );
      if (columns.length > 0) {
        purchasedAtField = 'i.purchased_at,';
      }
    } catch (err) {
      console.log('检查 purchased_at 字段时出错，将跳过该字段');
    }

    const [items] = await query(
      `
      SELECT
        i.id,
        i.title,
        i.description,
        i.price,
        i.category,
        i.image_url,
        i.status,
        i.created_at,
        ${purchasedAtField}
        b.id as buyer_id,
        b.username as buyer_name,
        b.email as buyer_email
      FROM items i
      LEFT JOIN users b ON i.buyer_id = b.id
      WHERE i.seller_id = ? AND i.status = 'sold'
      ${purchasedAtField ? 'ORDER BY i.purchased_at DESC' : 'ORDER BY i.created_at DESC'}
      `,
      [userId]
    );

    res.json({
      success: true,
      items
    });
  } catch (error) {
    console.error('获取已售出物品错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

// 获取已购买的物品
const getPurchasedItems = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 检查 purchased_at 字段是否存在
    let purchasedAtField = '';
    try {
      const [columns] = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'purchased_at'",
        [process.env.DB_NAME || 'campus_trading']
      );
      if (columns.length > 0) {
        purchasedAtField = 'i.purchased_at,';
      }
    } catch (err) {
      console.log('检查 purchased_at 字段时出错，将跳过该字段');
    }

    const [items] = await query(
      `
      SELECT
        i.id,
        i.title,
        i.description,
        i.price,
        i.category,
        i.image_url,
        i.status,
        ${purchasedAtField}
        u.username as seller_name,
        u.email as seller_email
      FROM items i
      LEFT JOIN users u ON i.seller_id = u.id
      WHERE i.buyer_id = ?
      ${purchasedAtField ? 'ORDER BY i.purchased_at DESC' : 'ORDER BY i.created_at DESC'}
      `,
      [userId]
    );

    res.json({
      success: true,
      items
    });
  } catch (error) {
    console.error('获取购买物品错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

module.exports = {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem,
  getUserItems,
  purchaseItem,
  getPurchasedItems,
  getSoldItems
};



