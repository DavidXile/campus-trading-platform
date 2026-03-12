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
import LanguageSwitcher from '../components/LanguageSwitcher';
import PasswordInput from '../components/PasswordInput';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: 输入邮箱和验证码, 2: 重置密码
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 发送验证码
  const handleSendCode = async () => {
    if (!email) {
      Toast.show({
        icon: 'fail',
        content: t('forgotPassword.emailRequired')
      });
      return;
    }

    // 验证邮箱格式
    const emailRegex = /^[a-zA-Z0-9._%+-]+@student\.must\.edu\.mo$/;
    if (!emailRegex.test(email)) {
      Toast.show({
        icon: 'fail',
        content: t('register.emailPattern')
      });
      return;
    }

    setCodeLoading(true);
    try {
      const response = await api.post('/users/forgot-password/send-code', {
        email
      });

      if (response.data.success) {
        Toast.show({
          icon: 'success',
          content: response.data.message || t('forgotPassword.codeSent'),
          duration: 3000
        });
        setCodeSent(true);
        setCountdown(60);
        
        // 倒计时
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              setCodeSent(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // 开发环境显示验证码
        if (response.data.code) {
          console.log('验证码:', response.data.code);
          Toast.show({
            icon: 'success',
            content: `开发环境验证码: ${response.data.code}`,
            duration: 5000
          });
        }
      }
    } catch (error) {
      console.error('发送验证码失败:', error);
      Toast.show({
        icon: 'fail',
        content: error.response?.data?.message || t('forgotPassword.sendCodeFailed')
      });
    } finally {
      setCodeLoading(false);
    }
  };

  // 验证验证码并进入下一步
  const handleVerifyCode = async () => {
    if (!verificationCode) {
      Toast.show({
        icon: 'fail',
        content: t('forgotPassword.codeRequired')
      });
      return;
    }

    // 这里先验证验证码，如果成功则进入下一步
    // 实际验证会在重置密码时进行
    setStep(2);
  };

  // 重置密码
  const handleResetPassword = async (values) => {
    setLoading(true);
    try {
      const response = await api.post('/users/forgot-password/reset', {
        email,
        verificationCode,
        newPassword: values.newPassword
      });

      if (response.data.success) {
        Toast.show({
          icon: 'success',
          content: t('forgotPassword.success'),
          duration: 2000,
        });

        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (error) {
      console.error('重置密码失败:', error);
      const errorMessage = error.response?.data?.message || t('forgotPassword.failed');
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
        <span style={{ fontSize: '40px' }}>🔐</span>
      </div>

      {/* 标题 */}
      <h1 style={{ 
        color: '#1A1A1A', 
        fontSize: '28px', 
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: '8px',
        lineHeight: '1.2'
      }}>
        {t('forgotPassword.title')}
      </h1>
      <p style={{ 
        color: '#666666', 
        fontSize: '14px', 
        textAlign: 'center',
        marginBottom: '32px'
      }}>
        {step === 1 ? t('forgotPassword.subtitle') : t('forgotPassword.setNewPassword')}
      </p>

      <Card style={{ 
        width: '100%', 
        maxWidth: '400px',
        backgroundColor: '#FFFFFF',
        border: 'none',
        borderRadius: '20px',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        {step === 1 ? (
          <>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                fontSize: '15px', 
                fontWeight: '500', 
                color: '#1A1A1A', 
                marginBottom: '8px' 
              }}>
                {t('forgotPassword.email')}
              </div>
              <Input
                placeholder={t('forgotPassword.emailPlaceholder')}
                value={email}
                onChange={(val) => {
                  setEmail(val);
                  setCodeSent(false);
                  setVerificationCode('');
                }}
                style={{ backgroundColor: '#F5F5F5', color: '#1A1A1A' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                fontSize: '15px', 
                fontWeight: '500', 
                color: '#1A1A1A', 
                marginBottom: '8px' 
              }}>
                {t('forgotPassword.verificationCode')}
              </div>
              <Input
                placeholder={t('forgotPassword.codePlaceholder')}
                value={verificationCode}
                onChange={(val) => setVerificationCode(val)}
                style={{ backgroundColor: '#F5F5F5', color: '#1A1A1A' }}
                maxLength={6}
              />
              <Button
                size='small'
                color='primary'
                fill='outline'
                onClick={handleSendCode}
                loading={codeLoading}
                disabled={codeSent && countdown > 0}
                style={{ 
                  marginTop: '8px',
                  width: '100%'
                }}
              >
                {codeSent && countdown > 0 
                  ? `${t('forgotPassword.resendCode')} (${countdown}s)` 
                  : t('forgotPassword.sendCode')}
              </Button>
            </div>

            <Button
              block
              color='primary'
              size='large'
              onClick={handleVerifyCode}
              disabled={!email || !verificationCode}
              style={{
                borderRadius: '12px',
                height: '44px',
                fontSize: '15px',
                fontWeight: '600',
                marginTop: '24px'
              }}
            >
              {t('forgotPassword.next')}
            </Button>
          </>
        ) : (
          <Form
            layout='vertical'
            onFinish={handleResetPassword}
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
                {t('forgotPassword.reset')}
              </Button>
            }
          >
            <Form.Item
              label={<span style={{ color: '#1A1A1A' }}>{t('forgotPassword.newPassword')}</span>}
              name='newPassword'
              rules={[
                { required: true, message: t('forgotPassword.newPasswordRequired') },
                { min: 6, message: t('forgotPassword.passwordMinLength') }
              ]}
            >
              <PasswordInput
                placeholder={t('forgotPassword.newPasswordPlaceholder')}
                style={{ backgroundColor: '#F5F5F5', color: '#1A1A1A' }}
              />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: '#1A1A1A' }}>{t('forgotPassword.confirmPassword')}</span>}
              name='confirmPassword'
              dependencies={['newPassword']}
              rules={[
                { required: true, message: t('forgotPassword.confirmPasswordRequired') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t('forgotPassword.passwordMismatch')));
                  },
                }),
              ]}
            >
              <PasswordInput
                placeholder={t('forgotPassword.confirmPasswordPlaceholder')}
                style={{ backgroundColor: '#F5F5F5', color: '#1A1A1A' }}
              />
            </Form.Item>
          </Form>
        )}

        <Space justify='center' style={{ width: '100%', marginTop: '24px' }}>
          <Link to='/login' style={{ color: 'var(--xy-primary)' }}>
            {t('forgotPassword.backToLogin')}
          </Link>
        </Space>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;

