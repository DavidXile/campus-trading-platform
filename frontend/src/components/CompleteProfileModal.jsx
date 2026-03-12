import React, { useEffect, useState } from 'react';
import { Popup, Input, Button, Toast } from 'antd-mobile';
import api from '../services/api';

const CompleteProfileModal = ({
  visible,
  user,
  forceComplete = false,
  onSuccess,
  onClose
}) => {
  const [phone, setPhone] = useState('');
  const [college, setCollege] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setPhone(user?.phone || '');
      setCollege(user?.college || '');
    }
  }, [visible, user]);

  const handleSubmit = async () => {
    const trimmedPhone = phone.trim();
    const trimmedCollege = college.trim();

    if (!trimmedPhone || !trimmedCollege) {
      Toast.show({
        icon: 'fail',
        content: '请完整填写手机号和学院信息'
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.put('/users/profile', {
        phone: trimmedPhone,
        college: trimmedCollege
      });

      Toast.show({
        icon: 'success',
        content: '资料已更新'
      });

      onSuccess?.(response.data.user);

      if (!forceComplete) {
        onClose?.();
      }
    } catch (error) {
      console.error('更新用户资料失败:', error);
      const message = error.response?.data?.message || '保存失败，请稍后重试';
      Toast.show({
        icon: 'fail',
        content: message
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Popup
      visible={visible}
      position='bottom'
      closeOnMaskClick={!forceComplete}
      onMaskClick={() => {
        if (!forceComplete) {
          onClose?.();
        }
      }}
      bodyStyle={{
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px',
        minHeight: '60vh',
        padding: '24px 16px'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
        <div>
          <h2 style={{ margin: 0 }}>{forceComplete ? '请先完善个人资料' : '完善个人资料'}</h2>
          <p style={{ color: '#666', marginTop: '8px' }}>
            请输入您的手机号和学院信息，完成后即可继续在平台进行买卖。
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ marginBottom: '6px', fontWeight: 500 }}>手机号</div>
            <Input
              value={phone}
              onChange={setPhone}
              placeholder='请输入手机号'
              clearable
            />
          </div>
          <div>
            <div style={{ marginBottom: '6px', fontWeight: 500 }}>学院</div>
            <Input
              value={college}
              onChange={setCollege}
              placeholder='请输入所属学院'
              clearable
            />
          </div>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Button
            color='primary'
            block
            onClick={handleSubmit}
            loading={submitting}
            disabled={submitting}
          >
            保存并继续
          </Button>
          {!forceComplete && (
            <Button
              block
              onClick={onClose}
              disabled={submitting}
            >
              取消
            </Button>
          )}
        </div>
      </div>
    </Popup>
  );
};

export default CompleteProfileModal;


