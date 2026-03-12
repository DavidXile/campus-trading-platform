import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  TextArea,
  Selector,
  Toast,
  NavBar,
  Image,
  Loading,
  ErrorBlock
} from 'antd-mobile';
import api from '../services/api';
import useUserStore from '../store/userStore';

// 分类选项
const categories = [
  { label: '电子产品', value: '电子产品' },
  { label: '书籍教材', value: '书籍教材' },
  { label: '服装鞋帽', value: '服装鞋帽' },
  { label: '生活用品', value: '生活用品' },
  { label: '运动健身', value: '运动健身' },
  { label: '美妆护肤', value: '美妆护肤' },
  { label: '其他', value: '其他' },
];

const EditItemPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useUserStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [item, setItem] = useState(null);

  // 获取物品详情
  useEffect(() => {
    const fetchItem = async () => {
      try {
        setFetching(true);
        const response = await api.get(`/items/${id}`);
        if (response.data.success) {
          const itemData = response.data.item;
          
          // 验证是否是物品所有者
          if (user?.id !== itemData.seller_id) {
            setError('无权编辑此物品');
            return;
          }

          setItem(itemData);
          
          // 设置表单初始值
          form.setFieldsValue({
            title: itemData.title,
            description: itemData.description || '',
            price: itemData.price.toString(),
            category: itemData.category ? [itemData.category] : []
          });

          // 设置图片
          if (itemData.image_url) {
            setUploadedImages([{ url: itemData.image_url }]);
          }
        } else {
          setError('获取物品信息失败');
        }
      } catch (err) {
        console.error('获取物品详情失败:', err);
        if (err.response?.status === 404) {
          setError('物品不存在');
        } else if (err.response?.status === 403) {
          setError('无权编辑此物品');
        } else {
          setError('获取物品信息失败，请稍后重试');
        }
      } finally {
        setFetching(false);
      }
    };

    if (id) {
      fetchItem();
    }
  }, [id, form, user]);

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
          content: '价格必须是一个大于0的数字',
        });
        return;
      }

      const submitData = {
        title: values.title,
        description: values.description || '',
        price: priceValue,
        category: values.category?.[0] || '',
        image_url: uploadedImages.length > 0 ? uploadedImages[0].url : null,
      };

      const response = await api.put(`/items/${id}`, submitData);

      if (response.data.success) {
        Toast.show({
          icon: 'success',
          content: '物品更新成功！',
          duration: 2000,
        });
        setTimeout(() => {
          navigate(`/item/${id}`);
        }, 2000);
      }
    } catch (error) {
      console.error('更新物品失败:', error);
      const errorMessage = error.response?.data?.message || '更新失败，请重试';
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
      Toast.show({ icon: 'fail', content: '最多只能上传9张图片' });
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length + uploadedImages.length > 9) {
        Toast.show({ icon: 'fail', content: '最多只能上传9张图片' });
        return;
      }
      try {
        const newImages = await Promise.all(
          files.map(file => handleImageUpload(file))
        );
        setUploadedImages([...uploadedImages, ...newImages]);
      } catch (err) {
        Toast.show({ icon: 'fail', content: '图片上传失败' });
      }
    };
    input.click();
  };

  const handleRemoveImage = (index) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
  };

  if (fetching) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '40px',
        minHeight: '100vh',
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
        <NavBar 
          onBack={() => navigate(-1)} 
          style={{ 
            background: '#FFFFFF', 
            borderBottom: '1px solid #F0F0F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <span style={{ fontSize: '17px', fontWeight: '600' }}>编辑物品</span>
        </NavBar>
        <ErrorBlock status='default' title={error} />
      </div>
    );
  }

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
        <span style={{ fontSize: '17px', fontWeight: '600' }}>编辑物品</span>
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
              ✏️
            </div>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '700',
              color: '#1A1A1A',
              marginBottom: '8px'
            }}>
              编辑物品
            </h2>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#999999'
            }}>
              修改物品信息
            </p>
          </div>

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
                保存修改
              </Button>
            }
          >
            <Form.Item
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>物品标题</span>}
              name='title'
              rules={[
                { required: true, message: '请输入物品标题' },
                { max: 200, message: '标题最多200个字符' }
              ]}
            >
              <Input 
                placeholder='例如：二手MacBook Pro' 
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
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>物品描述</span>}
              name='description'
              rules={[{ max: 1000, message: '描述最多1000个字符' }]}
            >
              <TextArea
                placeholder='详细描述物品状况、使用情况等...'
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
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>价格（元）</span>}
              name='price'
              rules={[
                { required: true, message: '请输入价格' },
                { 
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const num = parseFloat(value);
                    if (isNaN(num) || num <= 0) {
                      return Promise.reject(new Error('价格必须大于0'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input
                type='number'
                placeholder='0.00'
                min={0.01}
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
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>分类</span>}
              name='category'
            >
              <Selector
                options={categories}
                style={{
                  '--border-radius': '12px',
                  '--checked-background': '#00D4AA',
                  '--checked-border-color': '#00D4AA',
                  '--checked-color': '#FFFFFF',
                  '--text-color': '#1A1A1A',
                  '--background': '#F2F3F5',
                  '--border-color': '#E0E0E0'
                }}
              />
            </Form.Item>

            <Form.Item
              label={<span style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A' }}>物品图片</span>}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {uploadedImages.map((img, index) => (
                  <div key={index} style={{ position: 'relative', width: '100px', height: '100px' }}>
                    <Image
                      src={img.url}
                      fit='cover'
                      width='100%'
                      height='100%'
                      style={{ borderRadius: '8px' }}
                    />
                    <div
                      onClick={() => handleRemoveImage(index)}
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: '#FF4D4F',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                      }}
                    >
                      ×
                    </div>
                  </div>
                ))}
                {uploadedImages.length < 9 && (
                  <div
                    onClick={handleImageClick}
                    style={{
                      width: '100px',
                      height: '100px',
                      border: '2px dashed #D0D0D0',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      background: '#FAFAFA',
                      color: '#999999',
                      fontSize: '24px'
                    }}
                  >
                    <div>+</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>添加图片</div>
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

export default EditItemPage;

