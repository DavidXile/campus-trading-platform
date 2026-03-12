// 白盒测试：纠纷创建的参数校验与权限校验
process.env.NODE_ENV = 'test';

const { createDispute } = require('../src/controllers/disputeController');

// Mock 数据库 query
const mockQuery = jest.fn();
jest.mock('../src/config/db', () => ({
  query: (...args) => mockQuery(...args),
  testConnection: jest.fn().mockResolvedValue(true)
}));

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

const mockReq = (body = {}, userId = 1) => ({
  body,
  user: { userId },
  app: { get: () => null } // 避免触发 socket 通知
});

describe('disputeController.createDispute', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('缺少必填字段返回 400', async () => {
    const req = mockReq({ item_id: null, dispute_type: '', description: '' }, 1);
    const res = mockRes();

    await createDispute(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('必填') })
    );
  });

  it('描述过短返回 400', async () => {
    const req = mockReq({ item_id: 1, dispute_type: 'price_dispute', description: 'short' }, 1);
    const res = mockRes();

    await createDispute(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('10-500') })
    );
  });

  it('无效的纠纷类型返回 400', async () => {
    const req = mockReq({
      item_id: 1,
      dispute_type: 'invalid_type',
      description: '这是一个有效的描述长度超过十个字符123'
    }, 1);
    const res = mockRes();

    await createDispute(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: '无效的纠纷类型' })
    );
  });

  it('非买家/卖家发起纠纷返回 403', async () => {
    // 查询商品时返回与用户无关的 seller/buyer
    mockQuery.mockResolvedValueOnce([[{ id: 1, seller_id: 2, buyer_id: 3, status: 'sold' }]]);

    const req = mockReq({
      item_id: 1,
      dispute_type: 'price_dispute',
      description: '这是一个有效的描述长度超过十个字符123'
    }, 99);
    const res = mockRes();

    await createDispute(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: '您无权对此商品发起纠纷' })
    );
  });
});

