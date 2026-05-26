import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye, FileText, X, Copy, Activity, RefreshCw, Filter,
  BookOpen, Search, Calendar, User as UserIcon, MessageSquare,
  ChevronRight, Sparkles, Layout, Facebook, Globe, Mail, Linkedin,
  PenTool, Languages, ArrowRight, CheckCircle, Check,
  PenSquare, Clock, Hash
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

// ── Platform config ──────────────────────────────────────────────────────────
const PLATFORM_META: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  facebook:  { icon: <Facebook  size={16} />, color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-100'   },
  linkedin:  { icon: <Linkedin  size={16} />, color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-100'   },
  web:       { icon: <Globe     size={16} />, color: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-100'},
  seo:       { icon: <Globe     size={16} />, color: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-100'},
  email:     { icon: <Mail      size={16} />, color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-100'  },
  default:   { icon: <PenTool   size={16} />, color: 'text-slate-500',  bg: 'bg-slate-50',   border: 'border-slate-100'  },
};

const getPlatformMeta = (platform: string) => {
  const p = platform.toLowerCase();
  if (p.includes('facebook')) return PLATFORM_META.facebook;
  if (p.includes('linkedin')) return PLATFORM_META.linkedin;
  if (p.includes('web') || p.includes('seo')) return PLATFORM_META.web;
  if (p.includes('email')) return PLATFORM_META.email;
  return PLATFORM_META.default;
};

// Large icon version for modal header
const getPlatformIconLarge = (platform: string) => {
  const p = platform.toLowerCase();
  if (p.includes('facebook')) return <Facebook size={22} className="text-blue-600" />;
  if (p.includes('linkedin')) return <Linkedin size={22} className="text-blue-700" />;
  if (p.includes('web') || p.includes('seo')) return <Globe size={22} className="text-emerald-600" />;
  if (p.includes('email')) return <Mail size={22} className="text-amber-600" />;
  return <PenTool size={22} className="text-slate-600" />;
};

// ─────────────────────────────────────────────────────────────────────────────
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

  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

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
    } catch { return { full: '', time: '', date: '' }; }
  };

  const filteredGenerations = useMemo(() => {
    return generations.filter(g => {
      const matchesBrand = selectedGenerationsFilterBrand === 'all' || g.brand_id === selectedGenerationsFilterBrand;
      const matchesSearch =
        g.input_data.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.input_data.platform.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesBrand && matchesSearch;
    });
  }, [generations, selectedGenerationsFilterBrand, searchTerm]);

  const handleCopy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setToast({ type: 'success', message: t('history.generations.copy_success') });
    } catch {
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
    let basePrompt = systemPrompts.auditor[platform];
    if (!basePrompt) basePrompt = isWebsite ? systemPrompts.auditor['Website / SEO Blog'] : systemPrompts.auditor['Facebook Post'];
    if (!basePrompt) basePrompt = "AUDIT THIS:\n\n{text}\n\nRULES:\n{sop_rules}\n\nBRAND:\n{brand_name}";
    const sopRulesText = auditRules?.length > 0 ? auditRules.map(r => `### ${r.label}\n${r.content}`).join('\n\n') : t('history.audits.empty_desc');
    const prompt = basePrompt
      .replace(/{text}/g, selectedGeneration.output_data)
      .replace(/{sop_rules}/g, sopRulesText)
      .replace(/{dynamic_rules}/g, sopRulesText)
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
    } catch {
      setToast({ type: 'error', message: t('history.generations.audit_failed') });
    } finally {
      setIsAuditing(false);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalCount   = filteredGenerations.length;
  const brandCounts  = useMemo(() => {
    const map: Record<string, number> = {};
    filteredGenerations.forEach(g => { map[g.brand_id] = (map[g.brand_id] || 0) + 1; });
    return map;
  }, [filteredGenerations]);
  const topBrand = useMemo(() => {
    const topId = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return brands.find(b => b.id === topId);
  }, [brandCounts, brands]);

  return (
    <>
      <div className="animate-in fade-in w-full pb-20 space-y-6">
        {/* Header */}
        <SectionHeader title={t('history.generations.title')} subtitle={t('history.generations.subtitle')}>
          <div className="flex flex-col lg:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="relative group w-full lg:w-[340px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-cyan transition-all" size={16} />
              <input
                type="text"
                placeholder={t('history.generations.search_placeholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-[13px] font-medium text-navy outline-none focus:ring-2 focus:ring-cyan/10 focus:border-cyan/30 transition-all shadow-sm placeholder:text-slate-300"
              />
            </div>
            <div className="w-full lg:w-60">
              <BrandSelector
                availableBrands={availableBrands}
                selectedBrandId={selectedGenerationsFilterBrand}
                onChange={setSelectedGenerationsFilterBrand}
                showAllOption={true}
              />
            </div>
          </div>
        </SectionHeader>

        {/* Stats row */}
        {totalCount > 0 && (
          <div className="flex flex-wrap gap-3 animate-in fade-in">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <PenSquare size={14} className="text-cyan" />
              <span className="text-[14px] font-black text-navy">{totalCount}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">bài viết</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <Hash size={14} className="text-violet-400" />
              <span className="text-[14px] font-black text-navy">{Object.keys(brandCounts).length}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">thương hiệu</span>
            </div>
            {topBrand && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border border-violet-100 rounded-2xl shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">top brand</span>
                <span className="text-[13px] font-black text-violet-700">{topBrand.name}</span>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {filteredGenerations.length === 0 && (
          <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 py-24 flex flex-col items-center text-center animate-in fade-in">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
              <BookOpen size={28} className="text-slate-200" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-bold text-slate-400">{t('history.generations.empty_title')}</p>
            <p className="text-[11px] text-slate-300 mt-1">{t('history.generations.empty_desc')}</p>
          </div>
        )}

        {/* Cards grid */}
        {filteredGenerations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredGenerations.map((g, idx) => {
              const ts    = formatTimestamp(g.timestamp);
              const brand = brands.find(b => b.id === g.brand_id);
              const pm    = getPlatformMeta(g.input_data.platform);

              return (
                <div
                  key={g.id}
                  onClick={() => { setSelectedGeneration(g); setAuditResult(null); setIsGenDetailOpen(true); }}
                  className="group bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col overflow-hidden animate-in fade-in hover:-translate-y-1"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  {/* Card top accent */}
                  <div className={`h-1 w-full ${pm.bg.replace('bg-', 'bg-').replace('-50', '-400')}`}
                    style={{ background: `linear-gradient(90deg, ${pm.color.includes('blue') ? '#3b82f6' : pm.color.includes('emerald') ? '#10b981' : pm.color.includes('amber') ? '#f59e0b' : '#64748b'} 0%, transparent 100%)` }}
                  />

                  <div className="p-5 flex flex-col flex-1">
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {/* Platform icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${pm.bg} ${pm.border} group-hover:scale-110 transition-transform duration-300`}>
                          <span className={pm.color}>{pm.icon}</span>
                        </div>
                        <div>
                          <p className="text-[13px] font-black text-navy leading-tight group-hover:text-cyan transition-colors">
                            {brand?.name || t('history.central_intel')}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock size={9} className="text-slate-300" />
                            <span className="text-[10px] text-slate-400">{ts.date} · {ts.time}</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-7 h-7 flex items-center justify-center rounded-xl text-slate-200 group-hover:text-cyan group-hover:bg-cyan/5 transition-all">
                        <ChevronRight size={14} />
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${pm.bg} ${pm.border} ${pm.color}`}>
                        {pm.icon}
                        {g.input_data.platform}
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-cyan-50 border border-cyan-100 text-cyan-600">
                        <Languages size={9} />
                        {g.input_data.language || 'Tiếng Việt'}
                      </span>
                    </div>

                    {/* Topic */}
                    <p className="text-[13px] font-bold text-slate-700 leading-snug line-clamp-2 flex-1 mb-4">
                      {g.input_data.topic}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-navy flex items-center justify-center text-[9px] font-black text-white">
                          {g.user_name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">{g.user_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">saved</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail Modal (unchanged logic, refined styling) ── */}
      {mounted && isGenDetailOpen && selectedGeneration && currentUser && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/80 backdrop-blur-xl p-6 animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-[1600px] rounded-[3rem] shadow-2xl flex flex-col h-[94vh] overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20 relative">
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-[180px] -mr-96 -mt-96 pointer-events-none" />

            <div className="px-10 py-7 border-b border-slate-100/50 flex justify-between items-center bg-white/90 backdrop-blur-md shrink-0 relative z-10">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-navy text-cyan flex items-center justify-center shadow-lg border border-white/10">
                  {getPlatformIconLarge(selectedGeneration.input_data.platform)}
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan/5 text-cyan-600 text-[9px] font-black tracking-[0.25em] uppercase mb-2 border border-cyan-100">
                    <Sparkles size={11} />
                    {t('history.generations.protocol')}
                  </div>
                  <h3 className="text-[18px] font-black text-navy leading-tight">{t('history.generations.detail_title')}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><Calendar size={11} className="text-cyan" /> {formatTimestamp(selectedGeneration.timestamp).full}</p>
                    <span className="text-slate-200">·</span>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><UserIcon size={11} className="text-cyan" /> {selectedGeneration.user_name}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleCopy(selectedGeneration.output_data)}
                  className="px-6 py-3 bg-navy text-white rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                >
                  <Copy size={15} className="text-cyan" />
                  {t('generator.copy')}
                </button>
                <button
                  onClick={() => setIsGenDetailOpen(false)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-rose-50 rounded-xl text-slate-300 hover:text-rose-500 transition-all border border-transparent hover:border-rose-100 active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden bg-slate-50/30 flex flex-col lg:flex-row relative z-0">
              <div className="flex-1 overflow-y-auto p-8 grid lg:grid-cols-12 gap-8 custom-scrollbar">
                {/* Meta panel */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 mb-5">
                      <RefreshCw size={13} className="text-cyan" />
                      {t('history.generations.metadata')}
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 block mb-1">{t('history.generations.brand')}</span>
                        <p className="text-[14px] font-black text-navy">{brands.find(b => b.id === selectedGeneration.brand_id)?.name}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 block mb-1">{t('history.generations.platform')}</span>
                        <span className="inline-flex px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 text-[11px] font-black">
                          {selectedGeneration.input_data.platform}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 block mb-1">{t('history.generations.language')}</span>
                        <span className="inline-flex px-3 py-1.5 bg-cyan-50 text-cyan-600 rounded-xl border border-cyan-100 text-[11px] font-black">
                          {selectedGeneration.input_data.language || 'Tiếng Việt'}
                        </span>
                      </div>
                      <div className="pt-4 border-t border-slate-50">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 block mb-2">{t('history.generations.topic')}</span>
                        <div className="pl-3 border-l-2 border-cyan/30">
                          <p className="text-[13px] font-bold text-navy leading-relaxed italic">"{selectedGeneration.input_data.topic}"</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content panel */}
                <div className="lg:col-span-8 flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50 shrink-0">
                    <FileText size={16} className="text-navy" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t('history.generations.registry')}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
                      <span className="text-[10px] font-bold text-cyan-600">{selectedGeneration.input_data.platform}</span>
                    </div>
                  </div>
                  <div className="p-8 overflow-y-auto flex-1 custom-scrollbar prose prose-sm max-w-none">
                    <ReactMarkdown>{selectedGeneration.output_data}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default HistoryGenerationsTab;
