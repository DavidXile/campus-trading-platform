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
  Tag,
  Input,
  Popup
} from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import useUserStore from '../../store/userStore';

const AdminUsers = () => {
  const navigate = useNavigate();
  const { user, logout } = useUserStore();
  const { t, i18n } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin/login');
      return;
    }
    fetchUsers();
  }, [user, navigate]);

  const fetchUsers = async (pageNum = 1, search = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum,
        limit: 20
      });
      if (search) {
        params.append('search', search);
      }

      const response = await api.get(`/admin/users?${params}`);
      if (response.data.success) {
        if (pageNum === 1) {
          setUsers(response.data.users);
        } else {
          setUsers(prev => [...prev, ...response.data.users]);
        }
        setPagination(response.data.pagination);
        setHasMore(pageNum < response.data.pagination.pages);
        setPage(pageNum);
      }
    } catch (err) {
      console.error('获取用户列表失败:', err);
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
    fetchUsers(1, value);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      Toast.show({
        icon: 'success',
        content: t('adminUsers.banSuccess'), // reuse success key
      });
      fetchUsers(page, searchText);
    } catch (err) {
      console.error('更新角色失败:', err);
      Toast.show({
        icon: 'fail',
        content: err.response?.data?.message || t('adminCommon.fetchFailed'),
      });
    }
  };

  const handleDeleteUser = async (userId) => {
    Dialog.confirm({
      content: t('adminUsers.deleteConfirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        try {
          await api.delete(`/admin/users/${userId}`);
          Toast.show({
            icon: 'success',
            content: t('adminUsers.deleteSuccess'),
          });
          fetchUsers(page, searchText);
        } catch (err) {
          console.error('删除用户失败:', err);
          Toast.show({
            icon: 'fail',
            content: err.response?.data?.message || t('adminUsers.deleteFailed'),
          });
        }
      },
    });
  };

  const [banDialogVisible, setBanDialogVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [banType, setBanType] = useState('temporary');
  const [banDays, setBanDays] = useState('');

  const handleBanUser = (userId, username) => {
    setSelectedUser({ id: userId, username });
    setBanReason('');
    setBanType('temporary');
    setBanDays('');
    setBanDialogVisible(true);
  };

  const handleBanConfirm = async () => {
    if (!banReason.trim()) {
      Toast.show({ icon: 'fail', content: t('adminUsers.inputReason') });
      return;
    }

    if (banType === 'temporary' && (!banDays || parseInt(banDays) <= 0)) {
      Toast.show({ icon: 'fail', content: t('adminUsers.inputDays') });
      return;
    }

    try {
      await api.post(`/admin/users/${selectedUser.id}/ban`, {
        reason: banReason.trim(),
        ban_type: banType,
        duration_days: banType === 'temporary' ? parseInt(banDays) : null
      });
      Toast.show({
        icon: 'success',
        content: t('adminUsers.banSuccess'),
      });
      setBanDialogVisible(false);
      fetchUsers(page, searchText);
    } catch (err) {
      console.error('封禁用户失败:', err);
      Toast.show({
        icon: 'fail',
        content: err.response?.data?.message || t('adminUsers.banFailed'),
      });
    }
  };

  const handleUnbanUser = async (userId, username) => {
    Dialog.confirm({
      content: t('adminUsers.unbanConfirm', { name: username }),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        try {
          await api.post(`/admin/users/${userId}/unban`);
          Toast.show({
            icon: 'success',
            content: t('adminUsers.unbanSuccess'),
          });
          fetchUsers(page, searchText);
        } catch (err) {
          console.error('解封用户失败:', err);
          Toast.show({
            icon: 'fail',
            content: err.response?.data?.message || t('adminUsers.unbanFailed'),
          });
        }
      },
    });
  };

  const loadMore = async () => {
    if (!hasMore || loading) return;
    await fetchUsers(page + 1, searchText);
  };

  if (loading && users.length === 0) {
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
            用户管理
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
            ← 返回仪表板
          </Button>
        </div>
      </div>

      {/* 内容区域 */}
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '20px'
      }}>
        {/* 搜索栏 */}
        <div style={{ marginBottom: '20px' }}>
          <SearchBar
            placeholder="搜索用户名或邮箱..."
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

        {/* 用户列表 */}
        <Card style={{
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          border: 'none',
          padding: '0'
        }}>
          <List style={{ '--border-inner': '1px solid #F0F0F0' }}>
            {users.map((u) => (
              <List.Item
                key={u.id}
                style={{
                  padding: '16px',
                  background: '#FFFFFF'
                }}
                extra={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Selector
                        options={[
                          { label: '普通用户', value: 'user' },
                          { label: '管理员', value: 'admin' }
                        ]}
                        value={[u.role || 'user']}
                        onChange={(val) => handleRoleChange(u.id, val[0])}
                        style={{ 
                          minWidth: '120px',
                          '--checked-background': '#00D4AA',
                          '--checked-color': '#FFFFFF'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {u.is_banned ? (
                        <Button
                          size='small'
                          color='success'
                          onClick={() => handleUnbanUser(u.id, u.username)}
                          style={{
                            borderRadius: '8px',
                            fontSize: '13px'
                          }}
                        >
                          解封
                        </Button>
                      ) : (
                        <Button
                          size='small'
                          color='warning'
                          onClick={() => handleBanUser(u.id, u.username)}
                          disabled={u.id === user?.id || u.role === 'admin'}
                          style={{
                            borderRadius: '8px',
                            fontSize: '13px'
                          }}
                        >
                          封禁
                        </Button>
                      )}
                      <Button
                        size='small'
                        color='danger'
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={u.id === user?.id}
                        style={{
                          borderRadius: '8px',
                          fontSize: '13px'
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                }
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ 
                      fontWeight: '600', 
                      fontSize: '16px',
                      color: '#1A1A1A'
                    }}>
                      {u.username || '未知用户'}
                    </div>
                    {u.is_banned && (
                      <Tag color='danger' style={{ fontSize: '11px', padding: '2px 8px' }}>
                        已封禁
                      </Tag>
                    )}
                    {u.credit_score !== undefined && (
                      <Tag 
                        color={u.credit_score >= 70 ? 'success' : u.credit_score >= 40 ? 'warning' : 'danger'}
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        信用: {u.credit_score}
                      </Tag>
                    )}
                  </div>
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#666666',
                    marginBottom: '4px'
                  }}>
                    {u.email}
                  </div>
                  {u.is_banned && u.ban_reason && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#FF4444',
                      marginBottom: '4px'
                    }}>
                      封禁原因: {u.ban_reason}
                    </div>
                  )}
                  {u.is_banned && u.ban_expires_at && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#FF8800',
                      marginBottom: '4px'
                    }}>
                      到期时间: {new Date(u.ban_expires_at).toLocaleString('zh-CN')}
                    </div>
                  )}
                  {u.is_banned && !u.ban_expires_at && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#FF4444',
                      marginBottom: '4px'
                    }}>
                      永久封禁
                    </div>
                  )}
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#999999'
                  }}>
                    注册时间: {new Date(u.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              </List.Item>
            ))}
          </List>

          <InfiniteScroll loadMore={loadMore} hasMore={hasMore} threshold={50}>
            {loading && users.length > 0 && (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <Loading />
              </div>
            )}
          </InfiniteScroll>
        </Card>
      </div>

      {/* 封禁对话框 */}
      <Popup
        visible={banDialogVisible}
        onMaskClick={() => setBanDialogVisible(false)}
        bodyStyle={{ padding: '20px' }}
      >
        <div>
          <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            封禁用户
          </div>
          {selectedUser && (
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
              用户：{selectedUser.username}
            </div>
          )}
          
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>封禁原因（必填）</div>
            <Input
              placeholder="请输入封禁原因"
              value={banReason}
              onChange={setBanReason}
              maxLength={200}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>封禁类型</div>
            <Selector
              options={[
                { label: '临时封禁', value: 'temporary' },
                { label: '永久封禁', value: 'permanent' }
              ]}
              value={[banType]}
              onChange={(val) => {
                setBanType(val[0]);
                if (val[0] === 'permanent') {
                  setBanDays('');
                }
              }}
            />
          </div>

          {banType === 'temporary' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', marginBottom: '8px' }}>封禁天数（必填）</div>
              <Input
                type='number'
                placeholder="请输入封禁天数（1-365）"
                value={banDays}
                onChange={setBanDays}
                min={1}
                max={365}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <Button
              block
              onClick={() => setBanDialogVisible(false)}
              style={{ borderRadius: '12px' }}
            >
              取消
            </Button>
            <Button
              block
              color='warning'
              onClick={handleBanConfirm}
              style={{ borderRadius: '12px' }}
            >
              确认封禁
            </Button>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default AdminUsers;
