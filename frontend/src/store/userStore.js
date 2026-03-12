import { create } from 'zustand';
import { disconnectSocket } from '../services/socket';

// 从 sessionStorage 恢复初始状态（每个标签页独立）
// 使用 sessionStorage 而不是 localStorage，这样每个标签页可以有独立的登录状态
const getInitialState = () => {
  const token = sessionStorage.getItem('token');
  const user = sessionStorage.getItem('user');
  
  if (token && user) {
    try {
      const parsedUser = JSON.parse(user);
      return {
        user: parsedUser,
        token: token,
        isAuthenticated: true,
      };
    } catch (error) {
      console.error('解析用户信息失败:', error);
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
    }
  }
  
  return {
    user: null,
    token: null,
    isAuthenticated: false,
  };
};

// 用户状态管理 store
const useUserStore = create((set, get) => ({
  // 状态（从 localStorage 初始化）
  ...getInitialState(),

  // 初始化时从 sessionStorage 恢复状态
  initialize: () => {
    const token = sessionStorage.getItem('token');
    const user = sessionStorage.getItem('user');

    if (token && user) {
      try {
        const parsedUser = JSON.parse(user);
        // 恢复状态，但不立即验证 token（让后续 API 请求来验证）
        set({
          user: parsedUser,
          token: token,
          isAuthenticated: true,
        });
        console.log('✅ 从 sessionStorage 恢复登录状态');
      } catch (error) {
        console.error('解析用户信息失败:', error);
        // 如果解析失败，清除本地存储
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
      }
    } else {
      console.log('ℹ️  sessionStorage 中没有登录信息');
    }
  },

  // 登录方法
  login: (token, user) => {
    // 将 token 和用户信息存入 sessionStorage（每个标签页独立）
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(user));

    // 更新状态
    set({
      user: user,
      token: token,
      isAuthenticated: true,
    });
  },

  // 登出方法
  logout: () => {
    // 断开 Socket 连接
    disconnectSocket();

    // 清除 sessionStorage
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');

    // 重置状态
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  // 更新用户信息
  updateUser: (userData) => {
    const updatedUser = { ...get().user, ...userData };
    sessionStorage.setItem('user', JSON.stringify(updatedUser));

    set({
      user: updatedUser,
    });
  },
}));

export default useUserStore;








