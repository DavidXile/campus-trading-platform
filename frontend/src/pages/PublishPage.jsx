import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  TextArea,
  Selector,
  Toast,
  NavBar,
  Image
} from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const PublishPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  // 分类选项 - 使用翻译
  const categories = [
    { label: t('home.categoryElectronics'), value: '电子产品' },
    { label: t('home.categoryBooks'), value: '书籍教材' },
    { label: t('home.categoryClothing'), value: '服装鞋帽' },
    { label: t('home.categoryDaily'), value: '生活用品' },
    { label: t('home.categorySports'), value: '运动健身' },
    { label: t('home.categoryBeauty'), value: '美妆护肤' },
    { label: t('home.categoryOther'), value: '其他' },
  ];
  const [loading, setLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);

  // 处理图片上传
  const handleImageUpload = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        setTimeout(() => {
          resolve({
            url: reader.result,
          });
        }, 1000);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 处理表单提交
  const onFinish = async (values) => {
    setLoading(true);
    try {
      // 确保价格是有效的数字
      const priceValue = parseFloat(values.price);
      if (isNaN(priceValue) || priceValue <= 0) {
        Toast.show({
          icon: 'fail',
          content: t('publish.priceInvalid'),
        });
        return;
      }

      const submitData = {
        title: values.title,
        description: values.description || '',
        price: priceValue,
        category: values.category?.[0] || '',
        image_url: uploadedImages.length > 0 ? uploadedImages[0].url : null,
        images: uploadedImages.map(img => img.url)
      };

      const response = await api.post('/items', submitData);

      if (response.data.success) {
        Toast.show({
          icon: 'success',
          content: t('publish.publishSuccess'),
          duration: 2000,
        });
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (error) {
      console.error('发布物品失败:', error);
      const errorMessage = error.response?.data?.message || t('publish.publishFailed');
      Toast.show({
        icon: 'fail',
        content: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = () => {
    if (uploadedImages.length >= 9) {
      Toast.show({ icon: 'fail', content: t('publish.maxImages') });
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length + uploadedImages.length > 9) {
        Toast.show({ icon: 'fail', content: t('publish.maxImages') });
        return;
      }
      try {
        const results = await Promise.all(files.map(file => handleImageUpload(file)));
        setUploadedImages([...uploadedImages, ...results.filter(r => r)]);
      } catch (error) {
        Toast.show({ icon: 'fail', content: t('publish.imageUploadFailed') });
      }
    };
    input.click();
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#F5F5F5'
    }}>
      <NavBar onBack={() => navigate(-1)}>
        {t('publish.title')}
      </NavBar>
      
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        padding: '20px 16px'
      }}>
        <Card>
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
                  marginTop: '20px',
                  height: '48px',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                {t('publish.publishButton')}
              </Button>
            }
          >
            <Form.Item
              label={t('publish.itemTitle')}
              name='title'
              rules={[
                { required: true, message: t('publish.titleRequired') },
                { min: 2, message: t('publish.titleMinLength') },
                { max: 100, message: t('publish.titleMaxLength') }
              ]}
            >
              <Input placeholder={t('publish.itemTitlePlaceholder')} />
            </Form.Item>

            <Form.Item
              label={t('publish.description')}
              name='description'
              rules={[{ max: 1000, message: t('publish.descriptionMaxLength') }]}
            >
              <TextArea
                placeholder={t('publish.descriptionPlaceholder')}
                rows={6}
                showCount
                maxLength={1000}
              />
            </Form.Item>

            <Form.Item
              label={t('publish.price') + ' (元)'}
              name='price'
              rules={[
                { required: true, message: t('publish.priceRequired') },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const num = parseFloat(value);
                    if (isNaN(num) || num <= 0) return Promise.reject(t('publish.priceInvalid'));
                    if (num > 100000) return Promise.reject(t('publish.priceMaxExceeded'));
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input 
                type='number' 
                placeholder={t('publish.pricePlaceholder')}
                min={0.01}
                step={0.01}
              />
            </Form.Item>

            <Form.Item
              label={t('publish.category')}
              name='category'
              rules={[{ required: true, message: t('publish.categoryRequired') }]}
            >
              <Selector
                options={categories}
                placeholder={t('publish.selectCategory')}
                columns={3}
              />
            </Form.Item>

            <Form.Item label={t('publish.image')} name='images'>
              <div
                onClick={handleImageClick}
                style={{
                  border: '2px dashed #E0E0E0',
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'center',
                  backgroundColor: '#FAFAFA',
                  cursor: 'pointer',
                  minHeight: '120px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px'
                }}
              >
                {uploadedImages.length === 0 ? (
                  <>
                    <div style={{ fontSize: '48px' }}>📷</div>
                    <div style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>
                      {t('publish.addImages')}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {t('publish.imageFormatHint')}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', justifyContent: 'center' }}>
                    {uploadedImages.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <Image
                          src={img.url}
                          width='100px'
                          height='100px'
                          fit='cover'
                          style={{ borderRadius: '8px', display: 'block' }}
                          fallback={
                            <div style={{
                              width: '100px',
                              height: '100px',
                              background: '#f5f5f5',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#999',
                              fontSize: '12px'
                            }}>
                              {t('publish.loadFailed')}
                            </div>
                          }
                        />
                        <Button
                          fill='none'
                          size='small'
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedImages(uploadedImages.filter((_, i) => i !== idx));
                          }}
                          style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-8px',
                            width: '24px',
                            height: '24px',
                            padding: 0,
                            minWidth: '24px',
                            background: '#FF5722',
                            color: '#FFFFFF',
                            borderRadius: '50%',
                            fontSize: '14px',
                            border: '2px solid #FFFFFF',
                            lineHeight: '24px'
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    {uploadedImages.length < 9 && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImageClick();
                        }}
                        style={{
                          width: '100px',
                          height: '100px',
                          border: '2px dashed #E0E0E0',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          background: '#FAFAFA',
                          fontSize: '32px',
                          color: '#999'
                        }}
                      >
                        +
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default PublishPage;
