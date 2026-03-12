import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Space,
  Toast
} from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import useUserStore from '../store/userStore';
import LanguageSwitcher from '../components/LanguageSwitcher';
import PasswordInput from '../components/PasswordInput';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useUserStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await api.post('/users/login', values);

      if (response.data.success) {
        const { token, user } = response.data;

        // 调用 userStore 的 login 方法
        login(token, user);

        Toast.show({
          icon: 'success',
          content: t('login.loginSuccess'),
          duration: 1500,
        });

        // 延迟跳转，让用户看到成功消息
        setTimeout(() => {
          navigate('/');
        }, 1500);
      }
    } catch (error) {
      console.error('登录失败:', error);
      const errorMessage = error.response?.data?.message || t('login.loginFailed');
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
      background: 'linear-gradient(180deg, #F5F5F5 0%, #FFFFFF 100%)',
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* 语言切换器 */}
      <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
        <LanguageSwitcher />
      </div>
      
      {/* Logo区域 */}
      <div style={{ 
        width: '80px', 
        height: '80px', 
        borderRadius: '20px',
        background: 'linear-gradient(135deg, #00D4AA 0%, #FF6B35 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '24px',
        boxShadow: '0 8px 24px rgba(0, 212, 170, 0.3)'
      }}>
        <span style={{ fontSize: '40px' }}>🏷️</span>
      </div>

      <Card style={{ 
        width: '100%', 
        maxWidth: '400px',
        backgroundColor: '#FFFFFF',
        border: 'none',
        borderRadius: '20px',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{ 
          textAlign: 'center', 
          marginBottom: '24px',
          color: '#1A1A1A',
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          {t('login.title')}
        </h2>

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
            >
              {t('login.loginButton')}
            </Button>
          }
        >
          <Form.Item
            label={<span style={{ color: '#1A1A1A' }}>{t('login.email')}</span>}
            name='email'
            rules={[
              { required: true, message: t('login.emailRequired') },
              { type: 'email', message: t('login.emailRequired') }
            ]}
          >
            <Input 
              placeholder={t('login.emailPlaceholder')} 
              style={{ backgroundColor: '#F5F5F5', color: '#1A1A1A' }} 
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: '#1A1A1A' }}>{t('login.password')}</span>}
            name='password'
            rules={[
              { required: true, message: t('login.passwordRequired') }
            ]}
          >
            <PasswordInput
              placeholder={t('login.passwordPlaceholder')}
              style={{ backgroundColor: '#F5F5F5', color: '#1A1A1A' }}
            />
          </Form.Item>
        </Form>

        <Space direction='vertical' justify='center' style={{ width: '100%', marginTop: '24px', gap: '12px' }}>
          <Space justify='center' style={{ width: '100%' }}>
            <span style={{ color: '#666666' }}>{t('login.noAccount')}</span>
          <Link to='/register' style={{ color: 'var(--xy-primary)' }}>
              {t('login.registerLink')}
            </Link>
          </Space>
          <Link to='/forgot-password' style={{ color: 'var(--xy-primary)', fontSize: '14px' }}>
            {t('login.forgotPassword')}
          </Link>
        </Space>

        <Space
          direction='vertical'
          style={{ width: '100%', marginTop: '24px' }}
        >
          <div style={{ textAlign: 'center', color: '#666666' }}>
            {t('admin.login')}
          </div>
          <Button
            block
            color='warning'
            size='large'
            onClick={() => navigate('/admin/login')}
          >
            {t('admin.login')}
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;








