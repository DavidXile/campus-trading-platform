import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionSheet } from 'antd-mobile';

const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const languages = [
    { code: 'zh', label: '中文' },
    { code: 'en', label: 'English' }
  ];

  const handleLanguageChange = (langCode) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('language', langCode);
    setVisible(false);
  };

  const actions = languages.map(lang => ({
    text: lang.label + (i18n.language === lang.code ? ' ✓' : ''),
    key: lang.code,
    onClick: () => handleLanguageChange(lang.code)
  }));

  return (
    <>
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: '4px',
          userSelect: 'none',
          transition: 'background-color 0.2s'
        }}
        onClick={() => setVisible(true)}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span style={{ fontSize: '14px' }}>🌐</span>
        <span style={{ fontSize: '14px' }}>{i18n.language === 'zh' ? '中文' : 'English'}</span>
      </div>
      
      <ActionSheet
        visible={visible}
        actions={actions}
        onClose={() => setVisible(false)}
        onAction={(action) => {
          if (action.key) {
            handleLanguageChange(action.key);
          }
        }}
      />
    </>
  );
};

export default LanguageSwitcher;

