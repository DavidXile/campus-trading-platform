// 白盒测试：商品列表分页与搜索参数
process.env.NODE_ENV = 'test';

const { getItems } = require('../src/controllers/itemController');

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

describe('itemController.getItems', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('分页为负时纠正为 page=1 limit=1，并带搜索条件', async () => {
    // 第一条查询返回列表，第二条查询返回 count
    mockQuery
      .mockResolvedValueOnce([[]]) // items
      .mockResolvedValueOnce([[{ total: 0 }]]); // count

    const req = {
      query: { page: -5, limit: -10, search: 'abc' }
    };
    const res = mockRes();

    await getItems(req, res);

    const firstSql = mockQuery.mock.calls[0][0];
    expect(firstSql).toContain('LIMIT 1 OFFSET 0');
    expect(firstSql).toContain('LIKE ?');
    expect(mockQuery.mock.calls[0][1]).toEqual(expect.arrayContaining(['%abc%', '%abc%']));
    expect(res.statusCode).toBe(200);
  });
});

