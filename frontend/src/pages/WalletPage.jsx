import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  List,
  Button,
  Toast,
  Loading,
  ErrorBlock,
  Input,
  NavBar,
  Popup
} from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import useUserStore from '../store/userStore';

const WalletPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, updateUser } = useUserStore();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [depositDialogVisible, setDepositDialogVisible] = useState(false);

  const fetchWalletInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/users/wallet/info');
      
      if (response.data.success) {
        const newBalance = response.data.balance || 0;
        setBalance(newBalance);
        setTransactions(response.data.transactions || []);
        // 使用 updateUser 更新全局状态
        updateUser({ wallet_balance: newBalance });
      } else {
        setError(response.data.message || t('wallet.fetchFailed'));
      }
    } catch (err) {
      console.error('获取钱包信息失败:', err);
      const errorMessage = err.response?.data?.message || err.message || t('wallet.fetchFailed');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchWalletInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleDeposit = () => {
    setDepositAmount('');
    setDepositDialogVisible(true);
  };

  const handleDepositConfirm = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      Toast.show({ icon: 'fail', content: t('wallet.depositAmountInvalid') });
      return;
    }
    if (amount > 10000) {
      Toast.show({ icon: 'fail', content: t('wallet.depositAmountExceeded') });
      return;
    }

    try {
      setDepositing(true);
      const response = await api.post('/users/wallet/deposit', { amount });
      if (response.data.success) {
        updateUser({ wallet_balance: response.data.balance });
        Toast.show({
          icon: 'success',
          content: t('wallet.depositSuccess', { balance: response.data.balance.toFixed(2) })
        });
        setDepositAmount('');
        setDepositDialogVisible(false);
        fetchWalletInfo();
      }
    } catch (err) {
      Toast.show({
        icon: 'fail',
        content: err.response?.data?.message || t('wallet.depositFailed')
      });
    } finally {
      setDepositing(false);
    }
  };

  const getTransactionTypeText = (type, amount, description) => {
    // 对于 purchase 类型，根据金额正负和描述判断是购买还是出售
    if (type === 'purchase') {
      if (amount > 0 || (description && description.includes('出售商品收入'))) {
        return t('wallet.transactionType.sale') || '出售商品';
      } else {
        return t('wallet.transactionType.purchase') || '购买商品';
      }
    }
    
    const typeMap = {
      'purchase': t('wallet.transactionType.purchase'),
      'refund': t('wallet.transactionType.refund'),
      'partial_refund': t('wallet.transactionType.partialRefund'),
      'credit_adjustment': t('wallet.transactionType.deposit'),
      'deposit': t('wallet.transactionType.deposit'),
      'errand_reward': t('wallet.transactionType.errandReward')
    };
    return typeMap[type] || type;
  };

  const getTransactionColor = (type, amount) => {
    // 根据金额正负判断颜色：正数（收入）绿色，负数（支出）红色
    if (amount > 0) {
      return '#00D4AA'; // 绿色 - 收入
    } else if (amount < 0) {
      return '#FF4444'; // 红色 - 支出
    }
    
    // 对于金额为0的情况，根据类型判断
    const incomeTypes = ['credit_adjustment', 'deposit', 'refund', 'partial_refund', 'errand_reward'];
    return incomeTypes.includes(type) ? '#00D4AA' : '#FF4444';
  };

  if (loading) {
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
        <NavBar onBack={() => navigate(-1)}>{t('wallet.title')}</NavBar>
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
      <NavBar onBack={() => navigate(-1)}>{t('wallet.title')}</NavBar>

      <Card style={{
        margin: '16px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
        color: '#FFFFFF',
        padding: '24px'
      }}>
        <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>
          {t('wallet.balance')}
        </div>
        <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '16px' }}>
          ¥{balance.toFixed(2)}
        </div>
        <Button
          color='primary'
          fill='outline'
          onClick={handleDeposit}
          loading={depositing}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderColor: '#FFFFFF',
            color: '#FFFFFF',
            borderRadius: '12px'
          }}
        >
          {t('wallet.deposit')}
        </Button>
      </Card>

      <Card style={{
        margin: '16px',
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
      }}>
        <div style={{
          fontSize: '18px',
          fontWeight: '600',
          padding: '16px',
          borderBottom: '1px solid #F0F0F0'
        }}>
          {t('wallet.transactionHistory')}
        </div>
        {transactions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
            {t('wallet.noTransactions')}
          </div>
        ) : (
          <List>
            {transactions.map((tx) => (
              <List.Item
                key={tx.id}
                extra={
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: getTransactionColor(tx.type, tx.amount)
                  }}>
                    {tx.amount > 0 ? '+' : tx.amount < 0 ? '-' : ''}¥{Math.abs(tx.amount).toFixed(2)}
                  </div>
                }
              >
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>
                    {getTransactionTypeText(tx.type, tx.amount, tx.description)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
                    {tx.description}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {new Date(tx.created_at).toLocaleString()}
                  </div>
                </div>
              </List.Item>
            ))}
          </List>
        )}
      </Card>

      <Popup
        visible={depositDialogVisible}
        onMaskClick={() => setDepositDialogVisible(false)}
        bodyStyle={{ padding: '20px' }}
      >
        <div>
          <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            {t('wallet.deposit')}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
            {t('wallet.currentBalance')}: ¥{balance.toFixed(2)}
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>{t('wallet.depositAmount')}</div>
            <Input
              type='number'
              placeholder={t('wallet.depositAmountPlaceholder')}
              value={depositAmount}
              onChange={setDepositAmount}
            />
            <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
              {t('wallet.depositHint')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <Button
              block
              onClick={() => setDepositDialogVisible(false)}
              style={{ borderRadius: '12px' }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              block
              color='primary'
              onClick={handleDepositConfirm}
              loading={depositing}
              style={{ borderRadius: '12px' }}
            >
              {t('wallet.confirmDeposit')}
            </Button>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default WalletPage;
