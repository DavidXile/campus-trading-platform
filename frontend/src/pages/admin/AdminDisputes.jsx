import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  List,
  SearchBar,
  Selector,
  Button,
  Toast,
  Loading,
  ErrorBlock,
  InfiniteScroll,
  Dialog,
  Tag,
  Form,
  Input,
  TextArea
} from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import useUserStore from '../../store/userStore';

const AdminDisputes = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, logout } = useUserStore();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [form] = Form.useForm();
  const [previewImage, setPreviewImage] = useState(null);

  const statusOptions = [
    { label: t('dispute.pendingResponse'), value: 'pending_response' },
    { label: t('dispute.pendingReview'), value: 'pending_review' },
    { label: t('dispute.resolved'), value: 'resolved' },
    { label: t('dispute.appealed'), value: 'appealed' },
    { label: t('dispute.appealResolved'), value: 'appeal_resolved' }
  ];

  const reviewResultOptions = [
    { label: t('dispute.supportInitiator'), value: 'support_initiator' },
    { label: t('dispute.supportRespondent'), value: 'support_respondent' },
    { label: t('dispute.partialRefund'), value: 'partial_refund' },
    { label: t('dispute.noSupport'), value: 'no_support' }
  ];

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin/login');
      return;
    }
    // 只在组件挂载时初始化加载，状态筛选变化时由 handleStatusFilter 处理
    if (page === 1 && !searchText && !statusFilter) {
      fetchDisputes();
    }
    
    // 监听纠纷刷新事件
    const handleRefreshDisputes = () => {
      fetchDisputes(page, searchText, statusFilter);
    };
    window.addEventListener('refreshDisputes', handleRefreshDisputes);
    
    return () => {
      window.removeEventListener('refreshDisputes', handleRefreshDisputes);
    };
  }, [user, navigate]);

  const fetchDisputes = async (pageNum = 1, search = '', status = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum,
        limit: 20
      });
      if (search) {
        params.append('search', search);
      }
      if (status) {
        params.append('status', status);
      }

      console.log('🔍 获取纠纷列表，参数:', { page: pageNum, search, status, url: `/admin/disputes?${params}` });
      const response = await api.get(`/admin/disputes?${params}`);
      console.log('✅ 获取纠纷列表成功，数量:', response.data.disputes?.length, '状态筛选:', status);
      if (response.data.success) {
        if (pageNum === 1) {
          setDisputes(response.data.disputes);
        } else {
          setDisputes(prev => [...prev, ...response.data.disputes]);
        }
        setPagination(response.data.pagination);
        setHasMore(pageNum < response.data.pagination.pages);
        setPage(pageNum);
      }
    } catch (err) {
      console.error('获取纠纷列表失败:', err);
      if (err.response?.status === 403) {
        setError(t('adminCommon.noPermission'));
        logout();
        navigate('/admin/login');
      } else {
        setError(t('adminCommon.fetchFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value) => {
    setSearchText(value);
    fetchDisputes(1, value, statusFilter);
  };

  const handleStatusFilter = (value) => {
    const newStatus = value || '';
    setStatusFilter(newStatus);
    setPage(1); // 重置到第一页
    fetchDisputes(1, searchText, newStatus);
  };

  const handleReview = (dispute) => {
    setSelectedDispute(dispute);
    form.setFieldsValue({
      review_result: dispute.status === 'appealed' 
        ? dispute.appeal_review_result || '' 
        : dispute.admin_review_result || '',
      review_reason: dispute.status === 'appealed'
        ? dispute.appeal_review_reason || ''
        : dispute.admin_review_reason || ''
    });
    setShowReviewDialog(true);
  };

  const handleReviewSubmit = async (values) => {
    if (!selectedDispute) return;

    setReviewing(true);
    try {
      // 确保状态判断正确：只有状态为 'appealed' 的纠纷才能进行申诉审核
      const isAppeal = selectedDispute.status === 'appealed';
      
      // 双重检查：如果前端判断是申诉审核但状态不对，给出提示
      if (isAppeal && selectedDispute.status !== 'appealed') {
        Toast.show({
          icon: 'fail',
          content: t('adminDisputes.notAppealed')
        });
        setReviewing(false);
        return;
      }
      
      await api.post(`/admin/disputes/${selectedDispute.id}/review`, {
        review_result: values.review_result[0],
        review_reason: values.review_reason,
        is_appeal: isAppeal
      });

      Toast.show({
        icon: 'success',
        content: isAppeal ? t('adminDisputes.appealReviewed') : t('adminDisputes.disputeReviewed')
      });

      setShowReviewDialog(false);
      setSelectedDispute(null);
      form.resetFields();
      fetchDisputes(page, searchText, statusFilter);
    } catch (err) {
      console.error('审核失败:', err);
      Toast.show({
        icon: 'fail',
        content: err.response?.data?.message || t('adminDisputes.auditFailed')
      });
    } finally {
      setReviewing(false);
    }
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'pending_response': 'warning',
      'pending_review': 'primary',
      'resolved': 'success',
      'appealed': 'danger',
      'appeal_resolved': 'default'
    };
    return colorMap[status] || 'default';
  };

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

  const canReview = (dispute) => {
    return dispute.status === 'pending_review' || dispute.status === 'appealed';
  };

  if (loading && page === 1) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
      <Card style={{ margin: '16px', borderRadius: '12px' }}>
        <SearchBar
          placeholder={t('adminDisputes.searchPlaceholder')}
          value={searchText}
          onChange={handleSearch}
          onSearch={handleSearch}
          style={{ marginBottom: '16px' }}
        />

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: '#666666', marginBottom: '8px' }}>
            {t('adminDisputes.statusFilter')}
          </div>
          <Selector
            options={statusOptions}
            value={statusFilter ? [statusFilter] : []}
            onChange={(arr) => handleStatusFilter(arr[0] || '')}
          />
        </div>
      </Card>

      <List>
        {disputes.map((dispute) => (
          <List.Item
            key={dispute.id}
            onClick={() => navigate(`/dispute/${dispute.id}`)}
            extra={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                <Tag color={getStatusColor(dispute.status)}>
                  {getStatusText(dispute.status)}
                </Tag>
                {canReview(dispute) && (
                  <Button
                    size='small'
                    color='primary'
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReview(dispute);
                    }}
                  >
                    {t('adminDisputes.reviewButton')}
                  </Button>
                )}
              </div>
            }
          >
            <div>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                {dispute.item_title}
              </div>
              <div style={{ fontSize: '14px', color: '#666666', marginBottom: '4px' }}>
                {t('adminDisputes.initiator')}: {dispute.initiator_name} | {t('adminDisputes.respondent')}: {dispute.respondent_name}
              </div>
              <div style={{ fontSize: '12px', color: '#999999' }}>
                {t('adminDisputes.type')}: {dispute.dispute_type} | {t('adminDisputes.createdAt')}: {new Date(dispute.created_at).toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US')}
              </div>
              {(dispute.admin_review_result || dispute.appeal_review_result) && (
                <div style={{ fontSize: '12px', color: '#666666', marginTop: '4px' }}>
                  {t('adminDisputes.reviewResult')}: {getReviewResultText(dispute.appeal_review_result || dispute.admin_review_result)}
                </div>
              )}
            </div>
          </List.Item>
        ))}
      </List>

      {hasMore && (
        <InfiniteScroll
          loadMore={async () => {
            await fetchDisputes(page + 1, searchText, statusFilter);
          }}
          hasMore={hasMore}
        />
      )}

      {/* 审核对话框 */}
      <Dialog
        visible={showReviewDialog}
        title={selectedDispute?.status === 'appealed' ? t('adminDisputes.appealReviewDialogTitle') : t('adminDisputes.reviewDialogTitle')}
        content={
          selectedDispute && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', color: '#666666', marginBottom: '4px' }}>
                  {t('adminDisputes.type')}: {selectedDispute.item_title}
                </div>
                <div style={{ fontSize: '14px', color: '#666666', marginBottom: '4px' }}>
                  {t('adminDisputes.initiator')}: {selectedDispute.initiator_name}
                </div>
                <div style={{ fontSize: '14px', color: '#666666', marginBottom: '4px' }}>
                  {t('adminDisputes.respondent')}: {selectedDispute.respondent_name}
                </div>
                <div style={{ fontSize: '14px', color: '#666666', marginBottom: '8px' }}>
                  {t('adminDisputes.disputeDescription')}: {selectedDispute.description}
                </div>
                {/* 发起者证据图片 */}
                {selectedDispute.evidence_images && Array.isArray(selectedDispute.evidence_images) && selectedDispute.evidence_images.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#999999', marginBottom: '4px' }}>
                    {t('adminDisputes.evidenceInitiator')}:
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {selectedDispute.evidence_images.map((img, index) => (
                        <img
                          key={index}
                          src={img}
                        alt={`${t('adminDisputes.evidenceInitiator')}${index + 1}`}
                          style={{
                            width: '80px',
                            height: '80px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid #E0E0E0',
                            cursor: 'pointer'
                          }}
                          onClick={() => setPreviewImage(img)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {selectedDispute.response_description && (
                  <div style={{ fontSize: '14px', color: '#666666', marginBottom: '8px' }}>
                    {t('adminDisputes.responseDescription')}: {selectedDispute.response_description}
                  </div>
                )}
                {/* 响应者证据图片 */}
                {selectedDispute.response_evidence_images && Array.isArray(selectedDispute.response_evidence_images) && selectedDispute.response_evidence_images.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#999999', marginBottom: '4px' }}>
                    {t('adminDisputes.evidenceRespondent')}:
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {selectedDispute.response_evidence_images.map((img, index) => (
                        <img
                          key={index}
                          src={img}
                        alt={`${t('adminDisputes.evidenceRespondent')}${index + 1}`}
                          style={{
                            width: '80px',
                            height: '80px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid #E0E0E0',
                            cursor: 'pointer'
                          }}
                          onClick={() => setPreviewImage(img)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {selectedDispute.status === 'appealed' && selectedDispute.appeal_description && (
                  <div style={{ fontSize: '14px', color: '#666666', marginBottom: '8px' }}>
                    {t('adminDisputes.appealDescription')}: {selectedDispute.appeal_description}
                  </div>
                )}
                {/* 申诉证据图片 */}
                {selectedDispute.status === 'appealed' && selectedDispute.appeal_evidence_images && Array.isArray(selectedDispute.appeal_evidence_images) && selectedDispute.appeal_evidence_images.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#999999', marginBottom: '4px' }}>
                      {t('adminDisputes.evidenceAppeal')}:
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {selectedDispute.appeal_evidence_images.map((img, index) => (
                        <img
                          key={index}
                          src={img}
                          alt={`${t('adminDisputes.evidenceAppeal')}${index + 1}`}
                          style={{
                            width: '80px',
                            height: '80px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid #E0E0E0',
                            cursor: 'pointer'
                          }}
                          onClick={() => setPreviewImage(img)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Form
                form={form}
                layout='vertical'
                onFinish={handleReviewSubmit}
                footer={
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Button
                      block
                      onClick={() => {
                        setShowReviewDialog(false);
                        setSelectedDispute(null);
                        form.resetFields();
                      }}
                    >
                      {t('adminDisputes.cancel')}
                    </Button>
                    <Button
                      block
                      type='submit'
                      color='primary'
                      loading={reviewing}
                    >
                      {t('adminDisputes.submit')}
                    </Button>
                  </div>
                }
              >
                <Form.Item
                  label={t('adminDisputes.auditResult')}
                  name='review_result'
                  rules={[{ required: true, message: t('adminDisputes.auditResult') }]}
                >
                  <Selector options={reviewResultOptions} />
                </Form.Item>

                <Form.Item
                  label={t('adminDisputes.auditReason')}
                  name='review_reason'
                  rules={[{ required: true, message: t('adminDisputes.auditReason') }]}
                >
                  <TextArea
                    rows={4}
                    placeholder={t('adminDisputes.auditReasonPlaceholder')}
                    showCount
                    maxLength={500}
                  />
                </Form.Item>
              </Form>
            </div>
          )
        }
        onClose={() => {
          setShowReviewDialog(false);
          setSelectedDispute(null);
          form.resetFields();
        }}
        closeOnAction
      />

      {/* 图片预览弹窗 */}
      {previewImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt={t('common.preview')}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '8px'
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            fill='none'
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              color: '#FFFFFF',
              fontSize: '24px',
              width: '40px',
              height: '40px',
              padding: 0,
              minWidth: '40px',
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '50%',
              border: 'none'
            }}
            onClick={() => setPreviewImage(null)}
          >
            ×
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminDisputes;

