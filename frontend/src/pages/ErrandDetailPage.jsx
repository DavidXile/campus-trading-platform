import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Button,
  Tag,
  Loading,
  ErrorBlock,
  Toast,
  Dialog,
  NavBar
} from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import useUserStore from '../store/userStore';

const ErrandDetailPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAuthenticated, user } = useUserStore();

  const [errand, setErrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchErrand();
  }, [id]);

  const fetchErrand = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/errands/${id}`);
      if (response.data.success) {
        setErrand(response.data.errand);
      }
    } catch (err) {
      console.error('获取跑腿任务详情失败:', err);
      setError('获取跑腿任务详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 接单
  const handleAccept = async () => {
    Dialog.confirm({
      content: '确定要接这个跑腿任务吗？',
      confirmText: '确认接单',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          const response = await api.post(`/errands/${id}/accept`);
          if (response.data.success) {
            Toast.show({
              icon: 'success',
              content: '接单成功！',
            });
            fetchErrand();
          }
        } catch (err) {
          console.error('接单失败:', err);
          Toast.show({
            icon: 'fail',
            content: err.response?.data?.message || '接单失败',
          });
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // 确认完成任务（需要双方确认）
  const handleComplete = async () => {
    // 检查是否已确认（需要在函数内部获取最新状态）
    const publisherConfirmed = errand.confirmed_by_publisher === 1 || errand.confirmed_by_publisher === true;
    const accepterConfirmed = errand.confirmed_by_accepter === 1 || errand.confirmed_by_accepter === true;
    const isPublisher = isAuthenticated && user?.id && errand?.publisher_id && Number(user.id) === Number(errand.publisher_id);
    const isAccepter = isAuthenticated && user?.id && errand?.accepter_id && Number(user.id) === Number(errand.accepter_id);
    const alreadyConfirmed = isPublisher 
      ? publisherConfirmed
      : (isAccepter ? accepterConfirmed : false);
    
    if (alreadyConfirmed) {
      Toast.show({
        icon: 'fail',
        content: t('errand.alreadyConfirmed')
      });
      return;
    }

    Dialog.confirm({
      content: t('errand.completeConfirm'),
      confirmText: t('errand.confirmComplete'),
      cancelText: t('errand.cancel'),
      onConfirm: async () => {
        try {
          setActionLoading(true);
          const response = await api.post(`/errands/${id}/confirm-complete`);
          if (response.data.success) {
            Toast.show({
              icon: 'success',
              content: response.data.message || t('errand.completeSuccess'),
            });
            fetchErrand();
          }
        } catch (err) {
          console.error('确认完成任务失败:', err);
          Toast.show({
            icon: 'fail',
            content: err.response?.data?.message || t('errand.completeFailed')
          });
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // 取消任务
  const handleCancel = async () => {
    Dialog.confirm({
      content: '确定要取消这个任务吗？',
      confirmText: '确认取消',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          const response = await api.post(`/errands/${id}/cancel`);
          if (response.data.success) {
            Toast.show({
              icon: 'success',
              content: '任务已取消',
            });
            navigate('/errands');
          }
        } catch (err) {
          console.error('取消任务失败:', err);
          Toast.show({
            icon: 'fail',
            content: err.response?.data?.message || '操作失败',
          });
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // 删除任务
  const handleDelete = async () => {
    Dialog.confirm({
      content: '确定要删除这个任务吗？此操作不可恢复！',
      confirmText: '删除',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          const response = await api.delete(`/errands/${id}`);
          if (response.data.success) {
            Toast.show({
              icon: 'success',
              content: '任务已删除',
            });
            navigate('/errands');
          }
        } catch (err) {
          console.error('删除任务失败:', err);
          Toast.show({
            icon: 'fail',
            content: err.response?.data?.message || '操作失败',
          });
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // 处理联系（打开聊天）
  const handleContact = async () => {
    if (!isAuthenticated) {
      Toast.show({
        icon: 'fail',
        content: '请先登录后再联系'
      });
      navigate('/login');
      return;
    }

    // 如果是发布者，检查是否有接单者
    if (user?.id === errand.publisher_id) {
      if (!errand.accepter_id) {
        Toast.show({
          icon: 'fail',
          content: '任务尚未被接单，请等待接单者联系您'
        });
        return;
      }
    }

    // 如果是接单者，检查是否是自己的任务（不能接自己的任务，这个已经在接单时检查了）
    // 这里不需要额外检查，因为接单者可以联系发布者

    try {
      // 创建或获取会话
      const response = await api.post('/chat/conversations', {
        errand_id: errand.id
      });

      if (response.data.success) {
        navigate(`/chat/${response.data.conversationId || response.data.conversation?.id}`);
      }
    } catch (err) {
      console.error('创建会话失败:', err);
      Toast.show({
        icon: 'fail',
        content: err.response?.data?.message || '创建会话失败'
      });
    }
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F5F5F5'
      }}>
        <Loading />
      </div>
    );
  }

  if (error || !errand) {
    return (
      <div style={{ 
        padding: '20px',
        minHeight: '100vh',
        background: '#F5F5F5'
      }}>
        <ErrorBlock status='default' title={error || '跑腿任务不存在'} />
      </div>
    );
  }

  const isPublisher = isAuthenticated && user?.id && errand?.publisher_id && Number(user.id) === Number(errand.publisher_id);
  const isAccepter = isAuthenticated && user?.id && errand?.accepter_id && Number(user.id) === Number(errand.accepter_id);
  const canAccept = isAuthenticated && errand.status === 'pending' && !isPublisher;
  
  // 可以确认完成的条件：任务已接单，且当前用户是发布者或接单者，且任务未完成
  const canComplete = isAuthenticated && errand.status === 'accepted' && (isPublisher || isAccepter);
  
  // 检查确认状态
  const publisherConfirmed = errand.confirmed_by_publisher === 1 || errand.confirmed_by_publisher === true;
  const accepterConfirmed = errand.confirmed_by_accepter === 1 || errand.confirmed_by_accepter === true;
  const userConfirmed = isPublisher ? publisherConfirmed : (isAccepter ? accepterConfirmed : false);
  const canCancel = isAuthenticated && isPublisher && errand.status === 'pending';
  const canDelete = isAuthenticated && isPublisher && errand.status !== 'accepted' && errand.status !== 'completed';

  const getStatusColor = (status) => {
    const colors = {
      pending: '#00D4AA',
      accepted: '#4A90E2',
      completed: '#999999',
      cancelled: '#FF5722'
    };
    return colors[status] || '#999999';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: '待接单',
      accepted: '已接单',
      completed: '已完成',
      cancelled: '已取消'
    };
    return texts[status] || status;
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#F5F5F5',
      paddingBottom: '80px'
    }}>
      <NavBar 
        onBack={() => navigate(-1)} 
        style={{ 
          background: '#FFFFFF', 
          borderBottom: '1px solid #F0F0F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
      >
        <span style={{ fontSize: '17px', fontWeight: '600' }}>跑腿任务详情</span>
      </NavBar>

      <div style={{ padding: '16px' }}>
        <Card style={{
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        border: 'none',
        padding: '20px'
      }}>
        {/* 标题和状态 */}
        <div style={{ 
          marginBottom: '20px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: '22px',
            fontWeight: '700',
            color: '#1A1A1A',
            flex: 1,
            lineHeight: '1.4'
          }}>
            {errand.title}
          </h2>
          <Tag style={{
            background: getStatusColor(errand.status),
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '12px',
            padding: '6px 16px',
            fontSize: '13px',
            fontWeight: '600',
            flexShrink: 0
          }}>
            {getStatusText(errand.status)}
          </Tag>
        </div>

        {/* 报酬 */}
        <div style={{ 
          marginBottom: '24px',
          padding: '16px',
          background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%)',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: '14px', 
            color: 'rgba(255,255,255,0.9)',
            marginBottom: '4px'
          }}>
            报酬
          </div>
          <div style={{ 
            fontSize: '36px', 
            fontWeight: '700', 
            color: '#FFFFFF',
            fontFamily: 'DIN Alternate, "Roboto", -apple-system, sans-serif'
          }}>
            ¥{errand.reward}
          </div>
        </div>

        {/* 地点信息 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            fontSize: '15px', 
            color: '#666666', 
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '18px' }}>📍</span>
            <span><strong>地点：</strong>{errand.location}</span>
          </div>
          {errand.destination && (
            <div style={{ 
              fontSize: '15px', 
              color: '#666666',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '18px' }}>🎯</span>
              <span><strong>目的地：</strong>{errand.destination}</span>
            </div>
          )}
        </div>

        {/* 分类 */}
        {errand.category && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', color: '#666666' }}>
              <strong>分类：</strong>{errand.category}
            </div>
          </div>
        )}

        {/* 描述 */}
        {errand.description && (
          <div style={{ 
            marginBottom: '16px',
            padding: '16px',
            background: '#F5F5F5',
            borderRadius: '12px'
          }}>
            <div style={{ 
              fontSize: '15px', 
              color: '#666666',
              marginBottom: '8px',
              fontWeight: '600'
            }}>
              任务描述
            </div>
            <div style={{ 
              fontSize: '15px', 
              color: '#1A1A1A', 
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6'
            }}>
              {errand.description}
            </div>
          </div>
        )}

        {/* 联系方式 */}
        {errand.contact_info && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', color: '#666666' }}>
              <strong>联系方式：</strong>{errand.contact_info}
            </div>
          </div>
        )}

        {/* 截止时间 */}
        {errand.deadline && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', color: '#666666' }}>
              <strong>截止时间：</strong>{new Date(errand.deadline).toLocaleString('zh-CN')}
            </div>
          </div>
        )}

        {/* 发布者信息 */}
        <div style={{ 
          marginBottom: '16px', 
          padding: '16px', 
          background: '#F5F5F5', 
          borderRadius: '12px' 
        }}>
          <div style={{ 
            fontSize: '15px', 
            color: '#666666', 
            marginBottom: '6px',
            fontWeight: '600'
          }}>
            发布者
          </div>
          <div style={{ fontSize: '14px', color: '#1A1A1A', marginBottom: '4px' }}>
            {errand.publisher_name} ({errand.publisher_email})
          </div>
          <div style={{ fontSize: '12px', color: '#999999', marginBottom: '12px' }}>
            发布时间：{new Date(errand.created_at).toLocaleString('zh-CN')}
          </div>
          <Button
            size='small'
            fill='outline'
            onClick={() => navigate(`/seller/${errand.publisher_id}`)}
            style={{
              borderRadius: '8px',
              fontSize: '13px',
              borderColor: '#00D4AA',
              color: '#00D4AA',
              fontWeight: '500'
            }}
          >
            👤 查看发布者主页
          </Button>
        </div>

        {/* 接单者信息 */}
        {errand.accepter_name && (
          <div style={{ 
            marginBottom: '16px', 
            padding: '16px', 
            background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(53, 122, 189, 0.1) 100%)', 
            borderRadius: '12px' 
          }}>
            <div style={{ 
              fontSize: '15px', 
              color: '#666666', 
              marginBottom: '6px',
              fontWeight: '600'
            }}>
              接单者
            </div>
            <div style={{ fontSize: '14px', color: '#1A1A1A', marginBottom: '4px' }}>
              {errand.accepter_name} ({errand.accepter_email})
            </div>
            {errand.accepted_at && (
              <div style={{ fontSize: '12px', color: '#999999', marginBottom: '12px' }}>
                接单时间：{new Date(errand.accepted_at).toLocaleString('zh-CN')}
              </div>
            )}
            <Button
              size='small'
              fill='outline'
              onClick={() => navigate(`/seller/${errand.accepter_id}`)}
              style={{
                borderRadius: '8px',
                fontSize: '13px',
                borderColor: '#4A90E2',
                color: '#4A90E2',
                fontWeight: '500'
              }}
            >
              👤 查看接单者主页
            </Button>
          </div>
        )}

        {/* 完成时间 */}
        {errand.completed_at && (
          <div style={{ 
            marginBottom: '16px', 
            padding: '16px', 
            background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.1) 0%, rgba(0, 184, 148, 0.1) 100%)', 
            borderRadius: '12px' 
          }}>
            <div style={{ fontSize: '12px', color: '#999999' }}>
              完成时间：{new Date(errand.completed_at).toLocaleString('zh-CN')}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ 
          marginTop: '24px', 
          display: 'flex', 
          gap: '12px', 
          flexWrap: 'wrap' 
        }}>
          {!isPublisher && (
            <Button
              block
              color='primary'
              fill='outline'
              size='large'
              onClick={handleContact}
              style={{
                borderRadius: '12px',
                height: '44px',
                fontSize: '15px',
                fontWeight: '600',
                borderColor: '#00D4AA',
                color: '#00D4AA'
              }}
            >
              💬 联系发布者
            </Button>
          )}

          {isPublisher && errand.accepter_id && (
            <Button
              block
              color='primary'
              fill='outline'
              size='large'
              onClick={handleContact}
              style={{
                borderRadius: '12px',
                height: '44px',
                fontSize: '15px',
                fontWeight: '600',
                borderColor: '#00D4AA',
                color: '#00D4AA'
              }}
            >
              💬 联系接单者
            </Button>
          )}

          {canAccept && (
            <Button
              block
              color='primary'
              size='large'
              onClick={handleAccept}
              loading={actionLoading}
              style={{
                borderRadius: '12px',
                height: '44px',
                fontSize: '15px',
                fontWeight: '600',
                background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
                border: 'none',
                boxShadow: '0 4px 16px rgba(0, 212, 170, 0.3)'
              }}
            >
              ✅ 接单
            </Button>
          )}

          {canComplete && (
            <>
              {userConfirmed ? (
                <div style={{
                  padding: '12px',
                  background: '#E8F5E9',
                  borderRadius: '12px',
                  textAlign: 'center',
                  color: '#2E7D32',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '12px'
                }}>
                  {publisherConfirmed && accepterConfirmed ? t('errand.bothConfirmed') : (isPublisher ? t('errand.waitingForAccepter') : t('errand.waitingForPublisher'))}
                </div>
              ) : (
            <Button
              block
              color='success'
              size='large'
              onClick={handleComplete}
              loading={actionLoading}
              style={{
                borderRadius: '12px',
                height: '44px',
                fontSize: '15px',
                    fontWeight: '600',
                    marginBottom: '12px'
              }}
            >
                  🎉 {t('errand.confirmComplete')}
            </Button>
              )}
              {publisherConfirmed && accepterConfirmed && (
                <div style={{
                  padding: '12px',
                  background: '#C8E6C9',
                  borderRadius: '12px',
                  textAlign: 'center',
                  color: '#1B5E20',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  🎉 {t('errand.bothConfirmed')}
                </div>
              )}
            </>
          )}

          {canCancel && (
            <Button
              block
              color='warning'
              size='large'
              onClick={handleCancel}
              loading={actionLoading}
              style={{
                borderRadius: '12px',
                height: '44px',
                fontSize: '15px',
                fontWeight: '600'
              }}
            >
              ⚠️ 取消任务
            </Button>
          )}

          {canDelete && (
            <Button
              block
              color='danger'
              size='large'
              onClick={handleDelete}
              loading={actionLoading}
              style={{
                borderRadius: '12px',
                height: '44px',
                fontSize: '15px',
                fontWeight: '600'
              }}
            >
              🗑️ 删除任务
            </Button>
          )}
        </div>
      </Card>
      </div>
    </div>
  );
};

export default ErrandDetailPage;
