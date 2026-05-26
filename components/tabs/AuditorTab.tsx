
import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity, RefreshCw, AlertTriangle, CheckCircle,
  Languages, BrainCircuit, Award, ShoppingBag,
  Layout, Globe, Mail, Facebook, Linkedin,
  Shield, Check, BookOpen, AlertCircle, Link as LinkIcon,
  ChevronDown, ChevronUp, ArrowRight, XCircle, FileText, List, MousePointerClick, Sparkles
} from 'lucide-react';
import { Brand, User, SystemPrompts, Guideline, AuditRule, Product } from '../../types';
import SectionHeader from '../SectionHeader';
import { BrandSelector, CustomSelect, MultiSelect } from '../UIComponents';
import { auditContent, scrapeWebsiteContent } from '../../services/api';
import { SUPPORTED_LANGUAGES, PLATFORM_CONFIGS } from '../../constants';
import { db } from '../../firebase';
import firebase from '../../firebase';
import { useTranslation } from 'react-i18next';

interface AuditorTabProps {
  availableBrands: Brand[];
  selectedBrandId: string;
  setSelectedBrandId: (id: string) => void;
  systemPrompts: SystemPrompts;
  currentUser: User;
  setToast: (toast: any) => void;
  guidelines: Guideline[];
  auditors: any[];
  auditRules: AuditRule[];
  persistentState: any;
  updatePersistentState: (data: any) => void;
}

const AuditorTab: React.FC<AuditorTabProps> = ({
  availableBrands,
  selectedBrandId,
  setSelectedBrandId,
  currentUser,
  setToast,
  auditRules,
  persistentState,
  updatePersistentState
}) => {
  const { t } = useTranslation();
  const [auditMode, setAuditMode] = useState<'text' | 'url'>(() => {
    return (sessionStorage.getItem('moodbiz_auditor_mode') as 'text' | 'url') || 'text';
  });

  const [platform, setPlatform] = useState(() => {
    return sessionStorage.getItem('moodbiz_auditor_platform') || 'Facebook Post';
  });

  const [language, setLanguage] = useState(() => {
    return sessionStorage.getItem('moodbiz_auditor_language') || 'Vietnamese';
  });

  // Derived from persistentState
  const inputText = persistentState.inputText || '';
  const setInputText = (val: string) => updatePersistentState({ inputText: val });

  const inputUrl = persistentState.inputUrl || '';
  const setInputUrl = (val: string) => updatePersistentState({ inputUrl: val });

  const selectedProductIds = persistentState.selectedProductIds || [];
  const setSelectedProductIds = (val: string[]) => updatePersistentState({ selectedProductIds: val });

  const auditResult = persistentState.auditResult || null;
  const setAuditResult = (val: any) => updatePersistentState({ auditResult: val });

  const [isAuditing, setIsAuditing] = useState(false);
  const [auditStatus, setAuditStatus] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);

  // Sync Global Prefs
  useEffect(() => {
    sessionStorage.setItem('moodbiz_auditor_mode', auditMode);
    sessionStorage.setItem('moodbiz_auditor_platform', platform);
    sessionStorage.setItem('moodbiz_auditor_language', language);
  }, [auditMode, platform, language]);

  useEffect(() => {
    if (!selectedBrandId) {
      setProducts([]);
      return;
    }
    const unsub = db.collection('products').where('brand_id', '==', selectedBrandId).onSnapshot(snap => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return unsub;
  }, [selectedBrandId]);

  const platformOptions = useMemo(() => {
    return Object.keys(PLATFORM_CONFIGS).map(key => {
      let icon = Layout;
      if (key.includes('Facebook')) icon = Facebook;
      if (key.includes('LinkedIn')) icon = Linkedin;
      if (key.includes('Email')) icon = Mail;
      if (key.includes('Website')) icon = Globe;
      return { value: key, label: key, icon };
    });
  }, []);

  const languageOptions = useMemo(() => {
    return SUPPORTED_LANGUAGES.map(l => ({
      value: l.code,
      label: t(`languages.${l.code.toLowerCase()}`)
    }));
  }, [t]);

  const productOptions = useMemo(() => {
    const opts = [{ value: '', label: t('auditor.select_product'), icon: Award }];
    products.forEach(p => {
      opts.push({ value: p.id, label: p.name, icon: ShoppingBag });
    });
    return opts;
  }, [products, t]);

  const handleAudit = async () => {
    const brand = availableBrands.find(b => b.id === selectedBrandId);
    if (!brand) { setToast({ type: 'error', message: t('auditor.select_brand_error') }); return; }

    if (auditMode === 'text' && !inputText.trim()) {
      setToast({ type: 'error', message: t('auditor.placeholder_text') }); return;
    }
    if (auditMode === 'url' && !inputUrl.trim()) {
      setToast({ type: 'error', message: t('auditor.url_label') }); return;
    }

    setIsAuditing(true);
    setAuditResult(null);

    let textToAnalyze = inputText;
    let urlToSave = '';

    try {
      if (auditMode === 'url') {
        setAuditStatus(t('auditor.scraping'));
        urlToSave = inputUrl.trim();
        if (!/^https?:\/\//i.test(urlToSave)) urlToSave = 'https://' + urlToSave;

        const scrapeResult = await scrapeWebsiteContent(urlToSave);
        const scrapedText = scrapeResult.text || '';

        if (!scrapedText || scrapedText.length < 50) {
          throw new Error(t('auditor.url_empty_error'));
        }
        textToAnalyze = scrapedText;
      }

      setAuditStatus(t('auditor.analyzing'));

      const targetProducts = products.filter(p => selectedProductIds.includes(p.id));

      const res = await auditContent({
        brand,
        text: textToAnalyze,
        platform,
        language,
        products: targetProducts,
        rules: auditRules,
        platformRules: PLATFORM_CONFIGS[platform]?.audit_rules
      });

      setAuditResult(res.result);

      const timestamp = Date.now();
      await db.collection('auditors').doc(`AUDIT_${brand.id}_${timestamp}`).set({
        id: `AUDIT_${brand.id}_${timestamp}`,
        brand_id: brand.id,
        brand_name: brand.name,
        user_id: currentUser.uid,
        user_name: currentUser.name || currentUser.displayName,
        input_data: {
          rawText: textToAnalyze,
          text: textToAnalyze,
          url: urlToSave,
          platform,
          language,
          product_ids: selectedProductIds
        },
        output_data: res.result,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        type: 'manual_audit'
      });

    } catch (e: any) {
      setToast({ type: 'error', message: t('auditor.audit_failed') + e.message });
    } finally {
      setIsAuditing(false);
      setAuditStatus('');
    }
  };

  const groupedIssues = useMemo(() => {
    const groups = {
      language: [] as any[],
      ai_logic: [] as any[],
      brand: [] as any[],
      product: [] as any[],
      legal: [] as any[]
    };

    if (auditResult?.identified_issues) {
      const issueMap = new Map<string, any>();

      auditResult.identified_issues.forEach((issue: any) => {
        const suggestion = (issue.suggestion || '').toLowerCase();
        if (suggestion.includes('giữ nguyên') || suggestion.includes('keep as is')) return;
        if (issue.suggestion?.trim() === issue.problematic_text?.trim()) return;

        const citationKey = (issue.citation || 'General').trim();
        const reasonKey = (issue.reason || 'Unknown').substring(0, 20).trim().toLowerCase();

        const uniqueKey = `${issue.category}|${citationKey}|${reasonKey}`;

        if (issueMap.has(uniqueKey)) {
          const existingIssue = issueMap.get(uniqueKey);
          const exists = existingIssue.occurrences.some((occ: any) => occ.text === issue.problematic_text);
          if (!exists) {
            existingIssue.occurrences.push({
              text: issue.problematic_text,
              suggestion: issue.suggestion
            });
            existingIssue.count = existingIssue.occurrences.length;
          }
        } else {
          issueMap.set(uniqueKey, {
            ...issue,
            count: 1,
            occurrences: [{ text: issue.problematic_text, suggestion: issue.suggestion }]
          });
        }
      });

      issueMap.forEach((issue) => {
        const cat = (issue.category || '').toLowerCase().trim();
        if (cat.includes('logic') || cat.includes('ai') || cat.includes('reasoning')) {
          groups.ai_logic.push(issue);
        } else if (cat.includes('brand') || cat.includes('tone')) {
          groups.brand.push(issue);
        } else if (cat.includes('product') || cat.includes('spec') || cat.includes('fact')) {
          groups.product.push(issue);
        } else if (cat.includes('legal') || cat.includes('law') || cat.includes('compliance')) {
          groups.legal.push(issue);
        } else {
          groups.language.push(issue);
        }
      });
    }
    return groups;
  }, [auditResult]);

  const ResultBlock = ({ title, icon: Icon, issues, colorClass, bgClass, borderColor }: any) => (
    <div className={`premium-card h-full flex flex-col overflow-hidden animate-in glow relative ${bgClass}`}>
      <div className={`px-8 py-7 border-b border-slate-100/50 flex items-center justify-between bg-white/60 backdrop-blur-2xl relative z-10`}>
        <div className="flex items-center gap-5">
          <div className={`p-4 rounded-[1.25rem] bg-white shadow-glow-hover ${colorClass} transform -rotate-3`}>
            <Icon size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h4 className="text-nav-caps group-hover:text-navy transition-colors">{title}</h4>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1 opacity-60">{t('auditor.verified_node')}</p>
          </div>
        </div>
        <div className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${issues.length > 0 ? 'bg-rose-50 text-rose-600 shadow-glow-rose border border-rose-100' : 'bg-emerald-50 text-emerald-600 shadow-glow-emerald border border-emerald-100'}`}>
          {issues.length > 0 ? `${issues.reduce((acc: number, i: any) => acc + (i.count || 1), 0)} ${t('auditor.risky_vectors')}` : t('auditor.passed')}
        </div>
      </div>

      <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-6 max-h-[600px] relative z-0">
        {issues.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-95 duration-700">
            <div className="w-24 h-24 bg-emerald-50/50 rounded-[2.5rem] flex items-center justify-center mb-6 rotate-6 shadow-inner-soft border border-emerald-100/50">
              <CheckCircle size={48} className="text-emerald-500 shadow-glow-emerald" strokeWidth={2.5} />
            </div>
            <p className="text-[13px] font-black text-emerald-600/60 uppercase tracking-[0.3em]">{t('auditor.compliance_verified')}</p>
          </div>
        ) : (
          issues.map((issue: any, idx: number) => (
            <div key={idx} className="bg-white rounded-[2rem] border border-slate-100 shadow-soft overflow-hidden group hover:border-cyan/30 hover:shadow-2xl transition-all duration-500">
              <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <AlertCircle size={16} className="text-rose-500 shrink-0 shadow-glow-rose" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate" title={issue.citation}>
                    {t('auditor.risky_vector_node')}: {issue.citation || 'General Constraint'}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {issue.count > 1 && (
                    <span className="px-3 py-1 rounded-full bg-navy text-white text-[9px] font-black flex items-center gap-2 shadow-glow">
                      <List size={12} /> {issue.count}
                    </span>
                  )}
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border-2 ${issue.severity?.toLowerCase() === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                    {issue.severity}
                  </span>
                </div>
              </div>

              <div className="p-8 space-y-6">
                {issue.count === 1 && (
                  <div className="space-y-6">
                    <div className="bg-rose-50/20 p-6 rounded-[1.5rem] border border-rose-100/30 flex items-start gap-5 group-hover:bg-rose-50/40 transition-colors relative">
                      <XCircle size={18} className="text-rose-500 shrink-0 mt-1 shadow-glow-rose" />
                      <div>
                        <p className="text-[15px] font-bold text-rose-900 leading-relaxed tracking-tight break-words">{issue.problematic_text}</p>
                        <span className="text-[9px] font-black text-rose-300 uppercase tracking-widest mt-3 block">{t('auditor.violation_detected')}</span>
                      </div>
                    </div>
                    <div className="flex justify-center -my-4 relative z-10">
                      <div className="bg-white border border-slate-100 rounded-2xl p-2.5 text-slate-300 shadow-xl group-hover:text-cyan group-hover:scale-110 transition-all duration-500">
                        <ArrowRight size={18} className="rotate-90" />
                      </div>
                    </div>
                    <div className="bg-emerald-50/20 p-6 rounded-[1.5rem] border border-emerald-100/30 flex items-start gap-5 group-hover:bg-emerald-50/40 transition-colors">
                      <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-1 shadow-glow-emerald" />
                      <div>
                        <p className="text-[15px] font-black text-emerald-900 leading-relaxed tracking-tight break-words">{issue.suggestion}</p>
                        <span className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mt-3 block">{t('auditor.proposal')}</span>
                      </div>
                    </div>
                  </div>
                )}

                {issue.count > 1 && (
                  <div className="bg-slate-50/40 rounded-[1.5rem] border border-slate-100 overflow-hidden max-h-80 overflow-y-auto custom-scrollbar shadow-inner-soft">
                    {issue.occurrences.map((occ: any, i: number) => (
                      <div key={i} className="p-6 border-b border-slate-100 last:border-0 hover:bg-white transition-all group/item">
                        <div className="flex items-start gap-4 mb-3">
                          <XCircle size={16} className="text-rose-400 mt-1 shrink-0" />
                          <p className="text-[14px] font-bold text-rose-800 leading-snug">"{occ.text}"</p>
                        </div>
                        <div className="flex items-start gap-4 pl-8">
                          <ArrowRight size={16} className="text-slate-300 mt-1 shrink-0" />
                          <p className="text-[14px] font-black text-emerald-800 leading-snug">{occ.suggestion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 pl-5 border-l-4 border-slate-100">
                  <p className="text-[13px] text-slate-400 font-bold italic leading-relaxed tracking-tight">
                    {issue.reason}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 flex flex-col space-y-8 h-full">
      <SectionHeader title={t('auditor.title')} subtitle={t('auditor.subtitle')} />

      {/* Input Group Section */}
      <div className="premium-card p-10 border-none shadow-premium bg-white/90 backdrop-blur-xl relative group">
        <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan/5 rounded-full blur-[100px] -mr-32 -mt-32" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start relative z-30">
          {/* Column 1: Brand, Products */}
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">{t('auditor.brand')}</p>
              <BrandSelector availableBrands={availableBrands} selectedBrandId={selectedBrandId} onChange={setSelectedBrandId} className="!rounded-2xl shadow-soft" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">{t('auditor.target_product')}</p>
              <MultiSelect
                options={productOptions}
                value={selectedProductIds}
                onChange={setSelectedProductIds}
                placeholder={t('auditor.select_product')}
                icon={ShoppingBag}
                className="!rounded-2xl shadow-soft"
              />
            </div>
          </div>

          {/* Column 2: Language, Platform, Mode toggle */}
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t('auditor.language')}</p>
              <CustomSelect options={languageOptions} value={language} onChange={setLanguage} icon={Globe} className="!rounded-2xl shadow-soft" />
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t('auditor.platform')}</p>
              <CustomSelect options={platformOptions} value={platform} onChange={setPlatform} className="!rounded-2xl shadow-soft" />
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t('auditor.method')}</p>
              <div className="flex bg-navy/5 p-1.5 rounded-[1.5rem] border border-slate-100 shadow-inner-soft">
                <button
                  onClick={() => { setAuditMode('text'); setAuditResult(null); setInputUrl(''); }}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 flex items-center justify-center gap-3 ${auditMode === 'text' ? 'bg-navy text-white shadow-glow scale-[1.02]' : 'text-slate-400 hover:text-navy hover:bg-white'}`}
                >
                  <FileText size={16} /> {t('auditor.text_mode')}
                </button>
                <button
                  onClick={() => { setAuditMode('url'); setAuditResult(null); setInputText(''); }}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 flex items-center justify-center gap-3 ${auditMode === 'url' ? 'bg-navy text-white shadow-glow scale-[1.02]' : 'text-slate-400 hover:text-navy hover:bg-white'}`}
                >
                  <LinkIcon size={16} /> {t('auditor.url_mode')}
                </button>
              </div>
            </div>
          </div>

          {/* Column 3: Input + Audit button */}
          <div className="flex flex-col gap-4">
            {auditMode === 'text' ? (
              <div className="flex flex-col gap-3 flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t('auditor.placeholder_text')}</p>
                <textarea
                  className="flex-1 w-full bg-slate-50/50 border border-slate-200 rounded-3xl p-5 min-h-[160px] text-[14px] font-bold text-navy placeholder:text-slate-300 focus:bg-white focus:ring-12 focus:ring-cyan/5 transition-all custom-scrollbar outline-none shadow-inner-soft italic leading-relaxed resize-none"
                  placeholder={t('auditor.placeholder_text')}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t('auditor.url_label')}</p>
                <div className="relative group/url">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/url:text-cyan transition-colors">
                    <Globe size={18} />
                  </div>
                  <input
                    className="w-full pl-16 pr-8 py-5 bg-slate-50/50 border border-slate-200 rounded-full text-[14px] font-black text-navy outline-none focus:ring-12 focus:ring-cyan/5 focus:bg-white transition-all shadow-inner-soft placeholder:text-slate-300"
                    placeholder="https://staging.moodbiz.vn/"
                    value={inputUrl}
                    onChange={e => setInputUrl(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleAudit()}
                  />
                </div>
              </div>
            )}
            <button
              onClick={handleAudit}
              disabled={isAuditing || (auditMode === 'text' ? !inputText.trim() : !inputUrl.trim())}
              className="w-full py-5 bg-navy text-white rounded-3xl font-black text-[12px] flex justify-center items-center gap-3 shadow-2xl hover:shadow-cyan/10 transition-all duration-700 active:scale-[0.98] disabled:opacity-30 uppercase tracking-[0.3em] relative overflow-hidden border border-white/10 group/btn"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan/20 via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
              {isAuditing ? <RefreshCw className="animate-spin text-cyan" size={20} /> : <Activity size={20} className="text-cyan drop-shadow-glow" />}
              <span className="relative z-10">{isAuditing ? (auditStatus || t('auditor.processing')) : (auditMode === 'url' ? t('auditor.scan_endpoint') : t('auditor.start_audit'))}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Result Area */}
      <div className="flex-1 min-h-[600px] pb-32">
        {isAuditing ? (
          <div className="h-full flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
            <div className="relative">
              <div className="w-32 h-32 border-8 border-slate-50 border-t-cyan rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-navy rounded-[2rem] flex items-center justify-center shadow-glow animate-pulse">
                  <Activity size={32} className="text-cyan drop-shadow-glow" />
                </div>
              </div>
            </div>
            <div className="text-center mt-12 space-y-4">
              <h3 className="text-2xl font-black text-navy uppercase tracking-tighter italic">{t('auditor.processing')}</h3>
              <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.5em] animate-pulse">
                {auditStatus}
              </p>
            </div>
          </div>
        ) : auditResult ? (
          <div className="flex flex-col gap-10 animate-in slide-in-from-bottom-12 duration-1000">
            <div className="bg-navy rounded-[3rem] p-10 md:p-14 shadow-2xl relative overflow-hidden group border border-white/10">
              <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan/10 rounded-full blur-[150px] -mr-64 -mt-64 pointer-events-none transition-colors duration-1000 group-hover:bg-cyan/15" />
              <div className="relative z-10 flex flex-col xl:flex-row items-center justify-between gap-10">
                <div className="max-w-3xl text-center xl:text-left">
                  <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-cyan text-[9px] font-black uppercase tracking-[0.3em] mb-8 shadow-inner-soft">
                    <Sparkles size={14} className="animate-pulse" />
                    {t('auditor.result_title')}
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none mb-6">{t('auditor.deep_analysis')}</h2>
                  <p className="text-white/60 text-base font-medium leading-relaxed italic max-w-xl mx-auto xl:mx-0">"{auditResult.summary}"</p>
                </div>
                <div className="bg-white/5 backdrop-blur-3xl rounded-[2.5rem] p-10 border border-white/10 text-center min-w-[200px] shadow-premium group-hover:scale-110 transition-all duration-700">
                  <div className="text-7xl font-black text-white leading-none tracking-tighter drop-shadow-glow drop-shadow-cyan/40 mb-2">
                    {groupedIssues.language.length + groupedIssues.ai_logic.length + groupedIssues.brand.length + groupedIssues.product.length + groupedIssues.legal.length}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan/70 italic">{t('auditor.issues_found')}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <ResultBlock title={t('auditor.blocks.language')} icon={Languages} issues={groupedIssues.language} colorClass="text-blue-500" bgClass="bg-white/90" />
              <ResultBlock title={t('auditor.blocks.ai_logic')} icon={BrainCircuit} issues={groupedIssues.ai_logic} colorClass="text-purple-500" bgClass="bg-white/90" />
              <ResultBlock title={t('auditor.blocks.brand')} icon={Award} issues={groupedIssues.brand} colorClass="text-cyan" bgClass="bg-white/90" />
              <ResultBlock title={t('auditor.blocks.product')} icon={ShoppingBag} issues={groupedIssues.product} colorClass="text-emerald-500" bgClass="bg-white/90" />
              <div className="md:col-span-2">
                <ResultBlock title={t('auditor.blocks.legal')} icon={Shield} issues={groupedIssues.legal} colorClass="text-rose-500" bgClass="bg-white/90" />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full premium-card border-none bg-slate-50/10 backdrop-blur-3xl shadow-inner-soft flex flex-col items-center justify-center text-slate-300 p-24 group transition-all duration-1000">
            <div className="w-40 h-40 bg-white rounded-[3.5rem] shadow-2xl flex items-center justify-center mb-12 text-slate-50 group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000 relative">
              <div className="absolute inset-0 rounded-[inherit] border-4 border-dashed border-slate-100 animate-rotate-slow opacity-30" />
              <Shield size={64} strokeWidth={0.5} className="group-hover:rotate-6 transition-transform relative z-10" />
            </div>
            <h3 className="font-black text-navy text-3xl mb-4 tracking-tighter uppercase opacity-30 italic">{t('auditor.title')}</h3>
            <p className="text-[15px] text-slate-400 text-center max-w-sm font-bold leading-relaxed tracking-tight italic opacity-60">
              {t('auditor.waiting_data')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditorTab;