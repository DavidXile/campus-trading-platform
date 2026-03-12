import axios from 'axios';

// 创建 axios 实例
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 自动添加 JWT token
api.interceptors.request.use(
  (config) => {
    // 从 sessionStorage 获取 token（每个标签页独立）
    const token = sessionStorage.getItem('token');

    // 如果 token 存在，添加到请求头
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理常见错误
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 处理 401 未授权错误
    if (error.response?.status === 401) {
      const token = sessionStorage.getItem('token');
      
      // 只有在确实有 token 的情况下才清除（避免重复清除）
      if (token) {
        console.log('Token 无效或已过期，清除登录状态');
        // 清除 sessionStorage 的 token 和用户信息
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');

        // 如果不在登录页面，重定向到登录页
        if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/admin')) {
          // 使用 setTimeout 避免在拦截器中直接重定向导致的问题
          setTimeout(() => {
            window.location.href = '/login';
          }, 100);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;








