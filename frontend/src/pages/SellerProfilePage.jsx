import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  List,
  Tag,
  Loading,
  ErrorBlock,
  Empty,
  Button,
  Divider,
  Tabs,
  Image
} from 'antd-mobile';
import api from '../services/api';
import ErrandCard from '../components/ErrandCard';

const SellerProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [seller, setSeller] = useState(null);
  const [items, setItems] = useState([]);
  const [errands, setErrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('items');

  useEffect(() => {
    const fetchSellerProfile = async () => {
      if (!id) {
        setError('缺少用户信息');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await api.get(`/users/public/${id}`);
        if (response.data.success) {
          setSeller(response.data.user);
          setItems(response.data.items || []);
          setErrands(response.data.errands || []);
          setError(null);
        } else {
          setError('获取用户信息失败');
        }
      } catch (err) {
        console.error('获取用户信息失败:', err);
        if (err.response?.status === 404) {
          setError('该用户不存在');
        } else {
          setError('获取用户信息失败，请稍后重试');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSellerProfile();
  }, [id]);

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

  if (!seller) {
    return (
      <div style={{ 
        padding: '20px',
        minHeight: '100vh',
        background: '#F5F5F5'
      }}>
        <ErrorBlock status='empty' title='用户不存在' />
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: '#00D4AA',
      accepted: '#4A90E2',
      completed: '#999999',
      cancelled: '#FF5722',
      available: '#00D4AA',
      sold: '#999999'
    };
    return colors[status] || '#999999';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: '待接单',
      accepted: '已接单',
      completed: '已完成',
      cancelled: '已取消',
      available: '在售',
      sold: '已售出'
    };
    return texts[status] || status;
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#F5F5F5',
      paddingBottom: '80px'
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '20px'
      }}>
        {/* 头部背景区域 */}
        <div style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
          borderRadius: '16px',
          padding: '24px 24px 80px',
          overflow: 'hidden',
          marginBottom: '16px'
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
          
          {/* 用户名 */}
          <div style={{ 
            position: 'relative', 
            zIndex: 1,
            textAlign: 'center',
            marginBottom: '16px'
          }}>
            <h2 style={{ 
              margin: 0, 
              color: '#FFFFFF',
              fontSize: '22px',
              fontWeight: '700',
              textShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {seller.username}
            </h2>
          </div>
        </div>

        {/* 用户信息卡片 */}
        <Card style={{
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          border: 'none',
          marginBottom: '16px',
          marginTop: '-60px',
          position: 'relative',
          zIndex: 2,
          padding: '24px',
          paddingTop: '80px'
        }}>
          {/* 头像 - 完整展示在卡片顶部 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginBottom: '24px' 
          }}>
            <div style={{
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
            }}>
              {seller.avatar ? (
                <img
                  src={seller.avatar}
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
            </div>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* 邮箱 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0
              }}>
                📧
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  color: '#999999',
                  marginBottom: '4px'
                }}>
                  邮箱
                </div>
                <div style={{
                  fontSize: '15px',
                  color: '#1A1A1A',
                  fontWeight: '500'
                }}>
                  {seller.email}
                </div>
              </div>
            </div>

            {/* 手机号 */}
            {seller.phone && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  flexShrink: 0
                }}>
                  📱
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#999999',
                    marginBottom: '4px'
                  }}>
                    手机号
                  </div>
                  <div style={{
                    fontSize: '15px',
                    color: '#1A1A1A',
                    fontWeight: '500'
                  }}>
                    {seller.phone}
                  </div>
                </div>
              </div>
            )}

            {/* 加入时间 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0
              }}>
                📅
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  color: '#999999',
                  marginBottom: '4px'
                }}>
                  加入时间
                </div>
                <div style={{
                  fontSize: '15px',
                  color: '#1A1A1A',
                  fontWeight: '500'
                }}>
                  {new Date(seller.created_at).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </div>
        </div>
      </Card>
      </div>

      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '0 20px 20px'
      }}>
        {/* Tab切换 */}
        <Card style={{
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          border: 'none',
          marginBottom: '16px',
          padding: '0'
        }}>
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            style={{
              '--title-font-size': '16px',
              '--active-title-color': '#00D4AA',
              '--inactive-title-color': '#666666',
              '--active-line-height': '3px',
              '--fixed-active-line-width': '30px',
              fontWeight: '600'
            }}
          >
            <Tabs.Tab title={`发布的物品 (${items.length})`} key='items' />
            <Tabs.Tab title={`发布的跑腿 (${errands.length})`} key='errands' />
          </Tabs>
        </Card>

        {/* 物品列表 */}
        {activeTab === 'items' && (
          <Card style={{
            borderRadius: '16px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            border: 'none',
            padding: '0'
          }}>
        {items.length ? (
              <List style={{ '--border-inner': '1px solid #F0F0F0' }}>
            {items.map((item) => (
              <List.Item
                key={item.id}
                    style={{
                      padding: '16px',
                      cursor: 'pointer'
                    }}
                description={`¥${item.price} · ${item.category || '未分类'}`}
                extra={
                      <Tag style={{
                        background: getStatusColor(item.status),
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {getStatusText(item.status)}
                  </Tag>
                }
                onClick={() => navigate(`/item/${item.id}`)}
              >
                    <div style={{ 
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1A1A1A'
                    }}>
                {item.title}
                    </div>
              </List.Item>
            ))}
          </List>
        ) : (
              <div style={{ 
                padding: '60px 20px', 
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.3 }}>📦</div>
                <div style={{ 
                  fontSize: '16px', 
                  color: '#999999',
                  fontWeight: '500'
                }}>
                  该用户暂未发布物品
                </div>
              </div>
        )}
      </Card>
        )}

        {/* 跑腿任务列表 */}
        {activeTab === 'errands' && (
          <div>
            {errands.length ? (
              <div style={{ padding: '12px' }}>
                {errands.map(errand => (
                  <ErrandCard key={errand.id} errand={errand} />
                ))}
              </div>
            ) : (
              <Card style={{
                borderRadius: '16px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                border: 'none',
                padding: '60px 20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.3 }}>🏃</div>
                <div style={{ 
                  fontSize: '16px', 
                  color: '#999999',
                  fontWeight: '500'
                }}>
                  该用户暂未发布跑腿任务
                </div>
              </Card>
            )}
          </div>
        )}

        {/* 返回按钮 */}
        <div style={{ marginTop: '20px' }}>
          <Button 
            block 
            onClick={() => navigate(-1)}
            style={{
              borderRadius: '12px',
              height: '44px',
              fontSize: '15px',
              fontWeight: '500',
              background: '#FFFFFF',
              color: '#1A1A1A',
              border: '1px solid #E0E0E0'
            }}
          >
        返回上一页
      </Button>
        </div>
      </div>
    </div>
  );
};

export default SellerProfilePage;
