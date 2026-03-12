import React, { useState, useRef } from 'react';
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

const RegisterPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [emailValue, setEmailValue] = useState(''); // 保存邮箱值

  // 发送验证码
  const handleSendCode = async () => {
    try {
      // 先尝试从表单获取，如果获取不到则使用 state 中的值
      let email = form.getFieldValue('email') || emailValue;
      
      // 如果还是获取不到，尝试验证字段
      if (!email) {
        try {
          const values = await form.validateFields(['email']);
          email = values.email;
        } catch (err) {
          // 验证失败，使用 state 中的值
          email = emailValue;
        }
      }
      
      if (!email || email.trim() === '') {
        Toast.show({
          icon: 'fail',
          content: t('register.emailRequired')
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
      const response = await api.post('/users/send-code', {
        email,
        type: 'register'
      });

      if (response.data.success) {
        Toast.show({
          icon: 'success',
          content: response.data.message || t('register.codeSent'),
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
        content: error.response?.data?.message || t('register.sendCodeFailed')
      });
    } finally {
      setCodeLoading(false);
    }
  };

  // 处理头像上传
  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      Toast.show({ icon: 'fail', content: '请选择图片文件' });
      return;
    }

    // 验证文件大小（2MB）
    if (file.size > 2 * 1024 * 1024) {
      Toast.show({ icon: 'fail', content: '图片大小不能超过2MB' });
      return;
    }

    // 将图片转换为base64并显示预览
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Image = event.target.result;
      setAvatar(base64Image);
      setAvatarPreview(base64Image);
    };
    reader.onerror = () => {
      Toast.show({ icon: 'fail', content: '读取图片失败' });
    };
    reader.readAsDataURL(file);
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // 如果用户上传了头像，将其添加到注册数据中
      const registerData = {
        ...values,
        verificationCode,
        ...(avatar && { avatar })
      };

      const response = await api.post('/users/register', registerData);

      if (response.data.success) {
        Toast.show({
          icon: 'success',
          content: t('register.registerSuccess'),
          duration: 2000,
        });

        // 延迟跳转，让用户看到成功消息
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (error) {
      console.error('注册失败:', error);
      const errorMessage = error.response?.data?.message || t('register.registerFailed');
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

      {/* 欢迎文字 */}
      <h1 style={{ 
        color: '#E0E0E0', 
        fontSize: '28px', 
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: '8px',
        lineHeight: '1.2'
      }}>
        {t('home.title')}
      </h1>
      <p style={{ 
        color: '#A0A0A0', 
        fontSize: '14px', 
        textAlign: 'center',
        marginBottom: '32px'
      }}>
        {t('register.title')}
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

        <Form
          form={form}
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
              {t('register.registerButton')}
            </Button>
          }
        >
          {/* 头像上传区域 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ marginBottom: '12px', fontWeight: 500, color: '#1A1A1A', fontSize: '16px' }}>{t('profile.avatar')}</div>
            <div 
              style={{ 
                position: 'relative', 
                cursor: 'pointer',
                marginBottom: '8px'
              }} 
              onClick={() => fileInputRef.current?.click()}
            >
              <div
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid var(--xy-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#F5F5F5',
                  position: 'relative'
                }}
              >
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="头像预览"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <div style={{ fontSize: '40px', color: '#999999' }}>👤</div>
                )}
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: '-8px',
                  right: '0',
                  backgroundColor: 'var(--xy-primary)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              >
                📷
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#666666', textAlign: 'center', marginTop: '8px' }}>
              {t('register.avatarUploadHint')}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarUpload}
            />
          </div>

          <Form.Item
            label={<span style={{ color: '#1A1A1A' }}>{t('register.username')}</span>}
            name='username'
            rules={[
              { required: true, message: t('register.usernameRequired') },
              { min: 2, message: t('register.usernameMinLength') },
              { max: 20, message: t('register.usernameMaxLength') }
            ]}
          >
            <Input placeholder={t('register.usernamePlaceholder')} style={{ backgroundColor: '#F5F5F5', color: '#1A1A1A' }} />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: '#1A1A1A' }}>{t('register.email')}</span>}
            name='email'
            rules={[
              { required: true, message: t('register.emailRequired') },
              {
                pattern: /^[a-zA-Z0-9._%+-]+@student\.must\.edu\.mo$/,
                message: t('register.emailPattern')
              }
            ]}
          >
            <Input 
              placeholder={t('register.emailPlaceholder')} 
              style={{ backgroundColor: '#F5F5F5', color: '#1A1A1A' }}
              onChange={(val) => {
                setEmailValue(val); // 保存邮箱值到 state
                setCodeSent(false);
                setVerificationCode('');
              }}
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: '#1A1A1A' }}>{t('register.verificationCode')}</span>}
            extra={
              <Button
                size='small'
                color='primary'
                fill='outline'
                onClick={handleSendCode}
                loading={codeLoading}
                disabled={codeSent && countdown > 0}
                style={{ marginTop: '8px' }}
              >
                {codeSent && countdown > 0 
                  ? `${t('register.resendCode')} (${countdown}s)` 
                  : t('register.sendCode')}
              </Button>
            }
          >
            <Input
              placeholder={t('register.verificationCodePlaceholder')}
              value={verificationCode}
              onChange={(val) => setVerificationCode(val)}
              style={{ backgroundColor: '#F5F5F5', color: '#1A1A1A' }}
              maxLength={6}
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: '#1A1A1A' }}>{t('register.password')}</span>}
            name='password'
            rules={[
              { required: true, message: t('register.passwordRequired') },
              { min: 6, message: t('register.passwordMinLength') },
              { max: 50, message: t('register.passwordMaxLength') }
            ]}
          >
            <PasswordInput
              placeholder={t('register.passwordPlaceholder')}
              style={{ backgroundColor: '#F5F5F5', color: '#1A1A1A' }}
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: '#1A1A1A' }}>{t('register.confirmPassword')}</span>}
            name='confirmPassword'
            dependencies={['password']}
            rules={[
              { required: true, message: t('register.confirmPasswordRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('register.passwordMismatch')));
                },
              }),
            ]}
          >
            <PasswordInput
              placeholder={t('register.confirmPasswordPlaceholder')}
              style={{ backgroundColor: '#F5F5F5', color: '#1A1A1A' }}
            />
          </Form.Item>
        </Form>

        <Space justify='center' style={{ width: '100%', marginTop: '24px' }}>
          <span style={{ color: '#666666' }}>{t('register.hasAccount')}</span>
          <Link to='/login' style={{ color: 'var(--xy-primary)' }}>
            {t('register.loginLink')}
          </Link>
        </Space>
      </Card>
    </div>
  );
};

export default RegisterPage;



