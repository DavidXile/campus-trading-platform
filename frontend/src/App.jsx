import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import useUserStore from './store/userStore';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import CompleteProfileModal from './components/CompleteProfileModal';
import BottomNavBar from './components/BottomNavBar';

// 页面组件
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ItemDetailPage from './pages/ItemDetailPage';
import PublishPage from './pages/PublishPage';
import EditItemPage from './pages/EditItemPage';
import Profile from './pages/Profile';
import ErrandListPage from './pages/ErrandListPage';
import ErrandDetailPage from './pages/ErrandDetailPage';
import PublishErrandPage from './pages/PublishErrandPage';
import MyErrandsPage from './pages/MyErrandsPage';
import ChatListPage from './pages/ChatListPage';
import ChatDetailPage from './pages/ChatDetailPage';
import SellerProfilePage from './pages/SellerProfilePage';
import CreateDisputePage from './pages/CreateDisputePage';
import DisputeDetailPage from './pages/DisputeDetailPage';
import WalletPage from './pages/WalletPage';

// 管理后台页面
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminItems from './pages/admin/AdminItems';
import AdminDisputes from './pages/admin/AdminDisputes';

import './App.css';
import api from './services/api';
import { connectSocket } from './services/socket';
import './i18n'; // 初始化 i18n
import LanguageSwitcher from './components/LanguageSwitcher';
import { Toast } from 'antd-mobile';

const AppContent = () => {
  const { initialize, isAuthenticated, user, token, updateUser } = useUserStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const isProfileComplete = Boolean(user?.phone && user?.college);
  const requiresProfileCompletion = Boolean(isAuthenticated && user && !isProfileComplete);
  const location = useLocation();

  // 判断是否显示底部导航栏
  const showBottomNav = !location.pathname.startsWith('/admin') && 
                        !['/login', '/register', '/forgot-password'].includes(location.pathname);

  // 在非登录/注册页面显示语言切换器（后台也显示）
  const showLanguageSwitcher = !['/login', '/register', '/forgot-password'].includes(location.pathname);

  // 应用启动时初始化用户状态
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 获取未读消息数 (逻辑保持不变)
  useEffect(() => {
    if (isAuthenticated) {
      const fetchUnreadCount = async () => {
        try {
          const response = await api.get('/chat/unread-count');
          if (response.data.success) {
            setUnreadCount(response.data.unread_count);
          }
        } catch (err) {
          console.error('获取未读消息数失败:', err);
        }
      };

      fetchUnreadCount();

      const handleRefresh = () => {
        fetchUnreadCount();
      };
      window.addEventListener('refreshUnreadCount', handleRefresh);

      if (token) {
        const socket = connectSocket(token);
        
        socket.on('new_message_notification', (data) => {
          setUnreadCount(data.unread_count);
        });

        // 监听纠纷通知
        socket.on('dispute_notification', (data) => {
          console.log('收到纠纷通知:', data);
          const { type, dispute } = data;
          
          let message = '';
          switch (type) {
            case 'new_dispute':
              message = `您有一个新的纠纷需要响应：${dispute.item_title}`;
              break;
            case 'dispute_responded':
              message = `您的纠纷已收到响应：${dispute.item_title}`;
              break;
            case 'dispute_pending_review':
              message = `有新的纠纷等待审核：${dispute.item_title}`;
              break;
            case 'dispute_reviewed':
              message = `您的纠纷审核已完成：${dispute.item_title}`;
              // 刷新用户信息（信用分可能已更新）
              api.get('/users/me').then(res => {
                if (res.data.success && res.data.user) {
                  updateUser(res.data.user);
                }
              }).catch(err => console.error('刷新用户信息失败:', err));
              break;
            case 'dispute_appealed':
              message = `有新的申诉等待审核：${dispute.item_title}`;
              break;
            case 'appeal_reviewed':
              message = `您的申诉审核已完成：${dispute.item_title}`;
              // 刷新用户信息（信用分可能已更新）
              api.get('/users/me').then(res => {
                if (res.data.success && res.data.user) {
                  updateUser(res.data.user);
                }
              }).catch(err => console.error('刷新用户信息失败:', err));
              break;
            default:
              message = `您有新的纠纷通知：${dispute.item_title}`;
          }
          
          // 显示通知（使用Toast）
          Toast.show({
            icon: 'success',
            content: message,
            duration: 3000
          });

          // 触发刷新纠纷列表（如果用户在相关页面）
          window.dispatchEvent(new CustomEvent('refreshDisputes'));
        });

        return () => {
          socket.off('new_message_notification');
          socket.off('dispute_notification');
          window.removeEventListener('refreshUnreadCount', handleRefresh);
        };
      } else {
        return () => {
          window.removeEventListener('refreshUnreadCount', handleRefresh);
        };
      }
    } else {
      setUnreadCount(0);
    }
  }, [isAuthenticated, token]);

  return (
    <div className="App">
      {/* 语言切换器 - 显示在右上角 */}
      {showLanguageSwitcher && (
        <div style={{ 
          position: 'fixed', 
          top: '16px', 
          right: '16px', 
          zIndex: 1000,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '8px',
          padding: '4px 8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <LanguageSwitcher />
        </div>
      )}
      
      <main className="app-main" style={{ paddingBottom: showBottomNav ? '60px' : '0' }}>
        <Routes>
          {/* 公开路由 */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/item/:id" element={<ItemDetailPage />} />
          <Route path="/seller/:id" element={<SellerProfilePage />} />
          <Route path="/errands" element={<ErrandListPage />} />
          <Route path="/errand/:id" element={<ErrandDetailPage />} />
          {/* 保护路由 - 需要登录 */}
          <Route
            path="/publish"
            element={
              <ProtectedRoute>
                <PublishPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <ProtectedRoute>
                <EditItemPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wallet"
            element={
              <ProtectedRoute>
                <WalletPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/errand/publish"
            element={
              <ProtectedRoute>
                <PublishErrandPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/errand/my"
            element={
              <ProtectedRoute>
                <MyErrandsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:id"
            element={
              <ProtectedRoute>
                <ChatDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dispute/create/:itemId"
            element={
              <ProtectedRoute>
                <CreateDisputePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dispute/:id"
            element={
              <ProtectedRoute>
                <DisputeDetailPage />
              </ProtectedRoute>
            }
          />
          {/* 管理后台路由 */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminProtectedRoute>
                <AdminDashboard />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminProtectedRoute>
                <AdminUsers />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/items"
            element={
              <AdminProtectedRoute>
                <AdminItems />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/disputes"
            element={
              <AdminProtectedRoute>
                <AdminDisputes />
              </AdminProtectedRoute>
            }
          />
        </Routes>
      </main>

      {showBottomNav && <BottomNavBar />}

      {requiresProfileCompletion && (
        <CompleteProfileModal
          visible={requiresProfileCompletion}
          user={user}
          forceComplete
          onSuccess={updateUser}
        />
      )}
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
