import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Button, Toast, Image, Dialog, Form, Input, TextArea } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import useUserStore from '../store/userStore';

const disputeTypes = [
  { label: '商品描述不符', value: 'commodity_misrepresentation' },
  { label: '未出现/未交付', value: 'no_show' },
  { label: '价格争议', value: 'price_dispute' },
  { label: '其他', value: 'other' }
];

const DisputeDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();
  const { user, updateUser } = useUserStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [dispute, setDispute] = useState(null);
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [responseFileList, setResponseFileList] = useState([]);
  const [appealFileList, setAppealFileList] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDispute();
    
    // 监听纠纷刷新事件
    const handleRefreshDisputes = () => {
      fetchDispute();
    };
    window.addEventListener('refreshDisputes', handleRefreshDisputes);
    
    return () => {
      window.removeEventListener('refreshDisputes', handleRefreshDisputes);
    };
  }, [id]);

  const fetchDispute = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/disputes/${id}`);
      if (response.data.success) {
        setDispute(response.data.dispute);
      }
    } catch (error) {
      console.error('获取纠纷详情失败:', error);
      Toast.show({
        icon: 'fail',
        content: error.response?.data?.message || '获取纠纷详情失败'
      });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

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

  // 处理图片选择（响应表单）
  const handleResponseImageClick = () => {
    if (responseFileList.length >= 3) {
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
      const remainingSlots = 3 - responseFileList.length;
      
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
          setResponseFileList([...responseFileList, ...validResults]);
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

  // 处理图片选择（申诉表单）
  const handleAppealImageClick = () => {
    if (appealFileList.length >= 3) {
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
      const remainingSlots = 3 - appealFileList.length;
      
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
          setAppealFileList([...appealFileList, ...validResults]);
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

  const handleRespond = async (values) => {
    if (responseFileList.length > 3) {
      Toast.show({
        icon: 'fail',
        content: t('dispute.maxEvidenceCount')
      });
      return;
    }

    setSubmitting(true);
    try {
      const responseEvidenceImages = responseFileList.length > 0
        ? responseFileList.map(img => img.url)
        : null;

      const response = await api.post(`/disputes/${id}/respond`, {
        response_description: values.response_description,
        response_evidence_images: responseEvidenceImages
      });

      if (response.data.success) {
        Toast.show({
          icon: 'success',
          content: t('dispute.responseSuccess')
        });
        setShowResponseForm(false);
        setResponseFileList([]);
        form.resetFields();
        fetchDispute();
      }
    } catch (error) {
      console.error('响应纠纷失败:', error);
      Toast.show({
        icon: 'fail',
        content: error.response?.data?.message || t('dispute.responseFailed')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmResult = async (action) => {
    if (action === 'appeal') {
      setShowAppealForm(true);
      return;
    }

    if (action === 'reject') {
      // 拒绝接受结果（不服从安排）
      if (!window.confirm(t('dispute.rejectConfirm') || '确定要拒绝接受审核结果吗？拒绝接受将扣减信用分，信用分过低可能导致账号封禁！')) {
        return;
      }
    }

    try {
      const response = await api.post(`/disputes/${id}/confirm`, { action });
      if (response.data.success) {
        Toast.show({
          icon: 'success',
          content: action === 'accept' 
            ? (t('dispute.acceptSuccess') || '已接受处理结果')
            : (t('dispute.rejectSuccess') || '已记录拒绝接受结果')
        });
        fetchDispute();
        // 如果拒绝，刷新用户信息以更新信用分
        if (action === 'reject') {
          try {
            const userResponse = await api.get('/users/me');
            if (userResponse.data.success && userResponse.data.user) {
              updateUser(userResponse.data.user);
            }
          } catch (err) {
            console.error('刷新用户信息失败:', err);
          }
        }
      }
    } catch (error) {
      console.error('操作失败:', error);
      Toast.show({
        icon: 'fail',
        content: error.response?.data?.message || '操作失败'
      });
    }
  };

  const handleAppeal = async (values) => {
    setSubmitting(true);
    try {
      const appealEvidenceImages = appealFileList.length > 0
        ? appealFileList.map(img => img.url)
        : null;

      const response = await api.post(`/disputes/${id}/confirm`, {
        action: 'appeal',
        appeal_description: values.appeal_description,
        appeal_evidence_images: appealEvidenceImages
      });

      if (response.data.success) {
        Toast.show({
          icon: 'success',
          content: t('dispute.appealSuccess')
        });
        setShowAppealForm(false);
        setAppealFileList([]);
        form.resetFields();
        fetchDispute();
      }
    } catch (error) {
      console.error('提交申诉失败:', error);
      Toast.show({
        icon: 'fail',
        content: error.response?.data?.message || t('dispute.appealFailed')
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !dispute) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  }

  const isInitiator = Number(user?.id) === Number(dispute.initiator_id);
  const isRespondent = Number(user?.id) === Number(dispute.respondent_id);
  const canRespond = isRespondent && dispute.status === 'pending_response';
  
  // 检查用户是否已经确认或拒绝过
  const hasConfirmed = isInitiator 
    ? dispute.initiator_confirmed 
    : (isRespondent ? dispute.respondent_confirmed : false);
  const hasRejected = isInitiator 
    ? dispute.initiator_rejected 
    : (isRespondent ? dispute.respondent_rejected : false);
  
  const canConfirm = (isInitiator || isRespondent) && 
    (dispute.status === 'resolved' || dispute.status === 'appeal_resolved') &&
    !hasConfirmed && !hasRejected;

  const getStatusText = (status) => {
    const statusMap = {
      'pending_response': t('dispute.pendingResponse'),
      'pending_review': t('dispute.pendingReview'),
      'resolved': t('dispute.resolved'),
      'appealed': t('dispute.appealed'),
      'appeal_resolved': t('dispute.appealResolved')
    };
    return statusMap[status] || status;
  };

  const getReviewResultText = (result) => {
    const resultMap = {
      'support_initiator': t('dispute.supportInitiator'),
      'support_respondent': t('dispute.supportRespondent'),
      'partial_refund': t('dispute.partialRefund'),
      'no_support': t('dispute.noSupport')
    };
    return resultMap[result] || result;
  };

  return (
    <div style={{ padding: '16px', minHeight: '100vh', background: '#F5F5F5' }}>
      {/* 商品信息 */}
      <Card style={{ marginBottom: '16px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {dispute.item_image && (
            <img
              src={dispute.item_image}
              alt={dispute.item_title}
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
              {dispute.item_title}
            </div>
            <div style={{ fontSize: '14px', color: '#666666' }}>
              ¥{dispute.item_price}
            </div>
          </div>
        </div>
      </Card>

      {/* 纠纷信息 */}
      <Card style={{ marginBottom: '16px', borderRadius: '12px' }}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: '#999999', marginBottom: '4px' }}>
            {t('dispute.status')}
          </div>
          <div style={{ fontSize: '16px', fontWeight: '600' }}>
            {getStatusText(dispute.status)}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: '#999999', marginBottom: '4px' }}>
            纠纷类型
          </div>
          <div style={{ fontSize: '16px' }}>
            {disputeTypes.find(t => t.value === dispute.dispute_type)?.label || dispute.dispute_type}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: '#999999', marginBottom: '4px' }}>
            发起者
          </div>
          <div style={{ fontSize: '16px' }}>
            {dispute.initiator_name}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '14px', color: '#999999', marginBottom: '4px' }}>
            响应者
          </div>
          <div style={{ fontSize: '16px' }}>
            {dispute.respondent_name}
          </div>
        </div>
      </Card>

      {/* 发起者描述 */}
      <Card style={{ marginBottom: '16px', borderRadius: '12px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
          发起者描述
        </div>
        <div style={{ fontSize: '14px', color: '#333333', marginBottom: '12px' }}>
          {dispute.description}
        </div>
        {dispute.evidence_images && dispute.evidence_images.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {dispute.evidence_images.map((img, index) => (
              <img
                key={index}
                src={img}
                alt={`证据${index + 1}`}
                style={{
                  width: '100px',
                  height: '100px',
                  objectFit: 'cover',
                  borderRadius: '8px'
                }}
              />
            ))}
          </div>
        )}
      </Card>

      {/* 响应者描述 */}
      {dispute.response_description && (
        <Card style={{ marginBottom: '16px', borderRadius: '12px' }}>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            响应者描述
          </div>
          <div style={{ fontSize: '14px', color: '#333333', marginBottom: '12px' }}>
            {dispute.response_description}
          </div>
          {dispute.response_evidence_images && dispute.response_evidence_images.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {dispute.response_evidence_images.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`响应证据${index + 1}`}
                  style={{
                    width: '100px',
                    height: '100px',
                    objectFit: 'cover',
                    borderRadius: '8px'
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 审核结果 */}
      {(dispute.admin_review_result || dispute.appeal_review_result) && (
        <Card style={{ marginBottom: '16px', borderRadius: '12px' }}>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            {t('dispute.reviewResult')}
          </div>
          <div style={{ fontSize: '14px', color: '#333333', marginBottom: '8px' }}>
            {getReviewResultText(dispute.appeal_review_result || dispute.admin_review_result)}
          </div>
          {(dispute.appeal_review_reason || dispute.admin_review_reason) && (
            <div style={{ fontSize: '14px', color: '#666666' }}>
              {dispute.appeal_review_reason || dispute.admin_review_reason}
            </div>
          )}
        </Card>
      )}

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: '12px' }}>
        {canRespond && (
          <Button
            block
            color='primary'
            onClick={() => setShowResponseForm(true)}
          >
            {t('dispute.respond')}
          </Button>
        )}

        {canConfirm && (
          <>
            <Button
              block
              fill='outline'
              onClick={() => handleConfirmResult('accept')}
            >
              {t('dispute.acceptResult')}
            </Button>
            {(dispute.status === 'resolved' || dispute.status === 'appeal_resolved') && (
              <Button
                block
                fill='outline'
                color='warning'
                onClick={() => handleConfirmResult('appeal')}
              >
                {t('dispute.appeal')}
              </Button>
            )}
            <Button
              block
              fill='outline'
              color='danger'
              onClick={() => handleConfirmResult('reject')}
            >
              {t('dispute.rejectResult') || '拒绝接受'}
            </Button>
          </>
        )}
        
        {/* 显示已操作状态 */}
        {!canConfirm && (hasConfirmed || hasRejected) && (
          <div style={{ 
            padding: '12px', 
            textAlign: 'center', 
            color: hasConfirmed ? '#00D4AA' : '#FF4444',
            fontSize: '14px',
            fontWeight: '500',
            marginTop: '8px'
          }}>
            {hasConfirmed 
              ? (t('dispute.acceptSuccess') || '您已接受处理结果')
              : '您已拒绝接受处理结果，信用分已扣减'
            }
          </div>
        )}
      </div>

      {/* 响应表单弹窗 */}
      <Dialog
        visible={showResponseForm}
        content={
          <Form
            form={form}
            layout='vertical'
            onFinish={handleRespond}
            footer={
              <Button
                block
                type='submit'
                color='primary'
                loading={submitting}
              >
                {t('dispute.submitResponse')}
              </Button>
            }
          >
            <Form.Item
              label={t('dispute.responseDescription')}
              name='response_description'
              rules={[
                { required: true, message: t('dispute.responseDescriptionRequired') },
                { min: 10, message: t('dispute.descriptionMinLength') },
                { max: 500, message: t('dispute.descriptionMaxLength') }
              ]}
            >
              <TextArea
                rows={6}
                showCount
                maxLength={500}
                placeholder={t('dispute.responseDescriptionPlaceholder')}
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
              {responseFileList.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '12px', 
                  marginBottom: '12px' 
                }}>
                  {responseFileList.map((img, idx) => (
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
                          setResponseFileList(responseFileList.filter((_, i) => i !== idx));
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
              
              {responseFileList.length < 3 && (
                <div
                  onClick={handleResponseImageClick}
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
                    {responseFileList.length === 0 
                      ? (t('dispute.clickToUpload') || '点击上传图片')
                      : (t('dispute.continueUpload') || '继续上传')
                    }
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {responseFileList.length}/3
                  </div>
                </div>
              )}
            </div>
          </Form>
        }
        onClose={() => {
          setShowResponseForm(false);
          form.resetFields();
          setResponseFileList([]);
        }}
        closeOnAction
      />

      {/* 申诉表单弹窗 */}
      <Dialog
        visible={showAppealForm}
        content={
          <Form
            form={form}
            layout='vertical'
            onFinish={handleAppeal}
            footer={
              <Button
                block
                type='submit'
                color='primary'
                loading={submitting}
              >
                {t('dispute.submitAppeal')}
              </Button>
            }
          >
            <Form.Item
              label={t('dispute.appealDescription')}
              name='appeal_description'
              rules={[
                { required: true, message: t('dispute.descriptionRequired') },
                { min: 10, message: t('dispute.descriptionMinLength') },
                { max: 500, message: t('dispute.descriptionMaxLength') }
              ]}
            >
              <TextArea
                rows={6}
                showCount
                maxLength={500}
                placeholder={t('dispute.appealDescriptionPlaceholder')}
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
              {appealFileList.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '12px', 
                  marginBottom: '12px' 
                }}>
                  {appealFileList.map((img, idx) => (
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
                          setAppealFileList(appealFileList.filter((_, i) => i !== idx));
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
              
              {appealFileList.length < 3 && (
                <div
                  onClick={handleAppealImageClick}
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
                    {appealFileList.length === 0 
                      ? (t('dispute.clickToUpload') || '点击上传图片')
                      : (t('dispute.continueUpload') || '继续上传')
                    }
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {appealFileList.length}/3
                  </div>
                </div>
              )}
            </div>
          </Form>
        }
        onClose={() => {
          setShowAppealForm(false);
          form.resetFields();
          setAppealFileList([]);
        }}
        closeOnAction
      />
    </div>
  );
};

export default DisputeDetailPage;

