import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Grid,
  Loading,
  ErrorBlock,
  Button
} from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import useUserStore from '../../store/userStore';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout } = useUserStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 检查是否为管理员
    if (!user || user.role !== 'admin') {
      navigate('/admin/login');
      return;
    }

    fetchStats();
  }, [user, navigate]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/dashboard/stats');
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (err) {
      console.error('获取统计数据失败:', err);
      if (err.response?.status === 403) {
        setError(t('adminCommon.noPermission'));
        logout();
        navigate('/admin/login');
      } else {
        setError(t('adminCommon.fetchFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
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

  const statCards = [
    { 
      title: t('adminDashboard.totalUsers'),
      value: stats?.totalUsers || 0, 
      icon: '👥', 
      color: '#00D4AA',
      bgGradient: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)'
    },
    { 
      title: t('adminDashboard.totalItems'),
      value: stats?.totalItems || 0, 
      icon: '📦', 
      color: '#FF6B35',
      bgGradient: 'linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%)'
    },
    { 
      title: t('adminDashboard.availableItems'),
      value: stats?.availableItems || 0, 
      icon: '🛒', 
      color: '#4A90E2',
      bgGradient: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)'
    },
    { 
      title: t('adminDashboard.soldItems'),
      value: stats?.soldItems || 0, 
      icon: '✅', 
      color: '#F5A623',
      bgGradient: 'linear-gradient(135deg, #F5A623 0%, #E89C1A 100%)'
    },
    { 
      title: t('adminDashboard.recentUsers'),
      value: stats?.recentUsers || 0, 
      icon: '🆕', 
      color: '#9B59B6',
      bgGradient: 'linear-gradient(135deg, #9B59B6 0%, #8E44AD 100%)'
    },
    { 
      title: t('adminDashboard.recentItems'),
      value: stats?.recentItems || 0, 
      icon: '✨', 
      color: '#E91E63',
      bgGradient: 'linear-gradient(135deg, #E91E63 0%, #C2185B 100%)'
    },
    { 
      title: t('adminDashboard.pendingDisputes'),
      value: stats?.pendingDisputes || 0, 
      icon: '⚠️', 
      color: '#FF6B35',
      bgGradient: 'linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%)'
    }
  ];

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#F5F5F5',
      paddingBottom: '20px'
    }}>
      {/* 头部 */}
      <div style={{ 
        background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
        padding: '24px 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div>
            <h1 style={{ 
              margin: 0, 
              color: '#FFFFFF',
              fontSize: '24px',
              fontWeight: '700',
              marginBottom: '4px'
            }}>
              {t('adminCommon.console')}
            </h1>
            <p style={{ 
              margin: 0, 
              color: 'rgba(255,255,255,0.9)',
              fontSize: '14px'
            }}>
              {t('adminCommon.welcome', { name: user?.username || '' })}
            </p>
          </div>
          <Button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '12px',
              padding: '8px 20px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {t('adminCommon.logout')}
          </Button>
        </div>
      </div>

      {/* 内容区域 */}
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '20px'
      }}>
        {/* 导航菜单 */}
        <div style={{ 
          marginBottom: '24px', 
          display: 'flex', 
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <Button
            onClick={() => navigate('/admin/dashboard')}
            style={{
              background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(0, 212, 170, 0.3)'
            }}
          >
            📊 {t('adminDashboard.navDashboard')}
          </Button>
          <Button
            onClick={() => navigate('/admin/users')}
            style={{
              background: '#FFFFFF',
              color: '#1A1A1A',
              border: '1px solid #E0E0E0',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: '500'
            }}
          >
            👥 {t('adminDashboard.navUsers')}
          </Button>
          <Button
            onClick={() => navigate('/admin/items')}
            style={{
              background: '#FFFFFF',
              color: '#1A1A1A',
              border: '1px solid #E0E0E0',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: '500'
            }}
          >
            📦 {t('adminDashboard.navItems')}
          </Button>
          <Button
            onClick={() => navigate('/admin/disputes')}
            style={{
              background: '#FFFFFF',
              color: '#1A1A1A',
              border: '1px solid #E0E0E0',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: '500'
            }}
          >
            ⚠️ {t('adminDashboard.navDisputes')}
          </Button>
        </div>

        {/* 统计卡片 */}
        <Grid columns={2} gap={16}>
          {statCards.map((stat, index) => (
            <Grid.Item key={index}>
              <Card style={{
                borderRadius: '16px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                border: 'none',
                overflow: 'hidden',
                background: '#FFFFFF'
              }}>
                <div style={{ 
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    background: stat.bgGradient,
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    boxShadow: `0 4px 12px ${stat.color}40`,
                    flexShrink: 0
                  }}>
                    {stat.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '14px',
                      color: '#999999',
                      marginBottom: '8px',
                      fontWeight: '500'
                    }}>
                      {stat.title}
                    </div>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: '700',
                      color: stat.color,
                      lineHeight: '1.2'
                    }}>
                      {stat.value}
                    </div>
                  </div>
                </div>
              </Card>
            </Grid.Item>
          ))}
        </Grid>
      </div>
    </div>
  );
};

export default AdminDashboard;
