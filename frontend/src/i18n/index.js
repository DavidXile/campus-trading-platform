import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh.json';
import en from './locales/en.json';

// 从 localStorage 获取保存的语言设置，默认为中文
const savedLanguage = localStorage.getItem('language') || 'zh';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      zh: {
        translation: zh
      },
      en: {
        translation: en
      }
    },
    lng: savedLanguage, // 默认语言
    fallbackLng: 'zh', // 回退语言
    interpolation: {
      escapeValue: false // React 已经转义了
    }
  });

export default i18n;

