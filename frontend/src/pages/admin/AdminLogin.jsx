import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Toast
} from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import useUserStore from '../../store/userStore';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login } = useUserStore();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await api.post('/users/login', values);

      if (response.data.success) {
        const { token, user } = response.data;

        // 检查是否为管理员
        if (user.role !== 'admin') {
          Toast.show({
            icon: 'fail',
            content: t('adminLogin.noPermission'),
          });
          return;
        }

        // 保存登录信息
        login(token, user);

        Toast.show({
          icon: 'success',
          content: t('adminLogin.loginSuccess'),
          duration: 2000,
        });

        // 跳转到管理后台
        setTimeout(() => {
          navigate('/admin/dashboard');
        }, 1000);
      }
    } catch (error) {
      console.error('登录失败:', error);
      const errorMessage = error.response?.data?.message || t('adminLogin.loginFailed');
      Toast.show({
        icon: 'fail',
        content: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 背景装饰 */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(0, 212, 170, 0.08) 0%, transparent 70%)',
        borderRadius: '50%'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-30%',
        left: '-10%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(0, 212, 170, 0.06) 0%, transparent 70%)',
        borderRadius: '50%'
      }} />

      <div style={{ 
        maxWidth: '420px', 
        width: '100%',
        position: 'relative',
        zIndex: 1
      }}>
        <Card style={{
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          border: 'none',
          padding: '40px 32px',
          background: '#FFFFFF'
        }}>
          {/* Logo/标题区域 */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '32px' 
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 20px',
              background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              boxShadow: '0 4px 16px rgba(0, 212, 170, 0.3)'
            }}>
              🔐
            </div>
            <h2 style={{ 
              fontSize: '24px',
              fontWeight: '700',
              color: '#1A1A1A',
              margin: '0 0 8px 0'
            }}>
              {t('adminLogin.title')}
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#999999',
              margin: 0
            }}>
              {t('adminLogin.subtitle')}
            </p>
          </div>

          <Form
            layout='vertical'
            onFinish={onFinish}
            footer={
              <Button
                block
                type='submit'
                color='primary'
                size='large'
                loading={loading}
                style={{
                  borderRadius: '12px',
                  height: '48px',
                  fontSize: '16px',
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(0, 212, 170, 0.3)',
                  marginTop: '8px'
                }}
              >
                {t('adminLogin.login')}
              </Button>
            }
          >
            <Form.Item
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>{t('adminLogin.email')}</span>}
              name='email'
              rules={[
                { required: true, message: t('adminLogin.emailRequired') },
                { type: 'email', message: t('adminLogin.invalidEmail') }
              ]}
            >
              <Input 
                placeholder={t('adminLogin.emailPlaceholder')}
                style={{
                  '--font-size': '15px',
                  '--background': '#F2F3F5',
                  '--border-radius': '12px',
                  '--border': 'none',
                  '--padding': '12px 16px',
                  '--height': '44px'
                }}
              />
            </Form.Item>

            <Form.Item
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>{t('adminLogin.password')}</span>}
              name='password'
              rules={[
                { required: true, message: t('adminLogin.passwordRequired') }
              ]}
            >
              <Input
                type='password'
                placeholder={t('adminLogin.passwordPlaceholder')}
                style={{
                  '--font-size': '15px',
                  '--background': '#F2F3F5',
                  '--border-radius': '12px',
                  '--border': 'none',
                  '--padding': '12px 16px',
                  '--height': '44px'
                }}
              />
            </Form.Item>
          </Form>

          {/* 返回链接 */}
          <div style={{
            textAlign: 'center',
            marginTop: '24px',
            paddingTop: '24px',
            borderTop: '1px solid #F0F0F0'
          }}>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
              style={{
                fontSize: '14px',
                color: '#00D4AA',
                textDecoration: 'none',
                fontWeight: '500'
              }}
            >
              ← {t('adminLogin.backHome')}
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;






