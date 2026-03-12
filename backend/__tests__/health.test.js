// 黑盒接口测试：健康检查接口
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/index');

describe('GET /', () => {
  it('返回欢迎信息与版本号', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('version');
    expect(res.body.endpoints).toHaveProperty('auth', '/api/users');
  });
});

