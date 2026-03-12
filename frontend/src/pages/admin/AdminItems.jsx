import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  List,
  SearchBar,
  Selector,
  Button,
  Toast,
  Loading,
  ErrorBlock,
  InfiniteScroll,
  Dialog,
  Tag
} from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import useUserStore from '../../store/userStore';

const AdminItems = () => {
  const navigate = useNavigate();
  const { user, logout } = useUserStore();
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin/login');
      return;
    }
    fetchItems();
  }, [user, navigate]);

  const fetchItems = async (pageNum = 1, search = '', status = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum,
        limit: 20
      });
      if (search) {
        params.append('search', search);
      }
      if (status) {
        params.append('status', status);
      }

      const response = await api.get(`/admin/items?${params}`);
      if (response.data.success) {
        if (pageNum === 1) {
          setItems(response.data.items);
        } else {
          setItems(prev => [...prev, ...response.data.items]);
        }
        setPagination(response.data.pagination);
        setHasMore(pageNum < response.data.pagination.pages);
        setPage(pageNum);
      }
    } catch (err) {
      console.error('获取商品列表失败:', err);
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

  const handleSearch = (value) => {
    setSearchText(value);
    fetchItems(1, value, statusFilter);
  };

  const handleStatusFilter = (value) => {
    setStatusFilter(value);
    fetchItems(1, searchText, value);
  };

  const handleDeleteItem = async (itemId) => {
    Dialog.confirm({
      content: t('adminItems.deleteConfirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        try {
          await api.delete(`/admin/items/${itemId}`);
          Toast.show({
            icon: 'success',
            content: t('adminItems.deleteSuccess'),
          });
          fetchItems(page, searchText, statusFilter);
        } catch (err) {
          console.error('删除商品失败:', err);
          Toast.show({
            icon: 'fail',
            content: err.response?.data?.message || t('adminItems.deleteFailed'),
          });
        }
      },
    });
  };

  const loadMore = async () => {
    if (!hasMore || loading) return;
    await fetchItems(page + 1, searchText, statusFilter);
  };

  if (loading && items.length === 0) {
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
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{ 
            margin: 0, 
            color: '#FFFFFF',
            fontSize: '24px',
            fontWeight: '700'
          }}>
            {t('adminItems.title')}
          </h1>
          <Button
            onClick={() => navigate('/admin/dashboard')}
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
            ← {t('adminItems.back')}
          </Button>
        </div>
      </div>

      {/* 内容区域 */}
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '20px'
      }}>
        {/* 搜索和筛选 */}
        <div style={{ 
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <SearchBar
              placeholder={t('adminItems.searchPlaceholder')}
              value={searchText}
              onChange={setSearchText}
              onSearch={handleSearch}
              onClear={() => handleSearch('')}
              style={{
                '--background': '#FFFFFF',
                '--border-radius': '12px',
                '--height': '44px'
              }}
            />
          </div>
          <Selector
            options={[
              { label: t('adminItems.statusAll'), value: '' },
              { label: t('adminItems.statusAvailable'), value: 'available' },
              { label: t('adminItems.statusSold'), value: 'sold' }
            ]}
            value={[statusFilter]}
            onChange={(val) => handleStatusFilter(val[0])}
            style={{
              '--checked-background': '#00D4AA',
              '--checked-color': '#FFFFFF',
              '--border-radius': '12px'
            }}
          />
        </div>

        {/* 商品列表 */}
        <Card style={{
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          border: 'none',
          padding: '0'
        }}>
          <List style={{ '--border-inner': '1px solid #F0F0F0' }}>
            {items.map((item) => (
              <List.Item
                key={item.id}
                style={{
                  padding: '16px',
                  background: '#FFFFFF'
                }}
                extra={
                  <Button
                    size='small'
                    color='danger'
                    onClick={() => handleDeleteItem(item.id)}
                    style={{
                      borderRadius: '8px',
                      fontSize: '13px'
                    }}
                  >
                    删除
                  </Button>
                }
              >
                <div>
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ 
                      fontWeight: '600', 
                      fontSize: '16px',
                      color: '#1A1A1A'
                    }}>
                      {item.title}
                    </div>
                    <Tag 
                      color={item.status === 'available' ? 'success' : 'default'}
                      fill='outline'
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px'
                      }}
                    >
                      {item.status === 'available' ? t('adminItems.statusAvailable') : t('adminItems.statusSold')}
                    </Tag>
                  </div>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#FF6B35',
                    fontWeight: '600',
                    marginBottom: '6px'
                  }}>
                    ¥{item.price}
                  </div>
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#666666',
                    marginBottom: '4px'
                  }}>
                    {item.category || t('adminItems.uncategorized')} | {t('adminItems.seller')}: {item.seller_name}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#999999'
                  }}>
                    {t('adminItems.createdAt')}: {new Date(item.created_at).toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US')}
                  </div>
                </div>
              </List.Item>
            ))}
          </List>

          <InfiniteScroll loadMore={loadMore} hasMore={hasMore} threshold={50}>
            {loading && items.length > 0 && (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <Loading />
              </div>
            )}
          </InfiniteScroll>
        </Card>
      </div>
    </div>
  );
};

export default AdminItems;
