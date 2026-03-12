import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SearchBar,
  Grid,
  PullToRefresh,
  InfiniteScroll,
  Loading,
  Empty,
  Tabs
} from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import ItemCard from '../components/ItemCard';
import ErrandCard from '../components/ErrandCard';
import api from '../services/api';
import useUserStore from '../store/userStore';

const HomePage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated } = useUserStore();
  
  const [activeTab, setActiveTab] = useState('items');
  const [searchText, setSearchText] = useState('');
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsHasMore, setItemsHasMore] = useState(true);
  const [itemsPage, setItemsPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');

  const [errands, setErrands] = useState([]);
  const [errandsLoading, setErrandsLoading] = useState(false);
  const [errandsHasMore, setErrandsHasMore] = useState(true);
  const [errandsPage, setErrandsPage] = useState(1);

  const [refreshing, setRefreshing] = useState(false);
  const pageSize = 10;

  // 分类定义 - 使用emoji图标
  const categories = [
    { title: t('home.categoryElectronics'), value: '电子产品', icon: '💻' },
    { title: t('home.categoryBooks'), value: '书籍教材', icon: '📚' },
    { title: t('home.categoryClothing'), value: '服装鞋帽', icon: '👕' },
    { title: t('home.categoryDaily'), value: '生活用品', icon: '🏠' },
    { title: t('home.categorySports'), value: '运动健身', icon: '⚽' },
    { title: t('home.categoryBeauty'), value: '美妆护肤', icon: '💄' },
    { title: t('home.categoryOther'), value: '其他', icon: '📦' },
  ];

  const fetchItems = async (pageNum = 1, search = '', category = '', isLoadMore = false) => {
    if (!isLoadMore) setItemsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum,
        limit: pageSize
      });
      if (search) params.append('search', search);
      if (category) params.append('category', category);

      const response = await api.get(`/items?${params}`);
      if (response.data.success) {
        const newItems = response.data.items;
        const totalPages = response.data.pagination.pages;
        
        if (isLoadMore) {
          setItems(prev => [...prev, ...newItems]);
        } else {
          setItems(newItems);
        }
        setItemsHasMore(pageNum < totalPages);
        setItemsPage(pageNum);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setItemsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchErrands = async (pageNum = 1, search = '', isLoadMore = false) => {
    if (!isLoadMore) setErrandsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum,
        limit: pageSize,
        status: 'pending'
      });
      if (search) params.append('search', search);

      const response = await api.get(`/errands?${params}`);
      if (response.data.success) {
        const newErrands = response.data.errands;
        const totalPages = response.data.pagination.pages;

        if (isLoadMore) {
          setErrands(prev => [...prev, ...newErrands]);
        } else {
          setErrands(newErrands);
        }
        setErrandsHasMore(pageNum < totalPages);
        setErrandsPage(pageNum);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setErrandsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'items') {
      fetchItems(1, searchText, selectedCategory);
    } else {
      if (errands.length === 0) {
        fetchErrands(1, searchText);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedCategory]);

  const handleSearch = (val) => {
    setSearchText(val);
    if (activeTab === 'items') {
      fetchItems(1, val, selectedCategory);
    } else {
      fetchErrands(1, val);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'items') {
      await fetchItems(1, searchText, selectedCategory);
    } else {
      await fetchErrands(1, searchText);
    }
  };

  const loadMore = async () => {
    if (activeTab === 'items') {
      if (!itemsHasMore || itemsLoading) return;
      await fetchItems(itemsPage + 1, searchText, selectedCategory, true);
    } else {
      if (!errandsHasMore || errandsLoading) return;
      await fetchErrands(errandsPage + 1, searchText, true);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', paddingBottom: '80px' }}>
      {/* Tab切换 - 青色主题 */}
      <div style={{ 
        background: '#FFFFFF', 
        borderBottom: '1px solid #F0F0F0',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)'
      }}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          style={{
            '--title-font-size': '17px',
            '--active-title-color': '#00D4AA',
            '--inactive-title-color': '#666666',
            '--active-line-height': '3px',
            '--fixed-active-line-width': '32px',
            fontWeight: '600',
            '--active-line-border-radius': '2px'
          }}
        >
          <Tabs.Tab title={t('home.itemsTab')} key='items' />
          <Tabs.Tab title={t('home.errandsTab')} key='errands' />
        </Tabs>
      </div>

      {/* Banner区域 - 只在闲置tab显示 */}
      {activeTab === 'items' && (
        <div style={{ 
          padding: '16px 12px', 
          background: '#F5F5F5'
        }}>
          <div style={{ 
            height: '120px', 
            background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 16px rgba(0, 212, 170, 0.25)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* 背景装饰 */}
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
              borderRadius: '50%',
              transform: 'translate(30px, -30px)'
            }} />
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '80px',
              height: '80px',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
              borderRadius: '50%',
              transform: 'translate(-20px, 20px)'
            }} />
            
            <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
              <div style={{ 
                color: '#fff', 
                fontSize: '20px', 
                fontWeight: '700', 
                marginBottom: '8px',
                textShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {t('home.bannerTitle')}
              </div>
              <div style={{ 
                color: 'rgba(255,255,255,0.95)', 
                fontSize: '14px',
                lineHeight: '1.4'
              }}>
                {t('home.bannerSubtitle')}
              </div>
            </div>
            <div style={{ 
              fontSize: '56px', 
              opacity: 0.9,
              position: 'relative',
              zIndex: 1,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
            }}>
              🎉
            </div>
          </div>
        </div>
      )}

      {/* 搜索栏 - 优化样式 */}
      <div style={{ 
        padding: '16px 12px', 
        background: '#FFFFFF',
        borderBottom: '1px solid #F0F0F0'
      }}>
        <SearchBar
          placeholder={t('home.searchPlaceholder')} 
          value={searchText}
          onChange={setSearchText}
          onSearch={handleSearch}
          onClear={() => handleSearch('')}
          style={{
            '--background': '#F2F3F5',
            '--border-radius': '12px',
            '--height': '44px',
            '--padding-left': '14px',
            '--font-size': '15px',
            '--placeholder-color': '#999999'
          }}
        />
      </div>

      {/* 分类筛选 - 磨砂玻璃风格，emoji图标 */}
      {activeTab === 'items' && (
        <div style={{ 
          padding: '20px 12px', 
          background: '#FFFFFF',
          borderBottom: '1px solid #F0F0F0',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px 12px'
        }}>
          <div
            onClick={() => setSelectedCategory('')}
            onMouseEnter={(e) => {
              if (selectedCategory !== '') {
                e.currentTarget.querySelector('div').style.transform = 'scale(1.08)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedCategory !== '') {
                e.currentTarget.querySelector('div').style.transform = 'scale(1)';
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              padding: '8px 4px'
            }}
          >
            <div style={{ 
              width: '56px', 
              height: '56px', 
              background: selectedCategory === '' 
                ? 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)' 
                : 'linear-gradient(135deg, rgba(0, 212, 170, 0.08) 0%, rgba(0, 184, 148, 0.08) 100%)',
              borderRadius: '16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '28px',
              boxShadow: selectedCategory === '' 
                ? '0 4px 16px rgba(0, 212, 170, 0.35)' 
                : '0 2px 8px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: selectedCategory === '' ? 'scale(1.1)' : 'scale(1)',
              border: selectedCategory === '' ? 'none' : '1px solid rgba(0, 212, 170, 0.15)'
            }}>
              🔍
            </div>
            <span style={{ 
              fontSize: '12px', 
              color: selectedCategory === '' ? '#00D4AA' : '#666666',
              fontWeight: selectedCategory === '' ? '600' : '400',
              transition: 'all 0.3s ease'
            }}>
              {t('home.all')}
            </span>
          </div>
          {categories.map((cat) => (
            <div
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              onMouseEnter={(e) => {
                if (selectedCategory !== cat.value) {
                  e.currentTarget.querySelector('div').style.transform = 'scale(1.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedCategory !== cat.value) {
                  e.currentTarget.querySelector('div').style.transform = 'scale(1)';
                }
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '8px 4px'
              }}
            >
              <div style={{ 
                width: '56px', 
                height: '56px', 
                background: selectedCategory === cat.value 
                  ? 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)' 
                  : 'linear-gradient(135deg, rgba(0, 212, 170, 0.08) 0%, rgba(0, 184, 148, 0.08) 100%)',
                borderRadius: '16px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '28px',
                boxShadow: selectedCategory === cat.value 
                  ? '0 4px 16px rgba(0, 212, 170, 0.35)' 
                  : '0 2px 8px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: selectedCategory === cat.value ? 'scale(1.1)' : 'scale(1)',
                border: selectedCategory === cat.value ? 'none' : '1px solid rgba(0, 212, 170, 0.15)'
              }}>
                {cat.icon}
              </div>
              <span style={{ 
                fontSize: '12px', 
                color: selectedCategory === cat.value ? '#00D4AA' : '#666666',
                fontWeight: selectedCategory === cat.value ? '600' : '400',
                textAlign: 'center',
                transition: 'all 0.3s ease'
              }}>
                {cat.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 内容列表 */}
      <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
        <div style={{ padding: '12px' }}>
          {activeTab === 'items' ? (
            items.length > 0 ? (
              <Grid columns={2} gap={12}>
                {items.map((item) => (
                  <Grid.Item key={item.id}>
                    <ItemCard item={item} />
                  </Grid.Item>
                ))}
              </Grid>
            ) : (
              !itemsLoading && (
                <div style={{ 
                  padding: '60px 20px', 
                  textAlign: 'center',
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  margin: '12px'
                }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.3 }}>📦</div>
                  <div style={{ 
                    fontSize: '16px', 
                    color: '#999999',
                    marginBottom: '8px',
                    fontWeight: '500'
                  }}>
                    {t('home.noItems')}
                  </div>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#CCCCCC'
                  }}>
                    {t('home.publishFirstItem')}
                  </div>
                </div>
              )
            )
          ) : (
            errands.length > 0 ? (
              <div>
                {errands.map(errand => (
                  <ErrandCard key={errand.id} errand={errand} />
                ))}
              </div>
            ) : (
              !errandsLoading && (
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
                    {t('home.noErrands')}
                  </div>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#CCCCCC'
                  }}>
                    {t('home.publishFirstErrand')}
                  </div>
                </div>
              )
            )
          )}

          <InfiniteScroll
            loadMore={loadMore}
            hasMore={activeTab === 'items' ? itemsHasMore : errandsHasMore}
            threshold={50}
          >
            {(itemsLoading || errandsLoading) && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
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
                  {t('common.loading')}
                </span>
              </div>
            )}
          </InfiniteScroll>
        </div>
      </PullToRefresh>
    </div>
  );
};

export default HomePage;
