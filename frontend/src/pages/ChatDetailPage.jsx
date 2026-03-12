import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  NavBar,
  Input,
  Button,
  Card,
  Loading,
  ErrorBlock,
  Image,
  Toast
} from 'antd-mobile';
import api from '../services/api';
import useUserStore from '../store/userStore';
import { connectSocket, getSocket } from '../services/socket';

const ChatDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, token, user } = useUserStore();

  const getStoredUser = () => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return null;
    }
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('解析本地用户信息失败:', error);
    }
    return null;
  };

  const effectiveUser = useMemo(() => {
    if (user && Object.keys(user).length > 0) {
      return user;
    }
    return getStoredUser();
  }, [user]);

  const extractUserId = (target) => {
    if (!target) return null;
    const possibleIds = [
      target.id,
      target.user_id,
      target.userId,
      target._id,
      target.user?.id,
      target.user?.user_id
    ];
    for (const id of possibleIds) {
      if (id !== null && id !== undefined && id !== '') {
        const parsed = Number(id);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  };

  const currentUserId = extractUserId(effectiveUser);

  // 如果已认证但没有ID，尝试重新获取用户信息
  useEffect(() => {
    if (isAuthenticated && !currentUserId) {
      console.log('⚠️ User authenticated but no ID found, refetching profile...');
      api.get('/users/me')
        .then(res => {
          if (res.data.success) {
            console.log('✅ Refetched user profile:', res.data.user);
            useUserStore.getState().updateUser(res.data.user);
          }
        })
        .catch(err => console.error('❌ Failed to refetch user:', err));
    }
  }, [isAuthenticated, currentUserId]);
  
  // 调试当前用户信息
  useEffect(() => {
    console.log('🔧 Current User Debug Info:', {
      storeUser: user,
      effectiveUser: effectiveUser,
      extractedId: currentUserId,
      extractedUsername: effectiveUser?.username
    });
  }, [user, effectiveUser, currentUserId]);

  const currentUsername =
    effectiveUser?.username ??
    effectiveUser?.user?.username ??
    effectiveUser?.name ??
    effectiveUser?.nickname ??
    null;

  const extractSenderId = (message) => {
    if (!message) return null;
    const senderIdRaw =
      message?.sender_id ??
      message?.sender_user_id ??
      message?.senderId ??
      message?.sender?.id ??
      message?.sender?.user_id ??
      null;
    if (senderIdRaw === null || senderIdRaw === undefined || senderIdRaw === '') {
      return null;
    }
    const parsed = Number(senderIdRaw);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const isMyMessage = (message) => {
    if (!message) return false;
    const senderId = extractSenderId(message);
    
    // 强制打印调试日志（调试完毕后请注释或删除）
    /*
    if (senderId !== null && currentUserId !== null) {
       if (senderId === 6 || senderId === '6' || currentUserId === 6 || currentUserId === '6') {
          console.warn(`🔍 Debug Message Ownership: msgID=${message.id}, senderId=${senderId} (${typeof senderId}), currentUserId=${currentUserId} (${typeof currentUserId}), match=${senderId === currentUserId}`);
       }
    }
    */

    if (senderId !== null && currentUserId !== null) {
      // 宽松匹配：数值相等即可，忽略类型差异
      return senderId == currentUserId;
    }
    if (currentUsername) {
      const senderName =
        message?.sender_username ??
        message?.sender?.username ??
        message?.username ??
        null;
      if (senderName) {
        return senderName === currentUsername;
      }
    }
    return false;
  };

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [messageContent, setMessageContent] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 获取会话详情
  const fetchConversation = async () => {
    try {
      const response = await api.get(`/chat/conversations/${id}`);
      if (response.data.success) {
        setConversation(response.data.conversation);
      }
    } catch (err) {
      console.error('获取会话详情失败:', err);
      setError('获取会话详情失败');
    }
  };

  // 获取消息列表
  const fetchMessages = async () => {
    try {
      setLoading(true);
      console.log(`📥 前端请求获取会话 ${id} 的消息列表`);
      const response = await api.get(`/chat/conversations/${id}/messages`);
      if (response.data.success) {
        const messagesList = response.data.messages || [];
        console.log(`✅ 前端收到响应，success: ${response.data.success}`);
        console.log(`✅ messages字段类型: ${typeof messagesList}, 是否为数组: ${Array.isArray(messagesList)}`);
        console.log(`✅ 消息数量: ${messagesList.length}`);
        
        if (messagesList.length > 0) {
          // console.log('第一条消息:', messagesList[0]);
          // console.log('消息字段:', Object.keys(messagesList[0]));
        }
        
        // 确保是数组
        if (!Array.isArray(messagesList)) {
          console.error('❌ 消息数据不是数组:', messagesList);
          setMessages([]);
          setError('消息数据格式错误');
          return;
        }
        
        // 验证并过滤消息
        const validMessages = messagesList.filter(msg => {
          if (!msg) {
            console.warn('空消息对象');
            return false;
          }
          // 消息只要有id、content或image_url之一就认为是有效的
          const isValid = msg.id || msg.content || msg.image_url;
          if (!isValid) {
            console.warn('无效的消息格式:', msg);
          }
          return isValid;
        });
        
        console.log(`✅ 有效消息数: ${validMessages.length}`);
        setMessages(validMessages);
        setError(null);
        
        if (validMessages.length > 0) {
          setTimeout(scrollToBottom, 100);
        }
        
        // 获取消息后，刷新未读消息数
        window.dispatchEvent(new Event('refreshUnreadCount'));
      } else {
        console.error('❌ 获取消息失败:', response.data);
        setError(response.data.message || '获取消息列表失败');
      }
    } catch (err) {
      console.error('获取消息列表失败:', err);
      console.error('错误详情:', err.response?.data);
      const errorMessage = err.response?.data?.message || '获取消息列表失败';
      // 如果是403权限错误，跳转到聊天列表
      if (err.response?.status === 403) {
        Toast.show({ icon: 'fail', content: '无权访问此会话' });
        navigate('/chat');
        return;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 使用ref来防止重复发送
  const sendingRef = useRef(false);

  // 发送消息
  const handleSendMessage = async (e) => {
    // 阻止默认行为（防止表单提交或重复触发）
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // 如果正在发送，防止重复发送
    if (sendingRef.current || sending) {
      console.log('正在发送中，忽略重复请求');
      return;
    }

    const contentToSend = messageContent.trim();
    if (!contentToSend && !fileInputRef.current?.files[0]) {
      return;
    }

    if (!isAuthenticated) {
      Toast.show({ icon: 'fail', content: '请先登录' });
      navigate('/login');
      return;
    }

    try {
      sendingRef.current = true;
      setSending(true);
      // 立即清空输入框状态
      setMessageContent('');
      
      // 使用 setTimeout 确保在可能的输入法事件后再次清空
      setTimeout(() => setMessageContent(''), 0);

      // 移除直接的 ref 操作，依赖状态驱动
      // if (messageInputRef.current) { ... }
      
      const socket = getSocket();

      if (socket && socket.connected) {
        // 使用WebSocket发送（消息会通过WebSocket推送回来，不需要手动添加）
        socket.emit('send_message', {
          conversationId: id,
          content: contentToSend || null
        });
        console.log('通过WebSocket发送消息');
      } else {
        // 降级到HTTP API
        console.log('WebSocket未连接，使用HTTP API发送');
        const response = await api.post(`/chat/conversations/${id}/messages`, {
          content: contentToSend || null
        });
        if (response.data.success) {
          setMessages((prev) => [...prev, response.data.message]);
          scrollToBottom();
        }
      }
    } catch (err) {
      console.error('发送消息失败:', err);
      Toast.show({ icon: 'fail', content: '发送消息失败' });
      // 如果发送失败，恢复输入内容
      setMessageContent(contentToSend);
    } finally {
      // 延迟重置，防止快速连续点击
      setTimeout(() => {
        sendingRef.current = false;
        setSending(false);
      }, 300);
    }
  };

  // 处理图片上传
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      Toast.show({ icon: 'fail', content: '请选择图片文件' });
      return;
    }

    // 验证文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      Toast.show({ icon: 'fail', content: '图片大小不能超过5MB' });
      return;
    }

    try {
      setSending(true);
      // 将图片转换为base64（实际项目中应该上传到服务器）
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = event.target.result;
        
        // 这里应该上传到服务器获取URL，暂时使用base64
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit('send_message', {
            conversationId: id,
            image_url: base64Image
          });
        } else {
          const response = await api.post(`/chat/conversations/${id}/messages`, {
            image_url: base64Image
          });
          if (response.data.success) {
            setMessages([...messages, response.data.message]);
            scrollToBottom();
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('上传图片失败:', err);
      Toast.show({ icon: 'fail', content: '上传图片失败' });
    } finally {
      setSending(false);
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchConversation();
    fetchMessages();

    // 连接WebSocket
    if (token) {
      const socket = connectSocket(token);
      
      // 等待socket连接后再加入房间
      const setupSocket = () => {
        if (socket.connected) {
          // 加入会话房间
          socket.emit('join_conversation', id);
          console.log('📥 请求加入会话房间:', id);
        } else {
          // 如果还没连接，等待连接
          socket.once('connect', () => {
            socket.emit('join_conversation', id);
            console.log('📥 连接后请求加入会话房间:', id);
          });
        }
      };

      setupSocket();

      // 监听加入会话确认
      socket.on('joined_conversation', (data) => {
        console.log('✅ 已确认加入会话房间:', data);
      });

      // 监听新消息
      const handleNewMessage = (message) => {
        console.log('收到新消息:', message);
        console.log('消息详情:', JSON.stringify(message, null, 2));
        // 确保消息属于当前会话
        const msgConversationId = message.conversation_id || message.conversationId;
        if (msgConversationId && parseInt(msgConversationId) !== parseInt(id)) {
          console.log(`消息不属于当前会话，忽略。消息会话ID: ${msgConversationId}, 当前会话ID: ${id}`);
          return;
        }
        
        setMessages((prev) => {
          // 检查消息是否已存在（通过ID或内容和时间戳判断），避免重复添加
          const exists = prev.some(m => {
            if (m.id && message.id && m.id === message.id) {
              return true;
            }
            // 如果没有ID，通过内容和时间判断（防止重复）
            if (m.content === message.content && 
                m.sender_id === message.sender_id &&
                Math.abs(new Date(m.created_at) - new Date(message.created_at)) < 1000) {
              return true;
            }
            return false;
          });
          if (exists) {
            console.log('消息已存在，跳过');
            return prev;
          }
          console.log('添加新消息到列表');
          return [...prev, message];
        });
        setTimeout(scrollToBottom, 100);
        // 标记为已读（只标记对方发送的消息）
        if (message.sender_id !== user?.id) {
          api.put(`/chat/conversations/${id}/read`).then(() => {
            // 标记已读后，刷新未读消息数
            if (window.location.pathname === '/chat') {
              // 如果在聊天列表页，刷新未读消息数
              window.dispatchEvent(new Event('refreshUnreadCount'));
            }
          }).catch(err => {
            console.error('标记已读失败:', err);
          });
        }
      };

      socket.on('new_message', handleNewMessage);

      // 也监听新消息通知（如果通过用户房间推送）
      const handleNewMessageNotification = (data) => {
        console.log('收到新消息通知:', data);
        // 如果通知的会话ID与当前会话匹配
        if (data.conversationId && parseInt(data.conversationId) === parseInt(id)) {
          if (data.message) {
            // 如果有消息对象，直接添加
            handleNewMessage(data.message);
          } else {
            // 如果没有消息对象，重新获取消息列表
            console.log('通知中没有消息对象，重新获取消息列表');
            fetchMessages();
          }
        }
      };

      socket.on('new_message_notification', handleNewMessageNotification);

      // 监听错误
      const handleError = (error) => {
        console.error('Socket错误:', error);
        Toast.show({ icon: 'fail', content: error.message || '连接错误' });
      };

      socket.on('error', handleError);

      return () => {
        socket.emit('leave_conversation', id);
        socket.off('new_message', handleNewMessage);
        socket.off('new_message_notification', handleNewMessageNotification);
        socket.off('error', handleError);
        socket.off('joined_conversation');
      };
    }
  }, [id, isAuthenticated, token, navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (loading && !conversation) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Loading />
      </div>
    );
  }

  // 如果会话不存在，显示错误
  if (error && !conversation) {
    return <ErrorBlock status='default' title={error} />;
  }

  // 格式化时间
  const formatTime = (timeString) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <NavBar onBack={() => navigate('/chat')}>
        {conversation?.other_username || '聊天'}
      </NavBar>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          backgroundColor: '#F5F5F5'
        }}
      >
        {error && (
          <div style={{ 
            padding: '12px', 
            marginBottom: '12px', 
            backgroundColor: '#fff3cd', 
            borderRadius: '8px',
            color: '#856404',
            fontSize: '14px'
          }}>
            ⚠️ {error}
          </div>
        )}
        {messages.length === 0 && !loading && (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px', 
            color: '#999',
            fontSize: '14px'
          }}>
            暂无消息，开始聊天吧~
          </div>
        )}
        {messages.map((message, index) => {
          const isMine = isMyMessage(message);
          return (
            <div
              key={message.id || `msg-${index}-${message.created_at}`}
              style={{
                display: 'flex',
                justifyContent: isMine ? 'flex-end' : 'flex-start',
                marginBottom: '12px',
                paddingLeft: isMine ? '20%' : '0',
                paddingRight: isMine ? '0' : '20%'
              }}
            >
              <div
                style={{
                  maxWidth: '60%',
                  backgroundColor: isMine 
                    ? 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)' 
                    : '#FFFFFF',
                  background: isMine 
                    ? 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)' 
                    : '#FFFFFF',
                  color: isMine ? '#FFFFFF' : '#1A1A1A',
                  padding: '12px 16px',
                  borderRadius: isMine ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                  wordBreak: 'break-word',
                  boxShadow: isMine 
                    ? '0 2px 8px rgba(0, 212, 170, 0.2)' 
                    : '0 2px 8px rgba(0, 0, 0, 0.08)'
                }}
              >
              {message.image_url && (
                <Image
                  src={message.image_url}
                  width='100%'
                  style={{ 
                    borderRadius: '8px', 
                    marginBottom: message.content ? '6px' : '0',
                    maxWidth: '250px',
                    display: 'block'
                  }}
                />
              )}
              {message.content && (
                <div style={{ 
                  marginBottom: message.image_url ? '0' : '0', 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  lineHeight: '1.5'
                }}>
                  {message.content}
                </div>
              )}
              {message.attachment_url && (
                <div style={{ marginTop: '4px' }}>
                  <a
                    href={message.attachment_url}
                    download={message.attachment_name}
                    style={{
                      color: isMyMessage(message) ? '#fff' : '#1677ff',
                      textDecoration: 'underline'
                    }}
                  >
                    📎 {message.attachment_name || '附件'}
                  </a>
                </div>
              )}
              <div
                style={{
                  fontSize: '10px',
                  color: isMine ? 'rgba(255,255,255,0.8)' : '#999',
                  marginTop: '6px',
                  textAlign: 'right',
                  lineHeight: '1.2'
                }}
              >
                {formatTime(message.created_at)}
              </div>
              {/* 临时调试信息 */}
              {/* <div style={{ fontSize: '10px', color: '#999', marginTop: '2px', textAlign: 'right' }}>
                Debug: S={extractSenderId(message)} / M={currentUserId}
              </div> */}
            </div>
          </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #F0F0F0',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.04)'
        }}
      >
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          alignItems: 'center',
          maxWidth: '900px',
          margin: '0 auto'
        }}>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
          <Button
            fill='none'
            onClick={() => fileInputRef.current?.click()}
            style={{ 
              flexShrink: 0,
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#F2F3F5',
              border: 'none',
              fontSize: '20px',
              padding: 0
            }}
          >
            📷
          </Button>
          <Input
            ref={messageInputRef}
            value={messageContent}
            onChange={(val) => {
              if (!sending) {
                setMessageContent(val);
              }
            }}
            onEnterPress={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!sending && messageContent.trim()) {
                handleSendMessage(e);
              }
            }}
            placeholder='输入消息...'
            style={{ 
              flex: 1,
              '--background': '#F2F3F5',
              '--border-radius': '20px',
              '--border': 'none',
              '--padding': '10px 16px',
              '--height': '40px'
            }}
          />
          <Button
            color={messageContent.trim() ? 'primary' : 'default'}
            onClick={(e) => {
              e.preventDefault();
              handleSendMessage(e);
            }}
            loading={sending}
            disabled={(!messageContent.trim() && !fileInputRef.current?.files[0]) || sending}
            style={{
              borderRadius: '20px',
              minWidth: '60px',
              height: '40px',
              background: messageContent.trim() 
                ? 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)'
                : '#F2F3F5',
              border: 'none',
              color: messageContent.trim() ? '#FFFFFF' : '#999999',
              fontWeight: '500'
            }}
          >
            {messageContent.trim() ? '发送' : '发送'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatDetailPage;

