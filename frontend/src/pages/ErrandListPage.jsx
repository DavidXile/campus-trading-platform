import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SearchBar,
  PullToRefresh,
  InfiniteScroll,
  Loading,
  ErrorBlock,
  Empty,
  Button,
  Tabs
} from 'antd-mobile';
import api from '../services/api';
import useUserStore from '../store/userStore';
import ErrandCard from '../components/ErrandCard';

const ErrandListPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useUserStore();

  const [errands, setErrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const pageSize = 12;

  // 获取跑腿任务列表
  const fetchErrands = async (pageNum = 1, search = '', status = 'pending', isLoadMore = false) => {
    try {
      if (!isLoadMore) setLoading(true);
      const params = new URLSearchParams({
        page: pageNum,
        limit: pageSize,
        status: status
      });

      if (search) {
        params.append('search', search);
      }

      const response = await api.get(`/errands?${params}`);

      if (response.data.success) {
        const newErrands = response.data.errands;
        const totalPages = response.data.pagination.pages;

        if (isLoadMore) {
          setErrands(prev => [...prev, ...newErrands]);
        } else {
          setErrands(newErrands);
        }

        setHasMore(pageNum < totalPages);
        setPage(pageNum);
        setError(null);
      }
    } catch (err) {
      console.error('获取跑腿任务列表失败:', err);
      setError('获取跑腿任务列表失败，请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchErrands();
  }, []);

  // 状态筛选变化时重新加载
  useEffect(() => {
    fetchErrands(1, searchText, statusFilter);
  }, [statusFilter]);

  // 处理搜索
  const handleSearch = (value) => {
    setSearchText(value);
    fetchErrands(1, value, statusFilter);
  };

  // 处理状态筛选
  const handleStatusChange = (status) => {
    setStatusFilter(status);
  };

  // 处理下拉刷新
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchErrands(1, searchText, statusFilter);
  };

  // 处理加载更多
  const loadMore = async () => {
    if (!hasMore || loading) return;
    await fetchErrands(page + 1, searchText, statusFilter, true);
  };

  // 状态选项
  const statusOptions = [
    { key: 'pending', label: '待接单', icon: '⏳' },
    { key: 'all', label: '全部', icon: '📋' },
    { key: 'accepted', label: '已接单', icon: '✅' },
    { key: 'completed', label: '已完成', icon: '🎉' }
  ];

  // 渲染内容
  const renderContent = () => {
    if (error) {
      return (
        <div style={{ padding: '40px 20px' }}>
          <ErrorBlock status='default' title={error} />
        </div>
      );
    }

    if (errands.length === 0 && !loading) {
      return (
        <div style={{ 
          padding: '60px 20px', 
          textAlign: 'center',
          background: '#FFFFFF',
          borderRadius: '16px',
          margin: '12px'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.3 }}>🏃</div>
          <div style={{ 
            fontSize: '16px', 
            color: '#999999',
            marginBottom: '8px',
            fontWeight: '500'
          }}>
            {searchText ? `没有找到包含"${searchText}"的跑腿任务` : '暂无跑腿任务'}
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: '#CCCCCC'
          }}>
            快去发布第一个跑腿任务吧
          </div>
        </div>
      );
    }

    return (
      <>
        <div style={{ padding: '12px' }}>
          {errands.map(errand => (
            <ErrandCard key={errand.id} errand={errand} />
          ))}
        </div>
        <InfiniteScroll
          loadMore={loadMore}
          hasMore={hasMore}
          threshold={50}
        >
          {loading && errands.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '24px',
              background: '#FFFFFF',
              borderRadius: '12px',
              margin: '12px'
            }}>
              <Loading />
              <span style={{ 
                marginLeft: '12px', 
                color: '#999999',
                fontSize: '14px'
              }}>
                加载中...
              </span>
            </div>
          )}
        </InfiniteScroll>
      </>
    );
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#F5F5F5',
      paddingBottom: '80px'
    }}>
      {/* Tab切换 */}
      <div style={{ 
        background: '#FFFFFF', 
        borderBottom: '1px solid #F0F0F0',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <Tabs 
          activeKey={statusFilter} 
          onChange={handleStatusChange}
          style={{
            '--title-font-size': '16px',
            '--active-title-color': '#00D4AA',
            '--inactive-title-color': '#666666',
            '--active-line-height': '3px',
            '--fixed-active-line-width': '30px',
            fontWeight: '600'
          }}
        >
          {statusOptions.map(option => (
            <Tabs.Tab 
              key={option.key} 
              title={option.label} 
            />
          ))}
        </Tabs>
      </div>

      {/* 搜索栏 */}
      <div style={{ 
        padding: '16px 12px', 
        background: '#FFFFFF',
        borderBottom: '1px solid #F0F0F0'
      }}>
        <SearchBar
          placeholder="搜索跑腿任务..." 
          value={searchText}
          onChange={setSearchText}
          onSearch={handleSearch}
          onClear={() => handleSearch('')}
          style={{
            '--background': '#F2F3F5',
            '--border-radius': '12px',
            '--height': '44px',
            '--padding-left': '14px',
            '--font-size': '15px'
          }}
        />
      </div>

      {/* 发布按钮 */}
      {isAuthenticated && (
        <div style={{ 
          padding: '12px',
          background: '#FFFFFF',
          borderBottom: '1px solid #F0F0F0'
        }}>
          <Button
            block
            color='primary'
            onClick={() => navigate('/errand/publish')}
            style={{
              borderRadius: '12px',
              height: '44px',
              fontSize: '16px',
              fontWeight: '600',
              background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
              border: 'none',
              boxShadow: '0 4px 16px rgba(0, 212, 170, 0.3)'
            }}
          >
            ➕ 发布跑腿任务
          </Button>
        </div>
      )}

      {/* 下拉刷新容器 */}
      <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
        {loading && errands.length === 0 ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px'
          }}>
            <Loading />
          </div>
        ) : (
          renderContent()
        )}
      </PullToRefresh>
    </div>
  );
};

export default ErrandListPage;
