
import React, { useState, useMemo } from 'react';
import {
    Search, Loader2, Globe, ExternalLink, Sparkles,
    BookOpen, ListTree,
    Copy, CheckCheck, Trash2, Link2
} from 'lucide-react';
// @ts-ignore
import ReactMarkdown from 'react-markdown';
import { runResearch } from '../../services/api';
import { SUPPORTED_LANGUAGES } from '../../constants';
import { User } from '../../types';
import SectionHeader from '../SectionHeader';
import { CustomSelect } from '../UIComponents';
import { useTranslation } from 'react-i18next';

interface ResearchResult {
    analysis: string;
    sources: { title: string; url: string }[];
}

interface ResearchTabProps {
    currentUser: User;
    setToast: (toast: any) => void;
}

const ResearchTab: React.FC<ResearchTabProps> = ({
    currentUser,
    setToast
}) => {
    const { t } = useTranslation();
    const [keyword, setKeyword] = useState('');
    const [manualUrls, setManualUrls] = useState<string[]>(['']);
    const [language, setLanguage] = useState('Vietnamese');

    const languageOptions = useMemo(() => {
        return SUPPORTED_LANGUAGES.map(l => ({
            value: l.code,
            label: t(`languages.${l.code.toLowerCase()}`)
        }));
    }, [t]);

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ResearchResult | null>(null);
    const [copied, setCopied] = useState(false);

    const handleSearch = async () => {
        const validUrls = manualUrls.filter(u => u.trim() !== '').map(u => {
            let target = u.trim();
            if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
            return target;
        });

        if (validUrls.length === 0) {
            setToast({ type: 'error', message: t('research.error_url') });
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const data = await runResearch(
                keyword,
                language === 'Vietnamese' ? 'vi' : 'en',
                validUrls
            );
            setResult(data);
            setToast({ type: 'success', message: t('research.success_analyze') });
        } catch (err: any) {
            setToast({ type: 'error', message: err.message });
        } finally {
            setLoading(false);
        }
    };

    const addUrlInput = () => {
        if (manualUrls.length < 5) {
            setManualUrls([...manualUrls, '']);
        } else {
            setToast({ type: 'warning', message: t('research.max_url_error') });
        }
    };

    const removeUrlInput = (index: number) => {
        const newUrls = manualUrls.filter((_, i) => i !== index);
        setManualUrls(newUrls.length ? newUrls : ['']);
    };

    const updateUrlInput = (index: number, value: string) => {
        const newUrls = [...manualUrls];
        newUrls[index] = value;
        setManualUrls(newUrls);
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        setToast({ type: 'success', message: t('research.copy_success') });
    };

    const isReady = manualUrls.some(u => u.trim() !== '');

    return (
        <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 flex flex-col space-y-8">
            <SectionHeader
                title={t('research.title')}
                subtitle={t('research.subtitle')}
            />

            {/* Input Grid Section */}
            <div className="premium-card p-10 border-none shadow-premium bg-white/90 backdrop-blur-xl relative group">
                <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-cyan/5 rounded-full blur-[100px] -mr-32 -mt-32" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start relative z-30">
                    {/* Column 1: URL Inputs */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-4 ml-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('research.url_label')} <span className="text-rose-500">*</span></p>
                            <button
                                onClick={addUrlInput}
                                className="text-[10px] font-black text-cyan uppercase tracking-widest hover:text-navy transition-all flex items-center gap-2 group/add"
                                disabled={manualUrls.length >= 5}
                            >
                                <Sparkles size={12} className="group-hover/add:rotate-12 transition-transform" /> {t('research.add_url')}
                            </button>
                        </div>
                        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                            {manualUrls.map((mUrl, index) => (
                                <div key={index} className="relative group/url">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/url:text-cyan transition-colors">
                                        <Link2 size={14} />
                                    </div>
                                    <input
                                        type="text"
                                        value={mUrl}
                                        onChange={(e) => updateUrlInput(index, e.target.value)}
                                        placeholder={`https://website-${index + 1}.com`}
                                        className="w-full pl-10 pr-10 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl text-[13px] font-bold text-navy outline-none focus:bg-white focus:ring-8 focus:ring-cyan/5 focus:border-cyan/30 transition-all shadow-inner-soft placeholder:text-slate-300 leading-none"
                                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                    {manualUrls.length > 1 && (
                                        <button
                                            onClick={() => removeUrlInput(index)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-200 hover:text-rose-500 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Column 2: Context & Language */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t('research.keyword_label')}</p>
                            <div className="relative group/kw">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/kw:text-cyan transition-colors">
                                    <Search size={14} />
                                </div>
                                <input
                                    type="text"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    placeholder={t('research.keyword_placeholder')}
                                    className="w-full pl-10 pr-5 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl text-[13px] font-bold text-navy outline-none focus:bg-white focus:ring-8 focus:ring-cyan/5 focus:border-cyan/30 transition-all shadow-inner-soft placeholder:text-slate-300 leading-none"
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t('research.language')}</p>
                            <CustomSelect
                                options={languageOptions}
                                value={language}
                                onChange={setLanguage}
                                icon={Globe}
                                className="!rounded-2xl shadow-soft"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                    <p className="text-[11px] text-slate-400 font-bold italic max-w-md leading-relaxed">
                        {t('research.waiting_data')}
                    </p>
                    <button
                        onClick={handleSearch}
                        disabled={loading || !isReady}
                        className={`min-w-[280px] py-6 bg-navy text-white rounded-[2rem] font-black text-[12px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 transition-all duration-700 active:scale-[0.98] shadow-2xl hover:shadow-cyan/10 disabled:opacity-30 relative overflow-hidden group/btn border border-white/10`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan/20 via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                        {loading ? <Loader2 size={20} className="animate-spin text-cyan" /> : <><Sparkles size={20} className="text-cyan drop-shadow-glow" /> <span className="relative z-10">{t('research.start_analyze')}</span></>}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[600px] w-full">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
                        <div className="relative">
                            <div className="w-32 h-32 border-8 border-slate-50 border-t-cyan rounded-full animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-16 h-16 bg-navy rounded-[2rem] flex items-center justify-center shadow-glow animate-pulse">
                                    <Search size={32} className="text-cyan drop-shadow-glow" />
                                </div>
                            </div>
                        </div>
                        <div className="text-center mt-12 space-y-4">
                            <h3 className="text-2xl font-black text-navy uppercase tracking-tighter italic">{t('research.analyzing')}</h3>
                            <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.5em] animate-pulse">
                                {t('research.analyzing_desc')}
                            </p>
                        </div>
                    </div>
                ) : result ? (
                    <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-12 duration-1000">
                        {/* Main Analysis */}
                        <div className="bg-white rounded-[3rem] shadow-premium border border-slate-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan/5 rounded-full blur-[120px] -mr-64 -mt-64 pointer-events-none transition-all duration-1000 group-hover:bg-cyan/10" />

                            <div className="bg-navy px-10 py-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 shrink-0 relative overflow-hidden">
                                <div className="absolute inset-0 bg-cyan/5 opacity-50 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />

                                <div className="flex items-center gap-8 relative z-10">
                                    <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 text-cyan flex items-center justify-center shadow-glow shadow-cyan/20 transform -rotate-6">
                                        <BookOpen size={30} className="drop-shadow-glow" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-none mb-3">
                                            AI <span className="text-cyan drop-shadow-glow">Synthesis</span>
                                        </h3>
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-cyan/70 text-[9px] font-black uppercase tracking-widest">
                                            <Sparkles size={12} className="animate-pulse" />
                                            {t('research.result_subtitle')}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 relative z-10">
                                    <button
                                        onClick={() => handleCopy(result.analysis)}
                                        className="p-4 bg-white/5 hover:bg-cyan hover:text-white rounded-2xl text-cyan border border-white/10 transition-all duration-500 transform active:scale-95 shadow-xl"
                                    >
                                        {copied ? <CheckCheck size={20} /> : <Copy size={20} />}
                                    </button>
                                    <button
                                        onClick={() => setResult(null)}
                                        className="p-4 bg-white/5 hover:bg-rose-500 hover:text-white rounded-2xl text-rose-400 border border-white/10 transition-all duration-500 transform active:scale-95 shadow-xl"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-10 md:p-16 relative z-10">
                                <div className="text-prose-premium prose-navy max-w-none">
                                    <ReactMarkdown
                                        components={{
                                            h2: ({ node, ...props }) => (
                                                <h2 {...props} className="text-navy group/h2 mb-8 flex items-center gap-4">
                                                    <span className="w-1.5 h-8 bg-cyan rounded-full inline-block group-hover/h2:scale-y-125 transition-transform origin-bottom shadow-glow" />
                                                    {props.children}
                                                </h2>
                                            )
                                        }}
                                    >
                                        {result.analysis}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>

                        {/* Sources List */}
                        <div className="bg-navy rounded-[3rem] p-10 md:p-12 text-white shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan/10 rounded-full blur-[150px] -mr-48 -mt-48 pointer-events-none" />

                            <h4 className="text-[10px] font-black text-cyan uppercase tracking-widest mb-10 flex items-center gap-4 relative z-10">
                                <div className="p-2 rounded-lg bg-cyan/20 text-cyan"><ListTree size={16} /></div>
                                {t('research.sources_title')}
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                                {result.sources.map((source, idx) => (
                                    <a
                                        key={idx}
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-start gap-5 p-5 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all group/source shadow-inner-soft"
                                    >
                                        <div className="w-10 h-10 rounded-2xl bg-cyan/10 border border-cyan/20 flex items-center justify-center text-cyan font-black text-base shrink-0 group-hover/source:bg-cyan group-hover/source:text-white transition-all duration-500">
                                            {idx + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] font-black uppercase tracking-tight truncate group-hover/source:text-cyan transition-colors mb-1.5">{source.title}</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[9px] text-white/30 truncate uppercase font-black tracking-widest italic leading-none">
                                                    {new URL(source.url).hostname}
                                                </p>
                                                <ExternalLink size={10} className="text-white/20 group-hover/source:text-cyan transition-all" />
                                            </div>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full premium-card border-none bg-slate-50/10 backdrop-blur-3xl shadow-inner-soft flex flex-col items-center justify-center text-slate-300 p-24 group transition-all duration-1000">
                        <div className="w-40 h-40 bg-white rounded-[3.5rem] shadow-2xl flex items-center justify-center mb-12 text-slate-50 group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000 relative">
                            <div className="absolute inset-0 rounded-[inherit] border-4 border-dashed border-slate-100 animate-rotate-slow opacity-30" />
                            <Search size={64} strokeWidth={0.5} className="group-hover:rotate-6 transition-transform relative z-10" />
                        </div>
                        <h3 className="font-black text-navy text-3xl mb-4 tracking-tighter uppercase opacity-30 italic">{t('research.title')}</h3>
                        <p className="text-[15px] text-slate-400 text-center max-w-sm font-bold leading-relaxed tracking-tight italic opacity-60">
                            {t('research.waiting_data')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResearchTab;
