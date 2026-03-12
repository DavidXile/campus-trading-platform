// 白盒测试：跑腿任务创建与分页参数
process.env.NODE_ENV = 'test';

const { createErrand, getErrands } = require('../src/controllers/errandController');

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

const mockReq = (body = {}, userId = 1, query = {}) => ({
  body,
  user: { userId },
  query
});

describe('errandController.createErrand', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('缺少必填字段返回 400', async () => {
    const req = mockReq({ title: '', location: '', reward: '' }, 1);
    const res = mockRes();

    await createErrand(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('必填') })
    );
  });

  it('报酬非正数返回 400', async () => {
    const req = mockReq({ title: 't', location: 'loc', reward: -1 }, 1);
    const res = mockRes();

    await createErrand(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('大于0') })
    );
  });

  it('报酬超过上限返回 400', async () => {
    const req = mockReq({ title: 't', location: 'loc', reward: 1e10 }, 1);
    const res = mockRes();

    await createErrand(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('不能超过') })
    );
  });

  it('合法请求返回 201，插入报酬为数字', async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 5 }]);
    const req = mockReq({
      title: 't',
      location: 'loc',
      reward: '12.50',
      description: 'desc',
      category: 'cat'
    }, 1);
    const res = mockRes();

    await createErrand(req, res);

    expect(res.statusCode).toBe(201);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO errands'),
      expect.arrayContaining([expect.any(Number)])
    );
  });
});

describe('errandController.getErrands', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('分页参数为负数时被纠正为 page=1，limit=1', async () => {
    // 第一次 query 返回列表，第二次返回 count
    mockQuery
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ count: 0 }]]);

    const req = mockReq({}, 1, { page: -5, limit: -10 });
    const res = mockRes();

    await getErrands(req, res);

    // 检查第一次查询的 SQL 中包含 LIMIT 1 OFFSET 0
    const firstCallSql = mockQuery.mock.calls[0][0];
    expect(firstCallSql).toContain('LIMIT 1 OFFSET 0');
    expect(res.statusCode).toBe(200);
  });
});

