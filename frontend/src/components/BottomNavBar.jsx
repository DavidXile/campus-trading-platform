import React, { useState, useEffect } from 'react';
import { TabBar } from 'antd-mobile';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  AppOutline, 
  MessageOutline,
  UserOutline,
  AddCircleOutline,
  CompassOutline,
  ShopbagOutline
} from 'antd-mobile-icons';

const BottomNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { pathname } = location;

  const setRouteActive = (value) => {
    navigate(value);
  };

  // 中间的发布按钮需要特殊处理，不作为普通 Tab
  const tabs = [
    {
      key: '/',
      title: t('common.home'),
      icon: <AppOutline />,
    },
    {
      key: '/errand/publish',
      title: t('common.errand'),
      icon: <CompassOutline />,
    },
    {
      key: '/publish-entry',
      title: t('common.publish'),
      icon: <AddCircleOutline />,
      className: 'publish-tab',
    },
    {
      key: '/chat',
      title: t('common.messages'),
      icon: <MessageOutline />,
    },
    {
      key: '/profile',
      title: t('common.my'),
      icon: <UserOutline />,
    },
  ];

  // 如果当前路径不在tabs里，可能需要高亮某个默认或者不显示高亮
  // 简单的逻辑：匹配前缀或者精确匹配
  const activeKey = tabs.find(tab => tab.key !== '/publish-entry' && pathname === tab.key)?.key || '/';

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 0, 
      width: '100%', 
      backgroundColor: '#FFFFFF',
      zIndex: 1000
    }}>
      <TabBar 
        activeKey={activeKey} 
        onChange={value => {
          if (value === '/publish-entry') {
             navigate('/publish');
          } else {
             setRouteActive(value);
          }
        }}
      >
        {tabs.map(item => {
          const isActive = activeKey === item.key;
          return (
            <TabBar.Item 
              key={item.key} 
              icon={item.icon}
              title={item.title}
            />
          );
        })}
      </TabBar>
    </div>
  );
};

export default BottomNavBar;


