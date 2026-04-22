import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye, FileText, X, Copy, Activity, RefreshCw, Filter,
  BookOpen, Search, Calendar, User as UserIcon, MessageSquare,
  ChevronRight, Sparkles, Layout, Facebook, Globe, Mail, Linkedin, PenTool, Languages, ArrowRight, CheckCircle, Check
} from 'lucide-react';
// @ts-ignore
import ReactMarkdown from 'react-markdown';
import { Generation, User, Brand, SystemPrompts, Auditor, Guideline, AuditRule } from '../../types';
import SectionHeader from '../SectionHeader';
import { CommentSection, BrandSelector } from '../UIComponents';
import { db } from '../../firebase';
import { addCommentToGeneration, auditContent } from '../../services/api';
import { PLATFORM_CONFIGS } from '../../constants';
import { useTranslation } from 'react-i18next';

interface HistoryGenerationsTabProps {
  generations: Generation[];
  brands: Brand[];
  availableBrands: Brand[];
  setToast: (toast: any) => void;
  currentUser?: User;
  systemPrompts: SystemPrompts;
  auditors: Auditor[];
  guidelines: Guideline[];
  auditRules: AuditRule[];
}

const HistoryGenerationsTab: React.FC<HistoryGenerationsTabProps> = ({
  generations, brands, availableBrands, setToast, currentUser,
  systemPrompts, auditors, guidelines, auditRules
}) => {
  const { t, i18n } = useTranslation();
  const [selectedGenerationsFilterBrand, setSelectedGenerationsFilterBrand] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null);
  const [isGenDetailOpen, setIsGenDetailOpen] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const formatTimestamp = (ts: any) => {
    if (!ts) return { full: '', time: '', date: '' };
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      const curLang = i18n.language === 'en' ? 'en-US' : 'vi-VN';
      return {
        full: date.toLocaleString(curLang),
        time: date.toLocaleTimeString(curLang, { hour: '2-digit', minute: '2-digit' }),
        date: date.toLocaleDateString(curLang, { day: '2-digit', month: '2-digit', year: 'numeric' })
      };
    } catch (e) { return { full: '', time: '', date: '' }; }
  };

  const getPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('facebook')) return <Facebook size={22} className="text-blue-600" />;
    if (p.includes('linkedin')) return <Linkedin size={22} className="text-blue-700" />;
    if (p.includes('web') || p.includes('seo')) return <Globe size={22} className="text-emerald-600" />;
    if (p.includes('email')) return <Mail size={22} className="text-amber-600" />;
    return <PenTool size={22} className="text-slate-600" />;
  };

  const filteredGenerations = useMemo(() => {
    return generations.filter(g => {
      const matchesBrand = selectedGenerationsFilterBrand === 'all' || g.brand_id === selectedGenerationsFilterBrand;
      const matchesSearch = g.input_data.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.input_data.platform.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesBrand && matchesSearch;
    });
  }, [generations, selectedGenerationsFilterBrand, searchTerm]);

  const handleCopy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setToast({ type: 'success', message: t('history.generations.copy_success') });
    } catch (err) {
      setToast({ type: 'error', message: t('history.generations.copy_error') });
    }
  };

  const handleQuickAudit = async () => {
    if (!selectedGeneration) return;
    const brand = brands.find(b => b.id === selectedGeneration.brand_id);
    if (!brand) return;

    setIsAuditing(true);
    setAuditResult(null);

    const platform = selectedGeneration.input_data.platform || 'General';
    const platformRules = PLATFORM_CONFIGS[platform]?.audit_rules || t('history.generations.common_content_rules');

    const approvedGuide = guidelines.find(g => g.brand_id === brand.id && g.status === 'approved');
    const guideContext = approvedGuide?.guideline_text ? `GUIDELINE:\n${approvedGuide.guideline_text}\n` : '';

    const isWebsite = platform.toLowerCase().includes('web');

    // Better logic to find prompt
    let basePrompt = systemPrompts.auditor[platform];
    if (!basePrompt) {
      if (isWebsite) basePrompt = systemPrompts.auditor['Website / SEO Blog'];
      else basePrompt = systemPrompts.auditor['Facebook Post'];
    }
    // Final fallback
    if (!basePrompt) {
      basePrompt = "AUDIT THIS:\n\n{text}\n\nRULES:\n{sop_rules}\n\nBRAND:\n{brand_name}";
    }

    // Construct SOP rules string
    const sopRulesText = auditRules && auditRules.length > 0
      ? auditRules.map(r => `### ${r.label}\n${r.content}`).join('\n\n')
      : t('history.audits.empty_desc');

    const prompt = basePrompt
      .replace(/{text}/g, selectedGeneration.output_data)
      .replace(/{sop_rules}/g, sopRulesText)
      .replace(/{dynamic_rules}/g, sopRulesText) // Backward compatibility
      .replace(/{brand_name}/g, brand.name)
      .replace(/{brand_personality}/g, brand.brand_personality?.join(', ') || brand.personality)
      .replace(/{brand_voice}/g, brand.tone_of_voice || brand.voice)
      .replace(/{core_values}/g, brand.core_values?.join(', ') || 'N/A')
      .replace(/{do_words}/g, brand.do_words?.join(', ') || 'N/A')
      .replace(/{dont_words}/g, brand.dont_words?.join(', ') || 'N/A')
      .replace(/{guideline}/g, guideContext)
      .replace(/{platform}/g, platform)
      .replace(/{platform_audit_rules}/g, platformRules)
      .replace(/{product_context}/g, t('history.generations.brand_context'));

    try {
      const res = await auditContent({ brand, contentType: isWebsite ? 'website' : 'social', prompt });
      let outputData = res.result;
      if (typeof outputData === 'string') {
        try { outputData = JSON.parse(outputData.replace(/```json?/gi, '').replace(/```/g, '')); }
        catch { outputData = { summary: outputData }; }
      }
      setAuditResult(outputData);
    } catch (e: any) {
      setToast({ type: 'error', message: t('history.generations.audit_failed') });
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <>
      <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 flex flex-col h-full">
        <SectionHeader title={t('history.generations.title')} subtitle={t('history.generations.subtitle')}>
          <div className="flex flex-col lg:flex-row items-center gap-6 w-full lg:w-auto">
            <div className="relative group w-full lg:w-[450px]">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-cyan group-focus-within:scale-110 transition-all duration-500" size={20} />
              <input
                type="text"
                placeholder={t('history.generations.search_placeholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-8 py-5 bg-white border border-slate-100 rounded-[2rem] text-[15px] font-bold text-navy outline-none focus:ring-12 focus:ring-cyan/5 focus:border-cyan/30 transition-all shadow-premium placeholder:text-slate-300 italic"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-focus-within:opacity-100 transition-opacity">
                <div className="w-1 h-1 rounded-full bg-cyan animate-pulse" />
                <div className="w-1 h-1 rounded-full bg-cyan animate-pulse delay-75" />
                <div className="w-1 h-1 rounded-full bg-cyan animate-pulse delay-150" />
              </div>
            </div>
            <div className="w-full lg:w-72">
              <BrandSelector
                availableBrands={availableBrands}
                selectedBrandId={selectedGenerationsFilterBrand}
                onChange={setSelectedGenerationsFilterBrand}
                showAllOption={true}
              />
            </div>
          </div>
        </SectionHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 pb-32">
          {filteredGenerations.length === 0 ? (
            <div className="col-span-full py-48 premium-card border-none flex flex-col items-center justify-center text-slate-300 bg-white/50 backdrop-blur-sm shadow-premium group/empty">
              <div className="w-32 h-32 bg-slate-50 rounded-[3.5rem] flex items-center justify-center mb-10 shadow-inner-soft group-hover/empty:scale-110 group-hover/empty:rotate-6 transition-all duration-700">
                <BookOpen size={64} strokeWidth={1} className="opacity-20 text-navy" />
              </div>
              <p className="text-h2-premium opacity-40 italic">{t('history.generations.empty_title')}</p>
              <p className="text-label-caps opacity-60 mt-4">{t('history.generations.empty_desc')}</p>
            </div>
          ) : filteredGenerations.map((g, idx) => {
            const ts = formatTimestamp(g.timestamp);
            const brand = brands.find(b => b.id === g.brand_id);
            return (
              <div
                key={g.id}
                onClick={() => { setSelectedGeneration(g); setAuditResult(null); setIsGenDetailOpen(true); }}
                className="premium-card p-8 group glow cursor-pointer flex flex-col h-full animate-in fade-in slide-in-from-bottom-8 duration-700 hover:-translate-y-3 border-none shadow-premium bg-white/80 backdrop-blur-sm relative overflow-hidden"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="absolute top-0 right-0 p-12 text-slate-50 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none">
                  <Layout size={120} strokeWidth={1} />
                </div>

                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[1.5rem] bg-slate-50 text-navy flex items-center justify-center shadow-inner-soft group-hover:bg-navy group-hover:text-cyan transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 border border-slate-100 group-hover:border-navy/10 group-hover:shadow-glow">
                      {getPlatformIcon(g.input_data.platform)}
                    </div>
                    <div>
                      <h4 className="text-h2-premium truncate max-w-[180px] leading-none mb-1.5">{brand?.name || t('history.central_intel')}</h4>
                      <p className="text-label-caps text-slate-500 flex items-center gap-1.5 font-bold">
                        <Calendar size={10} className="text-cyan" /> {ts.date} <span className="text-slate-300">•</span> {ts.time}
                      </p>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50/50 text-slate-200 group-hover:bg-cyan/10 group-hover:text-cyan transition-all duration-500 shadow-sm">
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                <div className="flex-1 mb-6 relative z-10">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-lg border border-slate-100 flex items-center gap-2 transition-colors group-hover:bg-white text-[10px] uppercase font-black tracking-widest">
                      <Layout size={11} /> {g.input_data.platform}
                    </span>
                    <span className="px-3 py-1 bg-cyan-50/50 text-cyan-700 rounded-lg border border-cyan-100/50 flex items-center gap-2 transition-colors group-hover:bg-cyan-50 text-[10px] uppercase font-black tracking-widest">
                      <Languages size={11} /> {g.input_data.language || (i18n.language === 'en' ? t('languages.vietnamese') : 'Tiếng Việt')}
                    </span>
                  </div>
                  <h3 className="text-h2-premium line-clamp-2 leading-tight group-hover:text-cyan transition-colors duration-500 selection:bg-cyan/10">
                    {g.input_data.topic}
                  </h3>
                </div>

                <div className="pt-6 border-t border-slate-100/50 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center text-[10px] font-black !text-white border border-white/10 uppercase shadow-glow">
                      {g.user_name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-label-caps text-navy/70 font-bold ml-1">{g.user_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-navy/50 italic">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                    <span>{t('history.generations.stable_node')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {mounted && isGenDetailOpen && selectedGeneration && currentUser && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/80 backdrop-blur-xl p-8 animate-in fade-in duration-700">
            <div className="bg-white w-full max-w-[1600px] rounded-[5rem] shadow-2xl flex flex-col h-[94vh] overflow-hidden animate-in zoom-in-95 duration-700 border border-white/20 relative">
              <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-cyan-500/5 rounded-full blur-[180px] -mr-96 -mt-96 pointer-events-none" />

              <div className="px-16 py-10 border-b border-slate-100/50 flex justify-between items-center bg-white/80 backdrop-blur-md shrink-0 relative z-10">
                <div className="flex items-center gap-10">
                  <div className="w-24 h-24 rounded-[3rem] bg-navy text-cyan flex items-center justify-center shadow-glow border border-white/10 group-hover:scale-105 transition-transform duration-700">
                    {getPlatformIcon(selectedGeneration.input_data.platform)}
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-cyan/5 text-cyan-600 text-[10px] font-black tracking-[0.3em] uppercase mb-4 border border-cyan-100 shadow-sm relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan/20 to-transparent animate-shimmer" />
                      <Sparkles size={14} className="relative z-10" />
                      <span className="relative z-10 text-label-caps">{t('history.generations.protocol')}</span>
                    </div>
                    <h3 className="text-h1-premium mb-4 italic leading-tight">{t('history.generations.detail_title')}</h3>
                    <div className="flex items-center gap-8">
                      <p className="text-subtitle-italic opacity-70 flex items-center gap-3"><Calendar size={16} className="text-cyan" /> {formatTimestamp(selectedGeneration.timestamp).full}</p>
                      <div className="w-2 h-2 rounded-full bg-slate-100"></div>
                      <p className="text-subtitle-italic opacity-70 flex items-center gap-3"><UserIcon size={16} className="text-cyan" /> {selectedGeneration.user_name}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <button
                    onClick={() => handleCopy(selectedGeneration.output_data)}
                    className="px-10 py-6 bg-navy text-white rounded-3xl text-label-caps !text-white flex items-center gap-5 hover:bg-slate-800 transition-all duration-500 shadow-glow active:scale-95 group/copy border border-white/5"
                  >
                    <Copy size={20} className="text-cyan group-hover:scale-110 transition-transform" />
                    {t('generator.copy')}
                  </button>
                  <div className="w-px h-16 bg-slate-100/50" />
                  <button
                    onClick={() => setIsGenDetailOpen(false)}
                    className="p-6 hover:bg-rose-50 rounded-full text-slate-300 hover:text-rose-500 transition-all duration-500 border border-transparent hover:border-rose-100 shadow-soft active:scale-90"
                  >
                    <X size={40} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden bg-slate-50/20 flex flex-col lg:flex-row relative z-0">
                <div className="flex-1 overflow-y-auto p-16 grid lg:grid-cols-12 gap-16 custom-scrollbar">
                  <div className="lg:col-span-4 space-y-12">
                    <section className="premium-card p-12 glow animate-in border-none shadow-premium bg-white relative overflow-hidden group/meta">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50/50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                      <h4 className="flex items-center gap-5 italic leading-none text-label-caps">
                        <div className="w-10 h-10 rounded-xl bg-cyan/10 text-cyan flex items-center justify-center shadow-inner-soft group-hover/meta:rotate-12 transition-transform duration-500"><RefreshCw size={18} /></div>
                        {t('history.generations.metadata')}
                      </h4>
                      <div className="space-y-12 relative z-10">
                        <div className="flex flex-col gap-4 group/item">
                          <span className="text-label-caps text-slate-300">{t('history.generations.brand')}</span>
                          <div className="text-h2-premium italic bg-slate-50/50 p-5 rounded-[1.5rem] border border-slate-100 transition-all duration-500 group-hover/item:bg-white group-hover/item:border-cyan/30 group-hover/item:shadow-soft">
                            {brands.find(b => b.id === selectedGeneration.brand_id)?.name}
                          </div>
                        </div>
                        <div className="flex flex-col gap-4 group/item">
                          <span className="text-label-caps text-slate-300">{t('history.generations.platform')}</span>
                          <div className="flex">
                            <span className="px-6 py-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-inner-soft italic hover:bg-blue-100 transition-colors text-label-caps">{selectedGeneration.input_data.platform}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-4 group/item">
                          <span className="text-label-caps text-slate-300">{t('history.generations.language')}</span>
                          <div className="flex">
                            <span className="px-6 py-3 bg-cyan-50 text-cyan-600 rounded-2xl border border-cyan-100 shadow-inner-soft italic hover:bg-cyan-100 transition-colors text-label-caps">{selectedGeneration.input_data.language || (i18n.language === 'en' ? 'Vietnamese' : 'Tiếng Việt')}</span>
                          </div>
                        </div>
                        <div className="pt-6 border-t border-slate-100/50">
                          <span className="text-label-caps text-slate-300 block mb-6 ml-1">{t('history.generations.topic')}</span>
                          <div className="relative">
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-cyan/10 rounded-full group-hover/meta:bg-cyan/30 transition-colors" />
                            <p className="text-h2-premium leading-relaxed italic pl-10 py-1 drop-shadow-sm selection:bg-cyan/10">
                              "{selectedGeneration.input_data.topic}"
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="lg:col-span-8 flex flex-col h-full premium-card overflow-hidden glow border-none shadow-2xl bg-white/60 backdrop-blur-sm animate-in relative group/content">
                    <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan-500/5 blur-[150px] rounded-full -mr-96 -mt-96 pointer-events-none" />

                    <div className="px-16 py-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 backdrop-blur-md shrink-0 relative z-10">
                      <div className="flex items-center gap-8">
                        <div className="w-14 h-14 bg-white rounded-2.5xl shadow-glow ring-1 ring-slate-100 flex items-center justify-center text-navy transform -rotate-6 group-hover/content:rotate-0 transition-transform duration-700"><FileText size={28} /></div>
                        <div>
                          <span className="text-label-caps mb-1 block">{t('history.generations.registry')}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-cyan shadow-glow animate-pulse" />
                            <p className="text-label-caps text-cyan-600 opacity-70">Format: {selectedGeneration.input_data.platform}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-24 overflow-y-auto flex-1 custom-scrollbar text-prose-premium relative z-10">
                      <ReactMarkdown>{selectedGeneration.output_data}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </>
  );
};

export default HistoryGenerationsTab;