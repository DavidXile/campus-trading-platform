import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Image, Tag } from 'antd-mobile';

const ItemCard = ({ item }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/item/${item.id}`);
  };

  // 统一图片比例 1:1
  const imgHeight = 180; 
  
  // 模拟数据
  const wantCount = Math.floor(Math.random() * 50) + 1;
  const tags = [];
  if (item.price < 50) tags.push('包邮');
  if (item.category === '电子产品') tags.push('保真');
  if (Math.random() > 0.7) tags.push('全新');

  return (
    <Card
      style={{
        margin: 0,
        cursor: 'pointer',
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        border: 'none',
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        '--body-padding': '0',
        transition: 'all 0.3s ease'
      }}
      onClick={handleClick}
    >
      {/* 物品图片 - 填满顶部 */}
      <div style={{ position: 'relative' }}>
        <Image
          src={item.image_url || '/placeholder-image.png'}
          fit='cover'
          width='100%'
          height={imgHeight}
          style={{ display: 'block' }}
          fallback={<div style={{
            width: '100%',
            height: `${imgHeight}px`,
            background: 'linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999999',
            fontSize: '48px',
            position: 'relative'
          }}>
            <div style={{ fontSize: '48px', opacity: 0.3 }}>📦</div>
            <div style={{ 
              fontSize: '12px', 
              marginTop: '8px',
              opacity: 0.5
            }}>暂无图片</div>
          </div>}
        />
      </div>

      <div style={{ padding: '12px' }}>
        {/* 物品信息 */}
        <h3 style={{
          fontSize: '15px',
          fontWeight: '600',
          color: '#1A1A1A',
          margin: '0 0 8px 0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          lineHeight: '1.4',
          minHeight: '42px'
        }}>
          {item.title}
        </h3>

        {/* 标签行 */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
            {tags.map((tag, idx) => (
              <Tag key={idx} color='primary' fill='outline' 
                style={{ 
                  fontSize: '9px', 
                  padding: '0 4px', 
                  '--border-color': '#00D4AA', 
                  '--text-color': '#00D4AA',
                  borderRadius: '4px'
                }}>
                {tag}
              </Tag>
            ))}
          </div>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          marginBottom: '10px'
        }}>
          <span style={{
            fontSize: '12px',
            color: '#FF6B35',
            fontWeight: '600',
            marginRight: '2px',
            verticalAlign: 'baseline'
          }}>¥</span>
          <span style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#FF6B35',
            fontFamily: 'DIN Alternate, "Roboto", -apple-system, sans-serif',
            letterSpacing: '-0.5px'
          }}>
            {item.price}
          </span>
        </div>

        <div style={{
          fontSize: '11px',
          color: '#999999',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '8px',
          borderTop: '1px solid #F0F0F0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
             <Image 
               src={`https://robohash.org/${item.seller_name}?set=set4`} 
               width={14} 
               height={14} 
               style={{ borderRadius: '50%' }}
               fit="cover"
             />
             <span style={{ 
               maxWidth: '60px', 
               overflow: 'hidden', 
               textOverflow: 'ellipsis', 
               whiteSpace: 'nowrap',
               color: '#999999'
             }}>
               {item.seller_name}
             </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
             <span style={{ color: '#999999', fontSize: '10px' }}>{wantCount}人想要</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ItemCard;








