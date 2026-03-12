import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  List,
  Button,
  Tag,
  Loading,
  ErrorBlock,
  Toast,
  Tabs
} from 'antd-mobile';
import api from '../services/api';
import useUserStore from '../store/userStore';

const MyErrandsPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useUserStore();

  const [errands, setErrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchErrands();
  }, [isAuthenticated, navigate, activeTab]);

  const fetchErrands = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (activeTab === 'published') {
        params.append('type', 'published');
      } else if (activeTab === 'accepted') {
        params.append('type', 'accepted');
      }

      const response = await api.get(`/errands/user/my-errands?${params}`);
      if (response.data.success) {
        setErrands(response.data.errands);
      }
    } catch (err) {
      console.error('获取我的跑腿任务失败:', err);
      setError('获取我的跑腿任务失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'primary',
      accepted: 'success',
      completed: 'default',
      cancelled: 'danger'
    };
    return colors[status] || 'default';
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

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <ErrorBlock status='default' title={error} />
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
        <Button
          size='small'
          color={activeTab === 'all' ? 'primary' : 'default'}
          onClick={() => setActiveTab('all')}
        >
          全部
        </Button>
        <Button
          size='small'
          color={activeTab === 'published' ? 'primary' : 'default'}
          onClick={() => setActiveTab('published')}
        >
          我发布的
        </Button>
        <Button
          size='small'
          color={activeTab === 'accepted' ? 'primary' : 'default'}
          onClick={() => setActiveTab('accepted')}
        >
          我接单的
        </Button>
        <Button
          size='small'
          color='primary'
          onClick={() => navigate('/errand/publish')}
        >
          发布任务
        </Button>
      </div>

      <h2 style={{ marginBottom: '16px' }}>我的跑腿任务</h2>

      {errands.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            暂无跑腿任务
          </div>
        </Card>
      ) : (
        <List>
          {errands.map((errand) => (
            <List.Item
              key={errand.id}
              onClick={() => navigate(`/errand/${errand.id}`)}
              extra={
                <Tag color={getStatusColor(errand.status)}>
                  {getStatusText(errand.status)}
                </Tag>
              }
            >
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {errand.title}
                </div>
                <div style={{ fontSize: '14px', color: '#1677ff', marginBottom: '4px' }}>
                  ¥{errand.reward}
                </div>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
                  📍 {errand.location}
                  {errand.destination && ` → ${errand.destination}`}
                </div>
                {errand.accepter_name && (
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
                    接单者: {errand.accepter_name}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#999' }}>
                  {new Date(errand.created_at).toLocaleString()}
                </div>
              </div>
            </List.Item>
          ))}
        </List>
      )}
    </div>
  );
};

export default MyErrandsPage;






