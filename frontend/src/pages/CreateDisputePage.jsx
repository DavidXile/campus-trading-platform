import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Input, Button, Card, Toast, Selector, Loading, NavBar, TextArea } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const CreateDisputePage = () => {
  const navigate = useNavigate();
  const { itemId } = useParams();
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchingItem, setFetchingItem] = useState(true);
  const [item, setItem] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [error, setError] = useState(null);

  // 调试信息
  useEffect(() => {
    console.log('CreateDisputePage 组件已加载');
    console.log('itemId:', itemId);
  }, [itemId]);

  // 纠纷类型选项
  const disputeTypes = React.useMemo(() => [
    { label: t('dispute.commodityMisrepresentation') || '商品描述不符', value: 'commodity_misrepresentation' },
    { label: t('dispute.noShow') || '未出现/未交付', value: 'no_show' },
    { label: t('dispute.priceDispute') || '价格争议', value: 'price_dispute' },
    { label: t('dispute.other') || '其他', value: 'other' }
  ], [t]);

  // 获取商品信息
  useEffect(() => {
    const fetchItem = async () => {
      try {
        console.log('开始获取商品信息, itemId:', itemId);
        setFetchingItem(true);
        setError(null);
        
        if (!itemId) {
          console.error('商品ID不存在');
          setError(t('dispute.itemIdMissing') || '商品ID不存在');
          setFetchingItem(false);
          return;
        }

        const response = await api.get(`/items/${itemId}`);
        console.log('商品信息响应:', response.data);
        
        if (response.data.success) {
          setItem(response.data.item);
          console.log('商品信息设置成功:', response.data.item);
        } else {
          const errorMsg = response.data.message || t('dispute.fetchItemFailed') || '获取商品信息失败';
          console.error('获取商品信息失败:', errorMsg);
          setError(errorMsg);
        }
      } catch (error) {
        console.error('获取商品信息异常:', error);
        console.error('错误详情:', error.response?.data || error.message);
        const errorMsg = error.response?.data?.message || error.message || t('dispute.fetchItemFailed') || '获取商品信息失败';
        setError(errorMsg);
      } finally {
        setFetchingItem(false);
        console.log('获取商品信息完成');
      }
    };

    if (itemId) {
      fetchItem();
    } else {
      setFetchingItem(false);
      setError(t('dispute.itemIdMissing') || '商品ID不存在');
    }
  }, [itemId]);

  // 处理图片上传
  const handleImageUpload = async (file) => {
    // 验证文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      Toast.show({
        icon: 'fail',
        content: t('dispute.imageSizeExceeded') || '图片大小不能超过5MB'
      });
      return null;
    }

    // 验证文件类型
    if (!file.type.match(/^image\/(jpeg|jpg|png)$/i)) {
      Toast.show({
        icon: 'fail',
        content: t('dispute.imageFormatError') || '只支持JPG/PNG格式的图片'
      });
      return null;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          url: reader.result,
          file: file
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 处理图片选择
  const handleImageClick = () => {
    if (uploadedImages.length >= 3) {
      Toast.show({
        icon: 'fail',
        content: t('dispute.maxEvidenceCount') || '最多只能上传3张图片'
      });
      return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      const remainingSlots = 3 - uploadedImages.length;
      
      if (files.length > remainingSlots) {
        Toast.show({
          icon: 'fail',
          content: t('dispute.maxRemainingImages', { count: remainingSlots }) || `最多只能再上传${remainingSlots}张图片`
        });
        return;
      }

      try {
        const results = await Promise.all(files.map(file => handleImageUpload(file)));
        const validResults = results.filter(r => r !== null);
        if (validResults.length > 0) {
          setUploadedImages([...uploadedImages, ...validResults]);
        }
      } catch (error) {
        Toast.show({
          icon: 'fail',
          content: t('publish.imageUploadFailed') || '图片上传失败'
        });
      }
    };
    input.click();
  };

  // 处理表单提交
  const handleFinish = async (values) => {
    setLoading(true);
    try {
      const disputeType = Array.isArray(values.dispute_type) ? values.dispute_type[0] : values.dispute_type;
      const evidenceImages = uploadedImages.length > 0 
        ? uploadedImages.map(img => img.url)
        : null;
      
      const response = await api.post('/disputes', {
        item_id: itemId,
        dispute_type: disputeType,
        description: values.description,
        evidence_images: evidenceImages
      });

      if (response.data.success) {
        Toast.show({
          icon: 'success',
          content: t('dispute.createSuccess') || '纠纷发起成功'
        });
        navigate(`/dispute/${response.data.dispute_id}`);
      } else {
        Toast.show({
          icon: 'fail',
          content: response.data.message || t('dispute.createFailed') || '纠纷发起失败'
        });
      }
    } catch (error) {
      console.error('发起纠纷失败:', error);
      Toast.show({
        icon: 'fail',
        content: error.response?.data?.message || t('dispute.createFailed') || '纠纷发起失败'
      });
    } finally {
      setLoading(false);
    }
  };

  // 加载状态
  if (fetchingItem) {
    console.log('显示加载状态');
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#F5F5F5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Loading />
      </div>
    );
  }

  // 错误状态
  if (!item) {
    console.log('显示错误状态, error:', error);
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#F5F5F5'
      }}>
        <NavBar onBack={() => navigate(-1)}>
          {t('dispute.pageTitle') || '发起纠纷'}
        </NavBar>
        <div style={{ 
          padding: '40px 20px',
          textAlign: 'center',
          color: '#999999'
        }}>
          {error || t('dispute.fetchItemFailed') || '获取商品信息失败'}
        </div>
        <div style={{ padding: '16px' }}>
          <Button 
            block 
            color='primary' 
            onClick={() => navigate(-1)}
          >
            {t('dispute.back') || t('common.back') || '返回'}
          </Button>
        </div>
      </div>
    );
  }

  console.log('渲染主内容, item:', item);
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#F5F5F5',
      paddingBottom: '80px'
    }}>
      <NavBar onBack={() => navigate(-1)}>
        {t('dispute.pageTitle') || '发起纠纷'}
      </NavBar>
      
      <div style={{ padding: '16px' }}>
        {/* 商品信息卡片 */}
        <Card style={{ marginBottom: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {item.image_url && (
              <img
                src={item.image_url}
                alt={item.title}
                style={{
                  width: '80px',
                  height: '80px',
                  objectFit: 'cover',
                  borderRadius: '8px'
                }}
              />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                {item.title}
              </div>
              <div style={{ fontSize: '14px', color: '#666666' }}>
                ¥{item.price}
              </div>
            </div>
          </div>
        </Card>

        {/* 纠纷表单 */}
        <Card style={{ borderRadius: '12px' }}>
          <Form
            form={form}
            layout='vertical'
            onFinish={handleFinish}
            footer={
              <Button
                block
                type='submit'
                color='primary'
                size='large'
                loading={loading}
              >
                {t('dispute.submit') || '提交'}
              </Button>
            }
          >
            <Form.Item
              label={t('dispute.disputeType') || '纠纷类型'}
              name='dispute_type'
              rules={[{ required: true, message: t('dispute.disputeTypeRequired') || '请选择纠纷类型' }]}
            >
              <Selector
                options={disputeTypes}
                multiple={false}
              />
            </Form.Item>

            <Form.Item
              label={t('dispute.description') || '纠纷描述'}
              name='description'
              rules={[
                { required: true, message: t('dispute.descriptionRequired') || '请输入纠纷描述' },
                { min: 10, message: t('dispute.descriptionMinLength') || '描述至少10个字符' },
                { max: 500, message: t('dispute.descriptionMaxLength') || '描述不能超过500个字符' }
              ]}
              extra={
                <div style={{ fontSize: '12px', color: '#999999' }}>
                  {t('dispute.descriptionHint') || '请详细描述纠纷情况（10-500字符）'}
                </div>
              }
            >
              <TextArea
                rows={6}
                showCount
                maxLength={500}
                placeholder={t('dispute.descriptionPlaceholder') || '请输入纠纷描述...'}
              />
            </Form.Item>

            {/* 证据图片上传 - 不使用 Form.Item，因为这是自定义组件 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: '500', color: '#1A1A1A', marginBottom: '8px' }}>
                {t('dispute.evidence') || '证据图片'}
              </div>
              <div style={{ fontSize: '12px', color: '#999999', marginBottom: '12px' }}>
                {t('dispute.evidenceHint') || '请上传1-3张相关证据图片（JPG/PNG格式，每张≤5MB）'}
              </div>
              {uploadedImages.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '12px', 
                  marginBottom: '12px' 
                }}>
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img
                        src={img.url}
                        alt={t('dispute.evidenceImage', { index: idx + 1 }) || `证据${idx + 1}`}
                        style={{
                          width: '100px',
                          height: '100px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          display: 'block'
                        }}
                      />
                      <Button
                        fill='none'
                        size='small'
                        onClick={() => {
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
                          fontSize: '16px',
                          border: '2px solid #FFFFFF',
                          lineHeight: '20px',
                          fontWeight: 'bold'
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              {uploadedImages.length < 3 && (
                <div
                  onClick={handleImageClick}
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    border: '2px dashed #E0E0E0',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: '#FAFAFA',
                    padding: '20px',
                    gap: '8px'
                  }}
                >
                  <div style={{ fontSize: '32px' }}>📷</div>
                  <div style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>
                    {uploadedImages.length === 0 
                      ? (t('dispute.clickToUpload') || '点击上传图片')
                      : (t('dispute.continueUpload') || '继续上传')
                    }
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {uploadedImages.length}/3
                  </div>
                </div>
              )}
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default CreateDisputePage;
