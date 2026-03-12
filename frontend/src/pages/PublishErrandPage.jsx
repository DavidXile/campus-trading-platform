import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Toast,
  DatePicker,
  TextArea,
  NavBar
} from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const PublishErrandPage = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [deadline, setDeadline] = useState(null);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const submitData = {
        ...values,
        deadline: deadline ? deadline.toISOString() : null
      };
      const response = await api.post('/errands', submitData);

      if (response.data.success) {
        Toast.show({
          icon: 'success',
          content: t('errand.publishSuccess'),
          duration: 2000,
        });

        setTimeout(() => {
          navigate(`/errand/${response.data.errandId}`);
        }, 2000);
      }
    } catch (error) {
      console.error('发布失败:', error);
      const errorMessage = error.response?.data?.message || t('errand.publishFailed');
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
      background: '#F5F5F5',
      paddingBottom: '80px'
    }}>
      <NavBar 
        onBack={() => navigate(-1)} 
        style={{ 
          background: '#FFFFFF', 
          borderBottom: '1px solid #F0F0F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
      >
        <span style={{ fontSize: '17px', fontWeight: '600' }}>{t('errand.publishErrandTitle')}</span>
      </NavBar>

      <div style={{ 
        maxWidth: '800px', 
        margin: '20px auto', 
        padding: '0 16px' 
      }}>
        <Card style={{ 
          borderRadius: '16px', 
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          border: 'none',
          padding: '24px'
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '24px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 16px',
              background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              boxShadow: '0 4px 16px rgba(0, 212, 170, 0.3)'
            }}>
              🏃
            </div>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '700',
              color: '#1A1A1A',
              marginBottom: '8px'
            }}>
              {t('errand.publishErrandTitle')}
            </h2>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#999999'
            }}>
              {t('errand.publishErrandSubtitle')}
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
                  marginTop: '24px', 
                  borderRadius: '12px', 
                  height: '48px',
                  fontSize: '16px',
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(0, 212, 170, 0.3)'
                }}
              >
                {t('errand.publishTaskButton')}
              </Button>
            }
          >
            <Form.Item
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>{t('errand.taskTitle')}</span>}
              name='title'
              rules={[
                { required: true, message: t('errand.taskTitleRequired') },
                { max: 200, message: t('errand.taskTitleMaxLength') }
              ]}
            >
              <Input 
                placeholder={t('errand.taskTitlePlaceholder')} 
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
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>{t('errand.description')}</span>}
              name='description'
              rules={[{ max: 1000, message: t('errand.descriptionMaxLength') }]}
            >
              <TextArea
                placeholder={t('errand.descriptionPlaceholder')}
                rows={6}
                showCount
                maxLength={1000}
                style={{
                  '--font-size': '15px',
                  '--background': '#F2F3F5',
                  '--border-radius': '12px',
                  '--border': 'none',
                  '--padding': '12px 16px'
                }}
              />
            </Form.Item>

            <Form.Item
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>{t('errand.location')}</span>}
              name='location'
              rules={[
                { required: true, message: t('errand.locationRequired') },
                { max: 200, message: t('errand.locationMaxLength') }
              ]}
            >
              <Input 
                placeholder={t('errand.locationPlaceholder')} 
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
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>{t('errand.destination')}</span>}
              name='destination'
              rules={[{ max: 200, message: t('errand.destinationMaxLength') }]}
            >
              <Input 
                placeholder={t('errand.destinationPlaceholder')} 
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
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>{t('errand.reward')}</span>}
              name='reward'
              rules={[
                { required: true, message: t('errand.rewardRequired') },
                { 
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const num = parseFloat(value);
                    if (isNaN(num) || num <= 0) {
                      return Promise.reject(new Error(t('errand.rewardMustBePositive')));
                    }
                    if (num > 99999999.99) {
                      return Promise.reject(new Error(t('errand.rewardMaxExceeded')));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input
                type='number'
                placeholder={t('errand.rewardPlaceholder')}
                min={0}
                step={0.01}
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
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>{t('errand.category')}</span>}
              name='category'
              rules={[{ max: 50, message: t('errand.categoryMaxLength') }]}
            >
              <Input 
                placeholder={t('errand.categoryPlaceholder')} 
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
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>{t('errand.contactInfo')}</span>}
              name='contact_info'
              rules={[{ max: 200, message: t('errand.contactInfoMaxLength') }]}
            >
              <Input 
                placeholder={t('errand.contactInfoPlaceholder')} 
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
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>{t('errand.deadline')}</span>}
              onClick={() => setPickerVisible(true)}
              arrow
            >
              <div style={{ 
                color: deadline ? '#1A1A1A' : '#999999',
                fontSize: '15px',
                padding: '12px 0'
              }}>
                {deadline ? deadline.toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US') : t('errand.deadlinePlaceholder')}
              </div>
            </Form.Item>

            <DatePicker
              visible={pickerVisible}
              onClose={() => setPickerVisible(false)}
              precision='minute'
              onConfirm={val => {
                setDeadline(val);
              }}
              min={new Date()}
            />
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default PublishErrandPage;
