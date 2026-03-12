import React, { useState } from 'react';
import { Input } from 'antd-mobile';

const PasswordInput = ({ value, onChange, placeholder, style, ...props }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          ...style,
          paddingRight: '40px' // 为眼睛图标留出空间
        }}
        {...props}
      />
      <div
        onClick={() => setVisible(!visible)}
        style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          cursor: 'pointer',
          fontSize: '18px',
          color: '#999999',
          zIndex: 1,
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px'
        }}
      >
        {visible ? '👁️' : '👁️‍🗨️'}
      </div>
    </div>
  );
};

export default PasswordInput;

