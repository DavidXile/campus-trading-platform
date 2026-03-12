import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, List, Tag, Loading, ErrorBlock, Divider, Empty, Button, Toast, Image, Popup, InfiniteScroll } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import useUserStore from '../store/userStore';
import CompleteProfileModal from '../components/CompleteProfileModal';

const Profile = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, updateUser, logout } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publishedItems, setPublishedItems] = useState([]);
  const [purchasedItems, setPurchasedItems] = useState([]);
  const [soldItems, setSoldItems] = useState([]);
  const [publishedErrands, setPublishedErrands] = useState([]);
  const [acceptedErrands, setAcceptedErrands] = useState([]);
  const [myDisputes, setMyDisputes] = useState([]);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);
  const [creditRecordsVisible, setCreditRecordsVisible] = useState(false);
  const [creditRecords, setCreditRecords] = useState([]);
  const [creditRecordsLoading, setCreditRecordsLoading] = useState(false);
  const [creditRecordsPage, setCreditRecordsPage] = useState(1);
  const [creditRecordsHasMore, setCreditRecordsHasMore] = useState(true);

  const isProfileComplete = Boolean(user?.phone && user?.college);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 处理头像上传
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      Toast.show({ icon: 'fail', content: t('profile.imageFileRequired') });
      return;
    }

    // 验证文件大小（2MB）
    if (file.size > 2 * 1024 * 1024) {
      Toast.show({ icon: 'fail', content: t('profile.imageSizeExceeded') });
      return;
    }

    try {
      setUploadingAvatar(true);
      // 将图片转换为base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = event.target.result;
        
        try {
          const response = await api.post('/users/avatar', {
            avatar: base64Image
          });

          if (response.data.success) {
            Toast.show({
              icon: 'success',
              content: t('profile.avatarUploadSuccess')
            });
            // 更新用户信息
            updateUser(response.data.user);
          }
        } catch (err) {
          console.error('上传头像失败:', err);
          const message = err.response?.data?.message || t('profile.avatarUploadFailed');
          Toast.show({ icon: 'fail', content: message });
        } finally {
          setUploadingAvatar(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      reader.onerror = () => {
        Toast.show({ icon: 'fail', content: t('profile.readImageFailed') });
        setUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('处理头像失败:', err);
      Toast.show({ icon: 'fail', content: t('profile.processAvatarFailed') });
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        
        // 刷新用户信息（包括信用分和钱包余额）
        try {
          const userResponse = await api.get('/users/me');
          console.log('🔍 Profile页面获取用户信息:', userResponse.data);
          if (userResponse.data.success && userResponse.data.user) {
            console.log('🔍 更新用户信息，信用分:', userResponse.data.user.credit_score);
            updateUser(userResponse.data.user);
          }
        } catch (err) {
          console.error('刷新用户信息失败:', err);
        }
        
        const [
          myItemsRes,
          purchasedRes,
          soldRes,
          publishedErrandsRes,
          acceptedErrandsRes,
          disputesRes
        ] = await Promise.all([
          api.get('/items/user/my-items'),
          api.get('/items/user/purchased'),
          api.get('/items/user/sold'),
          api.get('/errands/user/my-errands?type=published'),
          api.get('/errands/user/my-errands?type=accepted'),
          api.get('/disputes/user/my-disputes').catch(() => ({ data: { success: true, disputes: [] } }))
        ]);

        setPublishedItems(myItemsRes.data.items || []);
        setPurchasedItems(purchasedRes.data.items || []);
        setSoldItems(soldRes.data.items || []);
        setPublishedErrands(publishedErrandsRes.data.errands || []);
        setAcceptedErrands(acceptedErrandsRes.data.errands || []);
        setMyDisputes(disputesRes.data.disputes || []);
        setError(null);
      } catch (err) {
        console.error('加载个人数据失败:', err);
        console.error('错误详情:', err.response?.data || err.message);
        const errorMessage = err.response?.data?.message || err.message || '加载个人数据失败，请稍后重试';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // 监听纠纷刷新事件
    const handleRefreshDisputes = () => {
      fetchData();
    };
    window.addEventListener('refreshDisputes', handleRefreshDisputes);
    
    // 监听用户信息刷新事件
    const handleRefreshUser = async () => {
      try {
        const userResponse = await api.get('/users/me');
        if (userResponse.data.success && userResponse.data.user) {
          updateUser(userResponse.data.user);
        }
      } catch (err) {
        console.error('刷新用户信息失败:', err);
      }
    };
    window.addEventListener('refreshUser', handleRefreshUser);
    
    return () => {
      window.removeEventListener('refreshDisputes', handleRefreshDisputes);
      window.removeEventListener('refreshUser', handleRefreshUser);
    };
  }, [user?.id]); // 只依赖 user.id，避免无限循环

  // 获取信用记录
  const fetchCreditRecords = async (pageNum = 1) => {
    try {
      setCreditRecordsLoading(true);
      const response = await api.get(`/users/credit-records?page=${pageNum}&limit=20`);
      if (response.data.success) {
        if (pageNum === 1) {
          setCreditRecords(response.data.records || []);
        } else {
          setCreditRecords(prev => [...prev, ...(response.data.records || [])]);
        }
        setCreditRecordsHasMore(response.data.pagination.page < response.data.pagination.totalPages);
        setCreditRecordsPage(pageNum);
      }
    } catch (err) {
      console.error('获取信用记录失败:', err);
      Toast.show({
        icon: 'fail',
        content: err.response?.data?.message || '获取信用记录失败'
      });
    } finally {
      setCreditRecordsLoading(false);
    }
  };

  // 格式化变更类型
  const formatChangeType = (type, description) => {
    // 如果描述中包含"申诉成功"，显示为"申诉成功"
    if (description && description.includes('申诉成功')) {
      return '申诉成功';
    }
    
    const typeMap = {
      'dispute_penalty': '纠纷扣分',
      'dispute_reward': '纠纷奖励',
      'ban_penalty': '封禁扣分',
      'admin_adjustment': '管理员调整',
      'appeal_rejected': '申诉被驳回'
    };
    return typeMap[type] || type;
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px' }}>
        <ErrorBlock status='default' title={error} />
      </div>
    );
  }

  const renderItemList = (items) => {
    if (!items.length) {
      return <Empty description={t('common.noData')} style={{ padding: '40px 0' }} />;
    }

    return (
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '12px'
      }}>
        {items.map((item) => (
          <Card
            key={item.id}
            style={{
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              overflow: 'hidden',
              cursor: 'pointer',
              border: 'none'
            }}
            onClick={() => navigate(`/item/${item.id}`)}
          >
            <div style={{ position: 'relative' }}>
              <Image
                src={item.image_url || '/placeholder-image.png'}
                fit='cover'
                width='100%'
                height={120}
                style={{ display: 'block' }}
                fallback={<div style={{
                  width: '100%',
                  height: '120px',
                  background: 'linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                  opacity: 0.3
                }}>📦</div>}
              />
              <Tag 
                color={item.status === 'available' ? 'primary' : 'success'}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  padding: '2px 8px'
                }}
              >
                {item.status === 'available' ? '在售' : '已售出'}
              </Tag>
            </div>
            <div style={{ padding: '10px' }}>
              <div style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#1A1A1A',
                marginBottom: '6px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {item.title}
              </div>
              <div style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#FF6B35'
              }}>
                ¥{item.price}
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderErrandList = (errands, emptyText) => {
    if (!errands.length) {
      return <Empty description={emptyText} />;
    }

    return (
      <List>
        {errands.map((errand) => (
          <List.Item
            key={errand.id}
            description={`¥${errand.reward} · ${errand.location}`}
            extra={
              <Tag color={
                errand.status === 'pending'
                  ? 'primary'
                  : errand.status === 'accepted'
                    ? 'success'
                    : errand.status === 'completed'
                      ? 'default'
                      : 'danger'
              }>
                {{
                  pending: t('errand.pending'),
                  accepted: t('errand.accepted'),
                  completed: t('errand.completed'),
                  cancelled: t('errand.cancelled')
                }[errand.status]}
              </Tag>
            }
            onClick={() => window.location.assign(`/errand/${errand.id}`)}
          >
            {errand.title}
          </List.Item>
        ))}
      </List>
    );
  };

  // 统计数据
  const stats = {
    published: publishedItems.length,
    sold: soldItems.length,
    purchased: purchasedItems.length
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#F5F5F5',
      paddingBottom: '80px'
    }}>
      {/* 头部背景区域 */}
      <div style={{
        position: 'relative',
        height: '200px',
        background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
        paddingTop: '40px'
      }}>
        {/* 背景装饰 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          opacity: 0.1
        }} />
        
        {/* 头像 - 叠加在背景上 */}
        <div style={{ 
          position: 'relative', 
          zIndex: 1,
          display: 'flex', 
          justifyContent: 'center', 
          marginBottom: '16px' 
        }}>
          <div 
            style={{ 
              position: 'relative', 
              cursor: 'pointer' 
            }} 
            onClick={() => fileInputRef.current?.click()}
          >
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '4px solid #FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
              }}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt="头像"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div style={{ fontSize: '60px' }}>👤</div>
              )}
              {uploadingAvatar && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Loading />
                </div>
              )}
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: '0',
                right: '0',
                backgroundColor: '#00D4AA',
                color: 'white',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                border: '2px solid #FFFFFF'
              }}
            >
              📷
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarUpload}
            disabled={uploadingAvatar}
          />
        </div>
      </div>

      {/* 内容区域 - 限制最大宽度并居中 */}
      <div style={{ 
        maxWidth: '900px', 
        margin: '0 auto', 
        padding: '0 16px',
        marginTop: '-60px',
        position: 'relative',
        zIndex: 2
      }}>
        {/* 个人信息卡片 */}
        <Card style={{
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          marginBottom: '16px',
          padding: '24px'
        }}>
          {/* 用户名和标签 */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ 
              margin: '0 0 12px 0', 
              fontSize: '24px', 
              fontWeight: 'bold',
              color: '#1A1A1A'
            }}>
              {user?.username}
            </h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {user?.college && (
                <Tag color='primary' style={{ borderRadius: '12px', padding: '4px 12px' }}>
                  {user.college}
                </Tag>
              )}
              {user?.role === 'admin' && (
                <Tag color='warning' style={{ borderRadius: '12px', padding: '4px 12px' }}>
                  管理员
                </Tag>
              )}
              <Tag color={isProfileComplete ? 'success' : 'default'} style={{ borderRadius: '12px', padding: '4px 12px' }}>
                {isProfileComplete ? t('profile.profileComplete') : t('profile.profileIncomplete')}
              </Tag>
            </div>
          </div>

          {/* 数据概览 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-around',
            padding: '20px 0',
            borderTop: '1px solid #F0F0F0',
            borderBottom: '1px solid #F0F0F0',
            marginBottom: '20px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#00D4AA', marginBottom: '4px' }}>
                {stats.published}
              </div>
              <div style={{ fontSize: '14px', color: '#999999' }}>{t('profile.published')}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#FF6B35', marginBottom: '4px' }}>
                {stats.sold}
              </div>
              <div style={{ fontSize: '14px', color: '#999999' }}>{t('profile.sold')}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#00D4AA', marginBottom: '4px' }}>
                {stats.purchased}
              </div>
              <div style={{ fontSize: '14px', color: '#999999' }}>{t('profile.purchased')}</div>
            </div>
          </div>

          {/* 个人信息 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', color: '#666666', marginBottom: '8px' }}>
              <strong style={{ color: '#1A1A1A' }}>{t('profile.email')}：</strong>{user?.email}
            </div>
            {user?.phone && (
              <div style={{ fontSize: '14px', color: '#666666', marginBottom: '8px' }}>
                <strong style={{ color: '#1A1A1A' }}>{t('profile.phone')}：</strong>{user.phone}
              </div>
            )}
            {/* 钱包余额和信用分 */}
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              marginTop: '12px',
              padding: '12px',
              background: '#F8F9FA',
              borderRadius: '8px'
            }}>
              <div 
                style={{ flex: 1, cursor: 'pointer' }}
                onClick={() => navigate('/wallet')}
              >
                <div style={{ fontSize: '12px', color: '#999999', marginBottom: '4px' }}>
                  {t('profile.walletBalance') || '钱包余额'}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#00D4AA' }}>
                  ¥{user?.wallet_balance?.toFixed(2) || '0.00'}
                </div>
                <div style={{ fontSize: '11px', color: '#00D4AA', marginTop: '4px' }}>
                  点击查看详情 →
                </div>
              </div>
              <div 
                style={{ flex: 1, cursor: 'pointer' }}
                onClick={() => {
                  setCreditRecordsVisible(true);
                  fetchCreditRecords(1);
                }}
              >
                <div style={{ fontSize: '12px', color: '#999999', marginBottom: '4px' }}>
                  {t('profile.creditScore') || '信用分'}
                </div>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: (user?.credit_score ?? 100) >= 70 ? '#00D4AA' : (user?.credit_score ?? 100) >= 40 ? '#FFA500' : '#FF4444'
                }}>
                  {user?.credit_score ?? 100}
                </div>
                <div style={{ fontSize: '11px', color: '#999999', marginTop: '4px' }}>
                  点击查看详情 →
                </div>
              </div>
            </div>
            {/* 封禁状态提示 */}
            {user?.is_banned && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: '#FFF3E0',
                borderRadius: '8px',
                border: '1px solid #FFB74D'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#E65100', marginBottom: '4px' }}>
                  ⚠️ {t('profile.accountBanned') || '账号已被封禁'}
                </div>
                {user?.ban_reason && (
                  <div style={{ fontSize: '12px', color: '#666666', marginBottom: '4px' }}>
                    {t('profile.banReason') || '封禁原因'}：{user.ban_reason}
                  </div>
                )}
                {user?.ban_expires_at && (
                  <div style={{ fontSize: '12px', color: '#666666' }}>
                    {t('profile.banExpires') || '解封时间'}：{new Date(user.ban_expires_at).toLocaleString()}
                  </div>
                )}
                {!user?.ban_expires_at && (
                  <div style={{ fontSize: '12px', color: '#666666' }}>
                    {t('profile.permanentBan') || '永久封禁'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 按钮组 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                fill='outline'
                color='primary'
                onClick={() => setProfileModalVisible(true)}
                style={{ flex: 1, borderRadius: '12px' }}
              >
                {isProfileComplete ? t('profile.updateProfile') : t('profile.completeProfile')}
              </Button>
              <Button
                fill='none'
                onClick={handleLogout}
                style={{ 
                  color: '#999999',
                  fontSize: '14px'
                }}
              >
                {t('profile.logout')}
              </Button>
            </div>
            <Button
              fill='outline'
              color='default'
              onClick={() => navigate('/change-password')}
              style={{ borderRadius: '12px' }}
            >
              {t('profile.changePassword')}
            </Button>
          </div>
        </Card>

        {/* 发布过的物品 */}
        <Card 
          title={<span style={{ fontSize: '18px', fontWeight: '600' }}>{t('profile.myItems')}</span>}
          style={{
            borderRadius: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            marginBottom: '16px'
          }}
        >
          {renderItemList(publishedItems)}
        </Card>

        {/* 买过的物品 */}
        <Card 
          title={<span style={{ fontSize: '18px', fontWeight: '600' }}>{t('profile.purchasedItems')}</span>}
          style={{
            borderRadius: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            marginBottom: '16px'
          }}
        >
          {purchasedItems.length ? renderItemList(purchasedItems) : (
            <Empty description={t('profile.noPurchasedItems')} style={{ padding: '40px 0' }} />
          )}
        </Card>

        {/* 已售出的物品 */}
        <Card 
          title={<span style={{ fontSize: '18px', fontWeight: '600' }}>{t('profile.soldItems')}</span>}
          style={{
            borderRadius: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            marginBottom: '16px'
          }}
        >
          {soldItems.length ? (
            <List>
              {soldItems.map((item) => (
                <List.Item
                  key={item.id}
                  prefix={
                    <Image
                      src={item.image_url || '/placeholder-image.png'}
                      fit='cover'
                      width={80}
                      height={80}
                      style={{ borderRadius: '8px' }}
                      fallback={<div style={{
                        width: '80px',
                        height: '80px',
                        background: 'linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        opacity: 0.3
                      }}>📦</div>}
                    />
                  }
                  description={
                    <div>
                      <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                        {item.buyer_name ? (
                          <>
                            {t('item.buyerName')}: {item.buyer_name} {item.buyer_email && `(${item.buyer_email})`}
                          </>
                        ) : (
                          t('item.unknownBuyer')
                        )}
                      </div>
                      {item.purchased_at && (
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {t('item.purchasedTime')}: {new Date(item.purchased_at).toLocaleString('zh-CN')}
                        </div>
                      )}
                    </div>
                  }
                  extra={
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#FF6B35', marginBottom: '4px' }}>
                        ¥{item.price}
                      </div>
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
                          fontSize: '12px',
                          padding: '4px 12px',
                          height: 'auto'
                        }}
                      >
                        {t('item.contactBuyer')}
                      </Button>
                    </div>
                  }
                  onClick={() => navigate(`/item/${item.id}`)}
                >
                  <div style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>
                    {item.title}
                  </div>
                </List.Item>
              ))}
            </List>
          ) : (
            <Empty description={t('profile.noSoldItems')} style={{ padding: '40px 0' }} />
          )}
        </Card>

        {/* 发布过的跑腿 */}
        <Card 
          title={<span style={{ fontSize: '18px', fontWeight: '600' }}>{t('profile.myErrands')}</span>}
          style={{
            borderRadius: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            marginBottom: '16px'
          }}
        >
          {renderErrandList(publishedErrands, t('profile.noPublishedErrands'))}
        </Card>

        {/* 接收过的跑腿 */}
        <Card 
          title={<span style={{ fontSize: '18px', fontWeight: '600' }}>{t('profile.acceptedErrands')}</span>}
          style={{
            borderRadius: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            marginBottom: '16px'
          }}
        >
          {renderErrandList(acceptedErrands, t('profile.noAcceptedErrands'))}
        </Card>

        {/* 我的纠纷 */}
        <Card 
          title={<span style={{ fontSize: '18px', fontWeight: '600' }}>{t('dispute.myDisputes')}</span>}
          style={{
            borderRadius: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            marginBottom: '16px'
          }}
        >
          {myDisputes.length ? (
            <List>
              {myDisputes.map((dispute) => {
                const getStatusText = (status) => {
                  const statusMap = {
                    'pending_response': t('dispute.pendingResponse'),
                    'pending_review': t('dispute.pendingReview'),
                    'resolved': t('dispute.resolved'),
                    'appealed': t('dispute.appealed'),
                    'appeal_resolved': t('dispute.appealResolved')
                  };
                  return statusMap[status] || status;
                };

                const getStatusColor = (status) => {
                  const colorMap = {
                    'pending_response': 'warning',
                    'pending_review': 'primary',
                    'resolved': 'success',
                    'appealed': 'danger',
                    'appeal_resolved': 'default'
                  };
                  return colorMap[status] || 'default';
                };

                return (
                  <List.Item
                    key={dispute.id}
                    onClick={() => navigate(`/dispute/${dispute.id}`)}
                    extra={
                      <Tag color={getStatusColor(dispute.status)}>
                        {getStatusText(dispute.status)}
                      </Tag>
                    }
                  >
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A', marginBottom: '4px' }}>
                        {dispute.item_title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999999' }}>
                        {dispute.user_role === 'initiator' ? '发起者' : '响应者'} · {new Date(dispute.created_at).toLocaleString()}
                      </div>
                    </div>
                  </List.Item>
                );
              })}
            </List>
          ) : (
            <Empty description={t('dispute.noDisputes')} style={{ padding: '40px 0' }} />
          )}
        </Card>
      </div>

      <CompleteProfileModal
        visible={profileModalVisible}
        user={user}
        onClose={() => setProfileModalVisible(false)}
        onSuccess={(updated) => {
          updateUser(updated);
          setProfileModalVisible(false);
        }}
      />

      {/* 信用记录弹窗 */}
      <Popup
        visible={creditRecordsVisible}
        onMaskClick={() => setCreditRecordsVisible(false)}
        bodyStyle={{ height: '70vh', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}
      >
        <div style={{ padding: '16px' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>
            信用记录
          </div>
          {creditRecords.length === 0 && !creditRecordsLoading ? (
            <Empty description="暂无信用记录" style={{ padding: '40px 0' }} />
          ) : (
            <List>
              {creditRecords.map((record) => (
                <List.Item
                  key={record.id}
                  extra={
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold',
                        color: record.change_amount > 0 ? '#00D4AA' : '#FF4444'
                      }}>
                        {record.change_amount > 0 ? '+' : ''}{record.change_amount}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999999', marginTop: '4px' }}>
                        {record.score_before} → {record.score_after}
                      </div>
                    </div>
                  }
                >
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A', marginBottom: '4px' }}>
                      {formatChangeType(record.change_type, record.description)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999999', marginBottom: '4px' }}>
                      {record.description || '无描述'}
                    </div>
                    {record.item_title && (
                      <div style={{ fontSize: '12px', color: '#666666' }}>
                        相关商品: {record.item_title}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: '#999999', marginTop: '4px' }}>
                      {new Date(record.created_at).toLocaleString()}
                    </div>
                  </div>
                </List.Item>
              ))}
              <InfiniteScroll
                loadMore={async () => {
                  if (creditRecordsHasMore && !creditRecordsLoading) {
                    await fetchCreditRecords(creditRecordsPage + 1);
                  }
                }}
                hasMore={creditRecordsHasMore}
              />
            </List>
          )}
        </div>
      </Popup>
    </div>
  );
};

export default Profile;



