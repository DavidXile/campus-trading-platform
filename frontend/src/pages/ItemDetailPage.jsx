import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Image,
  Button,
  Space,
  Loading,
  ErrorBlock,
  Tag,
  Divider,
  Toast,
  Dialog,
  NavBar
} from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import useUserStore from '../store/userStore';

const ItemDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated, user } = useUserStore();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // 获取物品详情
  const fetchItemDetail = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/items/${id}`);

      if (response.data.success) {
        setItem(response.data.item);
        setError(null);
      } else {
        setError('获取物品信息失败');
      }
    } catch (err) {
      console.error('获取物品详情失败:', err);
      if (err.response?.status === 404) {
        setError('物品不存在');
      } else {
        setError('获取物品信息失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchItemDetail();
    }
  }, [id, fetchItemDetail]);

  // 处理联系卖家（打开聊天）
  const handleContactSeller = async () => {
    if (!isAuthenticated) {
      Toast.show({
        icon: 'fail',
        content: t('item.loginRequired')
      });
      navigate('/login');
      return;
    }

    // 检查是否是自己的物品（确保类型一致）
    if (user?.id && item?.seller_id && Number(user.id) === Number(item.seller_id)) {
      Toast.show({
        icon: 'fail',
        content: t('item.ownItem')
      });
      return;
    }
    
    // 调试日志
    console.log('🔍 联系卖家调试信息:');
    console.log('  user.id:', user?.id, 'type:', typeof user?.id);
    console.log('  item.seller_id:', item?.seller_id, 'type:', typeof item?.seller_id);
    console.log('  user.id === item.seller_id:', user?.id === item?.seller_id);
    console.log('  Number(user.id) === Number(item.seller_id):', Number(user?.id) === Number(item?.seller_id));

    try {
      // 创建或获取会话
      const response = await api.post('/chat/conversations', {
        item_id: item.id
      });

      if (response.data.success) {
        navigate(`/chat/${response.data.conversationId || response.data.conversation?.id}`);
      }
    } catch (err) {
      console.error('创建会话失败:', err);
      const errorMessage = err.response?.data?.message || t('item.createConversationFailed');
      
      // 如果是卖家查看自己的商品，显示更友好的提示
      if (errorMessage.includes('商品尚未售出') || errorMessage.includes('等待买家联系')) {
        Dialog.alert({
          content: t('item.ownItemMessage'),
          confirmText: t('common.confirm'),
        });
      } else {
      Toast.show({
        icon: 'fail',
          content: errorMessage
      });
      }
    }
  };

  // 处理购买
  const handlePurchase = () => {
    if (!isAuthenticated) {
      Toast.show({
        icon: 'fail',
        content: t('item.loginRequired')
      });
      navigate('/login');
      return;
    }

    if (isOwner) {
      Toast.show({
        icon: 'fail',
        content: t('item.ownItem')
      });
      return;
    }

    if (item?.status !== 'available' || item?.buyer_id) {
      Toast.show({
        icon: 'fail',
        content: t('item.purchased')
      });
      return;
    }

    Dialog.confirm({
      content: t('item.purchaseConfirm', { price: item.price }),
      confirmText: t('item.purchaseButton'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        try {
          setActionLoading(true);
          const response = await api.post(`/items/${id}/purchase`);
          if (response.data.success) {
            Toast.show({
              icon: 'success',
              content: t('item.purchaseSuccess')
            });
            fetchItemDetail();
          }
        } catch (err) {
          console.error('购买失败:', err);
          const message = err.response?.data?.message || t('item.purchaseFailed');
          Toast.show({
            icon: 'fail',
            content: message
          });
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  // 处理编辑物品（仅卖家）
  const handleEditItem = () => {
    navigate(`/edit/${id}`);
  };

  // 处理删除物品（仅卖家）
  const handleDeleteItem = async () => {
    Dialog.confirm({
      content: t('item.deleteConfirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        try {
          const response = await api.delete(`/items/${id}`);

          if (response.data.success) {
            Toast.show({
              icon: 'success',
              content: t('item.deleteSuccess')
            });
            navigate('/');
          }
        } catch (error) {
          console.error('删除物品失败:', error);
          Toast.show({
            icon: 'fail',
            content: t('item.deleteFailed')
          });
        }
      }
    });
  };

  // 渲染加载状态
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '40px',
        minHeight: '100vh',
        background: '#F5F5F5'
      }}>
        <Loading />
      </div>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <div style={{ 
        padding: '20px',
        minHeight: '100vh',
        background: '#F5F5F5'
      }}>
        <ErrorBlock status='default' title={error} />
      </div>
    );
  }

  // 渲染物品不存在
  if (!item) {
    return (
      <div style={{ 
        padding: '20px',
        minHeight: '100vh',
        background: '#F5F5F5'
      }}>
        <ErrorBlock status='empty' title='物品不存在' />
      </div>
    );
  }

  // 检查是否是卖家（确保类型一致）
  const isOwner = isAuthenticated && user?.id && item?.seller_id && Number(user.id) === Number(item.seller_id);
  
  // 检查是否是买家
  const isBuyer = isAuthenticated && user?.id && item?.buyer_id && Number(user.id) === Number(item.buyer_id);
  
  // 检查是否可以发起纠纷（买家或卖家，且商品已售出或处于纠纷状态）
  const canCreateDispute = isAuthenticated && (isBuyer || isOwner) && 
    (item.status === 'sold' || item.status === 'disputed');
  
  // 处理发起纠纷
  const handleCreateDispute = () => {
    if (!isAuthenticated) {
      Toast.show({
        icon: 'fail',
        content: t('item.loginRequired')
      });
      navigate('/login');
      return;
    }
    navigate(`/dispute/create/${item.id}`);
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
        <span style={{ fontSize: '17px', fontWeight: '600' }}>物品详情</span>
      </NavBar>

      <div style={{ padding: '16px' }}>
        <Card style={{
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        border: 'none',
        padding: '0',
        overflow: 'hidden'
      }}>
        {/* 物品图片 */}
        <div style={{ 
          width: '100%',
          background: '#FFFFFF',
          padding: '16px',
          textAlign: 'center'
        }}>
          <Image
            src={item.image_url || '/placeholder-image.png'}
            fit='contain'
            width='100%'
            height={300}
            style={{ 
              borderRadius: '12px',
              objectFit: 'contain'
            }}
            fallback={
              <div style={{
                width: '100%',
                height: '300px',
                background: 'linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999999'
              }}>
                <div style={{ fontSize: '64px', opacity: 0.3, marginBottom: '12px' }}>📦</div>
                <div style={{ fontSize: '14px', opacity: 0.5 }}>暂无图片</div>
              </div>
            }
          />
        </div>

        <div style={{ padding: '20px' }}>
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
              {item.title}
            </h2>
            <Tag style={{
              background: (item.status === 'available' && !item.buyer_id) ? '#00D4AA' : '#999999',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: '600',
              flexShrink: 0
            }}>
              {(item.status === 'available' && !item.buyer_id) ? t('item.available') : t('item.purchased')}
            </Tag>
          </div>

          {/* 价格 */}
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
              {t('item.price')}
            </div>
            <div style={{ 
              fontSize: '36px', 
              fontWeight: '700', 
              color: '#FFFFFF',
              fontFamily: 'DIN Alternate, "Roboto", -apple-system, sans-serif'
            }}>
              ¥{item.price}
            </div>
          </div>

          {/* 基本信息 */}
          <div style={{ 
            marginBottom: '16px',
            padding: '16px',
            background: '#F5F5F5',
            borderRadius: '12px'
          }}>
            <div style={{ 
              fontSize: '15px', 
              color: '#666666',
              marginBottom: '8px'
            }}>
              <strong>{t('item.category')}：</strong>{item.category || t('item.noCategory')}
            </div>
            <div style={{ 
              fontSize: '15px', 
              color: '#666666'
            }}>
              <strong>{t('item.publishTime')}：</strong>{new Date(item.created_at).toLocaleString('zh-CN')}
            </div>
          </div>

          {/* 物品描述 */}
          {item.description && (
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
                {t('item.description')}
              </div>
              <div style={{
                fontSize: '15px',
                lineHeight: '1.6',
                color: '#1A1A1A',
                whiteSpace: 'pre-wrap'
              }}>
                {item.description}
              </div>
            </div>
          )}

          {/* 卖家信息 */}
          <div style={{ 
            marginBottom: '24px', 
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
              {t('item.seller')}
            </div>
            <div style={{ fontSize: '14px', color: '#1A1A1A', marginBottom: '4px' }}>
              {item.seller_name} ({item.seller_email})
            </div>
            <div style={{ fontSize: '12px', color: '#999999', marginBottom: '12px' }}>
              {t('item.publishTime')}：{new Date(item.created_at).toLocaleString('zh-CN')}
            </div>
            <Button
              size='small'
              fill='outline'
              onClick={() => navigate(`/seller/${item.seller_id}`)}
              style={{
                borderRadius: '8px',
                fontSize: '13px',
                borderColor: '#00D4AA',
                color: '#00D4AA',
                fontWeight: '500'
              }}
            >
              👤 {t('item.viewSeller')}
            </Button>
          </div>

          {/* 买家信息（仅对卖家可见，且商品已售出） */}
          {isOwner && item.status === 'sold' && item.buyer_id && (
            <div style={{ 
              marginBottom: '24px', 
              padding: '16px', 
              background: 'linear-gradient(135deg, #FFF4E6 0%, #FFE8CC 100%)',
              borderRadius: '12px',
              border: '2px solid #FFB84D'
            }}>
              <div style={{ 
                fontSize: '15px', 
                color: '#FF6B35', 
                marginBottom: '8px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                🎉 {t('item.buyerInfo')}
              </div>
              <div style={{ fontSize: '14px', color: '#1A1A1A', marginBottom: '4px', fontWeight: '500' }}>
                {item.buyer_name || t('item.unknownBuyer')} {item.buyer_email && `(${item.buyer_email})`}
              </div>
              {item.purchased_at && (
                <div style={{ fontSize: '12px', color: '#666666', marginBottom: '12px' }}>
                  {t('item.purchasedTime')}：{new Date(item.purchased_at).toLocaleString('zh-CN')}
                </div>
              )}
              <Button
                size='small'
                color='primary'
                onClick={async () => {
                  try {
                    const response = await api.post('/chat/conversations', {
                      item_id: item.id
                    });
                    if (response.data.success) {
                      navigate(`/chat/${response.data.conversationId}`);
                    }
                  } catch (error) {
                    console.error('创建会话失败:', error);
                    Toast.show({
                      icon: 'fail',
                      content: error.response?.data?.message || t('item.contactBuyerFailed')
                    });
                  }
                }}
                style={{
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%)',
                  border: 'none'
                }}
              >
                💬 {t('item.contactBuyer')}
              </Button>
            </div>
          )}

          {/* 操作按钮 */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            flexWrap: 'wrap' 
          }}>
            {!isOwner ? (
              <>
                <Button
                  block
                  color='primary'
                  size='large'
                  onClick={handlePurchase}
                  loading={actionLoading}
                  disabled={item.status !== 'available'}
                  style={{
                    borderRadius: '12px',
                    height: '44px',
                    fontSize: '15px',
                    fontWeight: '600',
                    background: (item.status === 'available' && !item.buyer_id)
                      ? 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)'
                      : '#CCCCCC',
                    border: 'none',
                    boxShadow: (item.status === 'available' && !item.buyer_id)
                      ? '0 4px 16px rgba(0, 212, 170, 0.3)'
                      : 'none'
                  }}
                >
                  {(item.status === 'available' && !item.buyer_id) ? `💰 ${t('item.purchaseNow')}` : t('item.purchased')}
                </Button>
                <Button
                  block
                  color='primary'
                  fill='outline'
                  size='large'
                  onClick={handleContactSeller}
                  style={{
                    borderRadius: '12px',
                    height: '44px',
                    fontSize: '15px',
                    fontWeight: '600',
                    borderColor: '#00D4AA',
                    color: '#00D4AA'
                  }}
                >
                  💬 {t('item.contactSeller')}
                </Button>
                {/* 买家也可以发起纠纷（商品已售出或处于纠纷状态） */}
                {(item.status === 'sold' || item.status === 'disputed') && canCreateDispute && (
                  <Button
                    block
                    color='warning'
                    fill='outline'
                    size='large'
                    onClick={handleCreateDispute}
                    style={{
                      borderRadius: '12px',
                      height: '44px',
                      fontSize: '15px',
                      fontWeight: '600',
                      borderColor: '#FF6B35',
                      color: '#FF6B35',
                      marginTop: '12px'
                    }}
                  >
                    ⚠️ {t('dispute.createDispute') || '发起纠纷'}
                  </Button>
                )}
              </>
            ) : (
              <>
                {/* 只有未售出的物品才能编辑 */}
                {(item.status === 'available' && !item.buyer_id) && (
                  <Button
                    block
                    color='primary'
                    fill='outline'
                    size='large'
                    onClick={handleEditItem}
                    style={{
                      borderRadius: '12px',
                      height: '44px',
                      fontSize: '15px',
                      fontWeight: '600',
                      borderColor: '#00D4AA',
                      color: '#00D4AA'
                    }}
                  >
                    ✏️ {t('item.edit')}
                  </Button>
                )}
                {/* 只有未售出的物品才能删除 */}
                {(item.status === 'available' && !item.buyer_id) && (
                  <Button
                    block
                    color='danger'
                    fill='outline'
                    size='large'
                    onClick={handleDeleteItem}
                    style={{
                      borderRadius: '12px',
                      height: '44px',
                      fontSize: '15px',
                      fontWeight: '600'
                    }}
                  >
                    🗑️ {t('item.delete')}
                  </Button>
                )}
                {/* 已售出的物品显示提示和发起纠纷按钮 */}
                {item.status === 'sold' && (
                  <>
                  <div style={{
                    padding: '12px',
                    background: '#F5F5F5',
                    borderRadius: '12px',
                    textAlign: 'center',
                    color: '#666666',
                      fontSize: '14px',
                      marginBottom: '12px'
                  }}>
                      {t('item.soldCannotEdit')}
                  </div>
                    {canCreateDispute && (
                      <Button
                        block
                        color='warning'
                        fill='outline'
                        size='large'
                        onClick={handleCreateDispute}
                        style={{
                          borderRadius: '12px',
                          height: '44px',
                          fontSize: '15px',
                          fontWeight: '600',
                          borderColor: '#FF6B35',
                          color: '#FF6B35'
                        }}
                      >
                        ⚠️ {t('dispute.createDispute') || '发起纠纷'}
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </Card>
      </div>
    </div>
  );
};

export default ItemDetailPage;

