import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Tag } from 'antd-mobile';

const ErrandCard = ({ errand }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const getStatusColor = (status) => {
    const colors = {
      pending: '#00D4AA',
      accepted: '#4A90E2',
      completed: '#999999',
      cancelled: '#FF5722'
    };
    return colors[status] || '#999999';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: '待接单',
      accepted: '已接单',
      completed: '已完成',
      cancelled: '已取消'
    };
    return texts[status] || status;
  };

  return (
    <Card
      onClick={() => navigate(`/errand/${errand.id}`)}
      style={{ 
        marginBottom: '12px', 
        cursor: 'pointer',
        borderRadius: '16px',
        border: 'none',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        backgroundColor: '#FFFFFF',
        transition: 'all 0.3s ease',
        '--body-padding': '16px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08)';
      }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '12px' 
      }}>
        <div style={{ 
          fontSize: '17px', 
          fontWeight: '600', 
          color: '#1A1A1A',
          flex: 1,
          marginRight: '12px',
          lineHeight: '1.4'
        }}>
          {errand.title}
        </div>
        <Tag 
          style={{
            background: getStatusColor(errand.status),
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '12px',
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: '500',
            flexShrink: 0
          }}
        >
          {getStatusText(errand.status)}
        </Tag>
      </div>
      
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{ 
          fontSize: '24px', 
          fontWeight: '700', 
          color: '#FF6B35',
          fontFamily: 'DIN Alternate, "Roboto", -apple-system, sans-serif',
          letterSpacing: '-0.5px'
        }}>
          ¥{errand.reward}
        </div>
      </div>
      
      <div style={{ 
        fontSize: '14px', 
        color: '#666666', 
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{ fontSize: '16px' }}>📍</span>
        <span>{errand.location}</span>
      </div>
      
      {errand.destination && (
        <div style={{ 
          fontSize: '14px', 
          color: '#666666', 
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{ fontSize: '16px' }}>🎯</span>
          <span>{errand.destination}</span>
        </div>
      )}

      <div style={{ 
        borderTop: '1px solid #F0F0F0', 
        paddingTop: '12px', 
        marginTop: '12px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        fontSize: '12px', 
        color: '#999999' 
      }}>
        <span>{errand.category || '跑腿'}</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {errand.publisher_id && (
            <span
              onClick={(e) => {
                e.stopPropagation(); // 阻止卡片点击事件
                if (errand.publisher_id) {
                  navigate(`/seller/${errand.publisher_id}`);
                }
              }}
              style={{
                color: errand.publisher_username === '***' ? '#999999' : '#00D4AA',
                cursor: errand.publisher_username === '***' ? 'default' : 'pointer',
                fontWeight: '500',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => {
                if (errand.publisher_username !== '***') {
                  e.currentTarget.style.textDecoration = 'underline';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              {errand.publisher_username || t('errand.publisher')}
            </span>
          )}
          {errand.accepter_id && errand.status !== 'pending' && (
            <>
              <span style={{ color: '#CCCCCC' }}>·</span>
              <span
                onClick={(e) => {
                  e.stopPropagation(); // 阻止卡片点击事件
                  if (errand.accepter_id && errand.accepter_username !== '***') {
                    navigate(`/seller/${errand.accepter_id}`);
                  }
                }}
                style={{
                  color: errand.accepter_username === '***' ? '#999999' : '#00D4AA',
                  cursor: errand.accepter_username === '***' ? 'default' : 'pointer',
                  fontWeight: '500',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  if (errand.accepter_username !== '***') {
                    e.currentTarget.style.textDecoration = 'underline';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                {errand.accepter_username || t('errand.accepter')}
              </span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ErrandCard;
