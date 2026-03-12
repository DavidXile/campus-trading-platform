// 白盒测试：购买流程的核心校验（余额不足/余额足够）
process.env.NODE_ENV = 'test';

const { purchaseItem } = require('../src/controllers/itemController');

// Mock 数据库 query
const mockQuery = jest.fn();
jest.mock('../src/config/db', () => ({
  query: (...args) => mockQuery(...args),
  testConnection: jest.fn().mockResolvedValue(true)
}));

// Mock 支付服务
jest.mock('../src/services/paymentService', () => {
  const mockProcessPurchase = jest.fn();
  return {
    __esModule: true,
    processPurchase: mockProcessPurchase,
    _mockProcessPurchase: mockProcessPurchase
  };
});
const { processPurchase: mockProcessPurchase } = require('../src/services/paymentService');

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = jest.fn((body) => body);
  return res;
};

describe('itemController.purchaseItem', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockProcessPurchase.mockReset();
  });

  it('余额不足时返回 400，且不调用支付服务', async () => {
    // 调用顺序：
    // 1 查询商品
    // 2/3 检查 buyer_id / purchased_at 字段
    // 4 查询商品价格
    // 5 查询买家余额（不足）
    mockQuery
      .mockResolvedValueOnce([[{ id: 1, seller_id: 200, status: 'available' }]]) // item
      .mockResolvedValueOnce([[]]) // buyer_id 字段不存在
      .mockResolvedValueOnce([[]]) // purchased_at 字段不存在
      .mockResolvedValueOnce([[{ price: 20, title: '测试商品' }]]) // item price
      .mockResolvedValueOnce([[{ wallet_balance: 10 }]]); // balance insufficient

    const req = {
      params: { id: 1 },
      user: { userId: 100 },
      // 在代码前半段会用到 item.seller_id/item.status；为简化，这里只测试余额校验之后的分支
      body: {}
    };
    const res = mockRes();

    await purchaseItem(req, res);

    expect(res.statusCode).toBe(400);
    expect(mockProcessPurchase).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('余额不足')
      })
    );
  });

  it('余额足够时调用支付服务并返回成功', async () => {
    mockQuery
      .mockResolvedValueOnce([[{ id: 1, seller_id: 200, status: 'available' }]]) // item
      .mockResolvedValueOnce([[]]) // buyer_id
      .mockResolvedValueOnce([[]]) // purchased_at
      .mockResolvedValueOnce([[{ price: 20, title: '测试商品' }]]) // item price
      .mockResolvedValueOnce([[{ wallet_balance: 100 }]]) // balance ok
      .mockResolvedValueOnce([]); // 更新商品状态成功（update 返回空结果也可）

    mockProcessPurchase.mockResolvedValueOnce(true);

    const req = {
      params: { id: 1 },
      user: { userId: 100 },
      body: {}
    };

    const res = mockRes();

    await purchaseItem(req, res);

    expect(mockProcessPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        buyer_id: 100,
        seller_id: 200,
        item_id: 1,
        amount: 20
      })
    );
    expect(res.statusCode).toBe(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: '购买成功'
      })
    );
  });
});

