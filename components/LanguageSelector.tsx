import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, ChevronDown } from 'lucide-react';

const LanguageSelector: React.FC = () => {
    const { i18n, t } = useTranslation();

    const toggleLanguage = () => {
        const nextLang = i18n.language === 'en' ? 'vi' : 'en';
        i18n.changeLanguage(nextLang);
    };

    const currentLang = i18n.language?.startsWith('en') ? 'EN' : 'VI';
    const langLabel = i18n.language?.startsWith('en') ? t('languages.english') : t('languages.vietnamese');
    const flag = currentLang === 'EN' ? '🇺🇸' : '🇻🇳';

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-3 px-4 py-2 rounded-xl bg-cyan/10 border border-cyan/20 hover:bg-cyan/20 hover:border-cyan/30 transition-all group"
            title={t('common.switch_language')}
        >
            <Languages size={16} className="text-cyan group-hover:scale-110 transition-transform" />
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-navy">
                    {flag} {langLabel}
                </span>
            </div>
        </button>
    );
};

export default LanguageSelector;
