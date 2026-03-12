import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  List,
  Badge,
  Loading,
  ErrorBlock,
  Empty,
  Image,
  Toast,
  Dialog,
  ActionSheet
} from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import useUserStore from '../store/userStore';
import { connectSocket, getSocket } from '../services/socket';

const ChatListPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated, token, user } = useUserStore();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // 获取会话列表
  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/chat/conversations');
      if (response.data.success) {
        setConversations(response.data.conversations);
        setError(null);
      }
    } catch (err) {
      console.error('获取会话列表失败:', err);
      console.error('错误详情:', err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message || '获取会话列表失败';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 获取未读消息数
  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/chat/unread-count');
      if (response.data.success) {
        setUnreadCount(response.data.unread_count);
      }
    } catch (err) {
      console.error('获取未读消息数失败:', err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchConversations();
    fetchUnreadCount();

    // 连接WebSocket
    if (token) {
      const socket = connectSocket(token);

      // 监听新消息通知
      const handleNewMessageNotification = (data) => {
        setUnreadCount(data.unread_count);
        fetchConversations(); // 刷新会话列表
      };
      socket.on('new_message_notification', handleNewMessageNotification);

      return () => {
        socket.off('new_message_notification', handleNewMessageNotification);
      };
    }
  }, [isAuthenticated, token, navigate]);

  // 删除会话（显示两种删除选项）
  const handleDeleteConversation = async (conversationId, e) => {
    e.stopPropagation(); // 阻止点击事件冒泡，避免跳转到聊天详情页
    
    const actions = [
      {
        text: t('chat.temporaryDelete'),
        key: 'temporary',
        description: t('chat.temporaryDeleteDesc'),
      },
      {
        text: t('chat.permanentDelete'),
        key: 'permanent',
        description: t('chat.permanentDeleteDesc'),
        danger: true,
      },
      { text: t('common.cancel'), key: 'cancel' },
    ];

    ActionSheet.show({
      actions,
      onAction: async (action) => {
        if (action.key === 'cancel') {
          return;
        }

        const deleteType = action.key === 'permanent' ? 'permanent' : 'temporary';
        const confirmMessage = deleteType === 'permanent' 
          ? t('chat.permanentDeleteConfirm')
          : t('chat.temporaryDeleteConfirm');
    
    Dialog.confirm({
          content: confirmMessage,
          confirmText: t('common.confirm'),
          cancelText: t('common.cancel'),
      onConfirm: async () => {
        try {
              const response = await api.delete(`/chat/conversations/${conversationId}?type=${deleteType}`);
          if (response.data.success) {
            Toast.show({
              icon: 'success',
                  content: response.data.message || t('chat.deleteSuccess'),
            });
            // 刷新会话列表
            fetchConversations();
            // 刷新未读消息数
            fetchUnreadCount();
          }
        } catch (err) {
          console.error('删除会话失败:', err);
          Toast.show({
            icon: 'fail',
            content: err.response?.data?.message || t('common.error'),
          });
        }
          },
        });
      },
    });
  };

  // 格式化时间
  const formatTime = (timeString) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Loading />
      </div>
    );
  }

  if (error) {
    return <ErrorBlock status='default' title={error} />;
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: '#F5F5F5',
      paddingBottom: '80px'
    }}>
      {/* 限制内容宽度并居中 */}
      <div style={{ 
        maxWidth: '900px', 
        margin: '0 auto', 
        padding: '16px',
        background: '#FFFFFF',
        minHeight: 'calc(100vh - 80px)'
      }}>
        <h2 style={{ 
          marginBottom: '20px', 
          fontSize: '24px',
          fontWeight: '600',
          color: '#1A1A1A'
        }}>
          {t('chat.title')}
        </h2>
        
        {conversations.length === 0 ? (
          <Empty description={t('chat.noConversations')} style={{ padding: '60px 0' }} />
        ) : (
          <div>
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => navigate(`/chat/${conv.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px',
                  borderBottom: '1px solid #F0F0F0',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  borderRadius: '8px',
                  marginBottom: '4px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F5F7FA';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* 左侧头像 - 圆形 */}
                <div style={{ 
                  position: 'relative',
                  marginRight: '12px',
                  flexShrink: 0
                }}>
                  {conv.item_image ? (
                    <Image
                      src={conv.item_image}
                      width={56}
                      height={56}
                      fit='cover'
                      style={{ borderRadius: '50%' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        color: '#FFFFFF'
                      }}
                    >
                      {conv.other_username?.[0]?.toUpperCase() || '💬'}
                    </div>
                  )}
                  {/* 未读提醒 - 小红点 */}
                  {conv.unread_count > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      width: '12px',
                      height: '12px',
                      background: '#FF5722',
                      borderRadius: '50%',
                      border: '2px solid #FFFFFF',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  )}
                </div>

                {/* 中间内容 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px'
                  }}>
                    <div style={{ 
                      fontWeight: '600', 
                      fontSize: '16px',
                      color: '#1A1A1A',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {conv.other_username}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#999999',
                      flexShrink: 0,
                      marginLeft: '8px'
                    }}>
                      {formatTime(conv.last_message_time)}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#666666',
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {conv.item_title || conv.errand_title || '会话'}
                  </div>
                  {conv.last_message_content && (
                    <div
                      style={{
                        fontSize: '14px',
                        color: conv.unread_count > 0 ? '#1A1A1A' : '#999999',
                        fontWeight: conv.unread_count > 0 ? '500' : '400',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {conv.last_message_content}
                    </div>
                  )}
                </div>

                {/* 右侧 - 未读数和删除按钮 */}
                <div style={{
                  flexShrink: 0,
                  marginLeft: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {conv.unread_count > 0 && (
                    <Badge 
                      content={conv.unread_count} 
                      style={{ 
                        '--right': '0',
                        '--top': '0'
                      }}
                    />
                  )}
                  <div
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      background: '#F5F5F5',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#FFE5E5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#F5F5F5';
                    }}
                  >
                    <span style={{ 
                      fontSize: '18px',
                      color: '#FF5722',
                      userSelect: 'none'
                    }}>
                      🗑️
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatListPage;




