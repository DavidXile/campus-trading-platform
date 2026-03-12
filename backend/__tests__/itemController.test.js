// 白盒测试：针对商品创建/更新的核心校验逻辑
process.env.NODE_ENV = 'test';

const { createItem, updateItem } = require('../src/controllers/itemController');

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

describe('itemController.createItem', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('缺少价格时返回 400', async () => {
    const req = {
      body: { title: '测试商品', description: '描述为空' },
      user: { userId: 1 }
    };
    const res = mockRes();

    await createItem(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: '标题和价格是必填项' })
    );
  });

  it('价格小于等于0 时返回 400', async () => {
    const req = {
      body: { title: '测试商品', price: 0, description: '描述', category: '数码' },
      user: { userId: 1 }
    };
    const res = mockRes();

    await createItem(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: '价格必须是一个大于0的数字' })
    );
  });

  it('价格为有效数字时创建成功', async () => {
    mockQuery.mockResolvedValue([{ insertId: 10 }]);
    const req = {
      body: { title: '测试商品', price: 20.5, description: '描述', category: '数码' },
      user: { userId: 1 }
    };
    const res = mockRes();

    await createItem(req, res);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO items'),
      expect.arrayContaining(['测试商品', '描述', 20.5, '数码', '', 1])
    );
    expect(res.statusCode).toBe(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, itemId: 10 })
    );
  });
});

describe('itemController.updateItem', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('当价格非法时返回 400', async () => {
    // 第一次查询：校验商品归属
    mockQuery.mockResolvedValueOnce([[{ id: 1 }]]);
    const req = {
      params: { id: 1 },
      body: { price: -1 },
      user: { userId: 1 }
    };
    const res = mockRes();

    await updateItem(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: '价格必须是一个大于0的数字' })
    );
  });
});

