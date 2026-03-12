import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  NavBar,
  Toast
} from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import PasswordInput from '../components/PasswordInput';

const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await api.post('/users/change-password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword
      });

      if (response.data.success) {
        Toast.show({
          icon: 'success',
          content: t('changePassword.success'),
          duration: 2000,
        });

        setTimeout(() => {
          navigate('/profile');
        }, 2000);
      }
    } catch (error) {
      console.error('修改密码失败:', error);
      const errorMessage = error.response?.data?.message || t('changePassword.failed');
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
      background: '#F5F5F5'
    }}>
      <NavBar 
        onBack={() => navigate(-1)} 
        style={{ 
          background: '#FFFFFF', 
          borderBottom: '1px solid #F0F0F0'
        }}
      >
        <span style={{ fontSize: '17px', fontWeight: '600' }}>
          {t('changePassword.title')}
        </span>
      </NavBar>

      <div style={{ padding: '20px' }}>
        <Card style={{
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          border: 'none',
          padding: '24px'
        }}>
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
                  height: '44px',
                  fontSize: '15px',
                  fontWeight: '600'
                }}
              >
                {t('changePassword.submit')}
              </Button>
            }
          >
            <Form.Item
              label={<span style={{ color: '#1A1A1A' }}>{t('changePassword.oldPassword')}</span>}
              name='oldPassword'
              rules={[
                { required: true, message: t('changePassword.oldPasswordRequired') }
              ]}
            >
              <PasswordInput
                placeholder={t('changePassword.oldPasswordPlaceholder')}
                style={{ backgroundColor: '#F5F5F5', color: '#1A1A1A' }}
              />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: '#1A1A1A' }}>{t('changePassword.newPassword')}</span>}
              name='newPassword'
              rules={[
                { required: true, message: t('changePassword.newPasswordRequired') },
                { min: 6, message: t('changePassword.passwordMinLength') }
              ]}
            >
              <PasswordInput
                placeholder={t('changePassword.newPasswordPlaceholder')}
                style={{ backgroundColor: '#F5F5F5', color: '#1A1A1A' }}
              />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: '#1A1A1A' }}>{t('changePassword.confirmPassword')}</span>}
              name='confirmPassword'
              dependencies={['newPassword']}
              rules={[
                { required: true, message: t('changePassword.confirmPasswordRequired') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t('changePassword.passwordMismatch')));
                  },
                }),
              ]}
            >
              <PasswordInput
                placeholder={t('changePassword.confirmPasswordPlaceholder')}
                style={{ backgroundColor: '#F5F5F5', color: '#1A1A1A' }}
              />
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default ChangePasswordPage;

