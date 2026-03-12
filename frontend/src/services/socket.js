import { io } from 'socket.io-client';

let socket = null;

export const connectSocket = (token) => {
  // 如果已经连接，检查 token 是否一致
  if (socket?.connected) {
    const currentToken = socket.auth?.token;
    if (currentToken === token) {
      return socket;
    }
    // 如果 token 不一致，断开旧连接
    console.log('Token changed, disconnecting old socket...');
    socket.disconnect();
  }

  socket = io('http://localhost:5000', {
    auth: {
      token: token
    },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('Socket连接成功');
  });

  socket.on('disconnect', () => {
    console.log('Socket断开连接');
  });

  socket.on('error', (error) => {
    console.error('Socket错误:', error);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => {
  return socket;
};




