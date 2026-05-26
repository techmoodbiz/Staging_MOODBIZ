import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle, AlertCircle, X, Activity, Search,
  Calendar, Globe, ShieldCheck, AlertTriangle, Languages, BrainCircuit,
  Award, ShoppingBag, Copy, ChevronRight, FileCode, Check, Shield,
  User as UserIcon, Layout, BookOpen, Sparkles, Clock, Hash, TrendingUp
} from 'lucide-react';
import { Auditor, User, Brand } from '../../types';
import SectionHeader from '../SectionHeader';
import { BrandSelector } from '../UIComponents';
import { useTranslation } from 'react-i18next';

interface HistoryAuditsTabProps {
  auditors: Auditor[];
  brands: Brand[];
  availableBrands: Brand[];
}

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string; label: string }> = {
  language: { icon: <Languages size={13} />, color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-100',   label: 'Language'  },
  ai_logic: { icon: <BrainCircuit size={13} />, color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-100', label: 'AI Logic'  },
  brand:    { icon: <Award size={13} />,       color: 'text-navy',     bg: 'bg-slate-50',   border: 'border-slate-200',  label: 'Brand'     },
  product:  { icon: <ShoppingBag size={13} />, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', label: 'Product' },
  legal:    { icon: <Shield size={13} />,      color: 'text-rose-600', bg: 'bg-rose-50',    border: 'border-rose-100',   label: 'Legal'     },
};
const getCatMeta = (cat: string) => CATEGORY_META[cat?.toLowerCase()] || {
  icon: <AlertCircle size={13} />, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-100', label: cat
};

const SEVERITY_META: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  high:   { color: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-100',   dot: 'bg-rose-500'   },
  medium: { color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100',  dot: 'bg-amber-500'  },
  low:    { color: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  dot: 'bg-slate-400'  },
};
const getSevMeta = (sev: string) => SEVERITY_META[sev?.toLowerCase()] || SEVERITY_META.low;

// ─────────────────────────────────────────────────────────────────────────────
const HistoryAuditsTab: React.FC<HistoryAuditsTabProps> = ({ auditors, brands, availableBrands }) => {
  const { t, i18n } = useTranslation();
  const [selectedAuditsFilterBrand, setSelectedAuditsFilterBrand] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAuditor, setSelectedAuditor] = useState<Auditor | null>(null);
  const [isAuditorDetailOpen, setIsAuditorDetailOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

  const formatTimestamp = (ts: any) => {
    if (!ts) return { full: '', time: '', date: '' };
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN';
      return {
        full: date.toLocaleString(locale),
        time: date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
        date: date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
      };
    } catch { return { full: '', time: '', date: '' }; }
  };

  const filteredAudits = useMemo(() => {
    return auditors.filter(a => {
      const matchesBrand = selectedAuditsFilterBrand === 'all' || a.brand_id === selectedAuditsFilterBrand;
      const textToSearch = (a.input_data.text || a.input_data.rawText || '').toLowerCase();
      return matchesBrand && textToSearch.includes(searchTerm.toLowerCase());
    });
  }, [auditors, selectedAuditsFilterBrand, searchTerm]);

  const stats = useMemo(() => ({
    total:     filteredAudits.length,
    compliant: filteredAudits.filter(a => (a.output_data?.identified_issues?.length || 0) === 0).length,
    withIssues:filteredAudits.filter(a => (a.output_data?.identified_issues?.length || 0) > 0).length,
  }), [filteredAudits]);

  return (
    <>
      <div className="animate-in fade-in w-full pb-20 space-y-6">
        {/* Header */}
        <SectionHeader title={t('history.audits.title')} subtitle={t('history.audits.subtitle')}>
          <div className="flex flex-col lg:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="relative group w-full lg:w-[340px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-cyan transition-all" size={16} />
              <input
                type="text"
                placeholder={t('history.audits.search_placeholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-[13px] font-medium text-navy outline-none focus:ring-2 focus:ring-cyan/10 focus:border-cyan/30 transition-all shadow-sm placeholder:text-slate-300"
              />
            </div>
            <div className="w-full lg:w-60">
              <BrandSelector
                availableBrands={availableBrands}
                selectedBrandId={selectedAuditsFilterBrand}
                onChange={setSelectedAuditsFilterBrand}
                showAllOption={true}
              />
            </div>
          </div>
        </SectionHeader>

        {/* Stats row */}
        {stats.total > 0 && (
          <div className="flex flex-wrap gap-3 animate-in fade-in">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <ShieldCheck size={14} className="text-cyan" />
              <span className="text-[14px] font-black text-navy">{stats.total}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">lần audit</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl shadow-sm">
              <CheckCircle size={14} className="text-emerald-500" />
              <span className="text-[14px] font-black text-emerald-700">{stats.compliant}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">compliant</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 border border-rose-100 rounded-2xl shadow-sm">
              <AlertTriangle size={14} className="text-rose-500" />
              <span className="text-[14px] font-black text-rose-700">{stats.withIssues}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">có vi phạm</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {filteredAudits.length === 0 && (
          <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 py-24 flex flex-col items-center text-center animate-in fade-in">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
              <ShieldCheck size={28} className="text-slate-200" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-bold text-slate-400">{t('history.audits.empty_title')}</p>
            <p className="text-[11px] text-slate-300 mt-1 uppercase tracking-widest">{t('history.audits.empty_desc')}</p>
          </div>
        )}

        {/* Cards grid */}
        {filteredAudits.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredAudits.map((a, idx) => {
              const brand       = brands.find(b => b.id === a.brand_id);
              const ts          = formatTimestamp(a.timestamp);
              const issuesCount = a.output_data?.identified_issues?.length || 0;
              const isCompliant = issuesCount === 0;

              // Severity breakdown
              const highCount   = a.output_data?.identified_issues?.filter((i: any) => i.severity?.toLowerCase() === 'high').length || 0;
              const medCount    = a.output_data?.identified_issues?.filter((i: any) => i.severity?.toLowerCase() === 'medium').length || 0;

              return (
                <div
                  key={a.id}
                  onClick={() => { setSelectedAuditor(a); setIsAuditorDetailOpen(true); }}
                  className="group bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col overflow-hidden animate-in fade-in hover:-translate-y-1"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  {/* Top accent stripe */}
                  <div className={`h-1 w-full ${isCompliant ? 'bg-emerald-400' : highCount > 0 ? 'bg-rose-500' : 'bg-amber-400'}`} />

                  <div className="p-5 flex flex-col flex-1">
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border group-hover:scale-110 transition-transform duration-300 ${isCompliant ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                          {isCompliant
                            ? <ShieldCheck size={18} className="text-emerald-500" />
                            : <AlertTriangle size={18} className="text-rose-500" />
                          }
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

                      {/* Status badge */}
                      <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border flex-shrink-0 ${isCompliant ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                        {isCompliant ? t('history.audits.status_compliant') : t('history.audits.status_conflict')}
                      </span>
                    </div>

                    {/* Platform + language tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {a.input_data.platform && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-50 border border-slate-100 text-slate-500">
                          <Layout size={9} />
                          {a.input_data.platform}
                        </span>
                      )}
                      {a.input_data.language && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-cyan-50 border border-cyan-100 text-cyan-600">
                          <Languages size={9} />
                          {a.input_data.language}
                        </span>
                      )}
                    </div>

                    {/* Content preview */}
                    <p className="text-[12px] text-slate-500 leading-snug line-clamp-2 italic flex-1 mb-4 pl-2 border-l-2 border-slate-100 group-hover:border-cyan/30 transition-colors">
                      "{a.input_data.text || a.input_data.rawText}"
                    </p>

                    {/* Issue summary bar */}
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-4 ${isCompliant ? 'bg-emerald-50/60 border-emerald-100' : 'bg-amber-50/60 border-amber-100'}`}>
                      {isCompliant ? (
                        <>
                          <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{t('history.audits.verified')}</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex-1">
                            {t('history.audits.issues_detected', { count: issuesCount })}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {highCount > 0 && (
                              <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded text-[9px] font-black">{highCount} high</span>
                            )}
                            {medCount > 0 && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded text-[9px] font-black">{medCount} med</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-navy flex items-center justify-center text-[9px] font-black text-white">
                          {a.user_name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">{a.user_name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-200 group-hover:text-cyan transition-colors">
                        <span className="text-[9px] font-black uppercase tracking-widest">{t('history.audits.report')}</span>
                        <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {mounted && isAuditorDetailOpen && selectedAuditor && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/80 backdrop-blur-xl p-6 animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-[1600px] rounded-[3rem] shadow-2xl flex flex-col h-[94vh] overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20 relative">
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-[180px] -mr-96 -mt-96 pointer-events-none" />

            {/* Modal header */}
            <div className="px-10 py-7 border-b border-slate-100/50 flex justify-between items-center bg-white/90 backdrop-blur-md shrink-0 relative z-10">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-navy text-cyan flex items-center justify-center shadow-lg border border-white/10">
                  <ShieldCheck size={26} strokeWidth={2} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan/5 text-cyan-600 text-[9px] font-black tracking-[0.25em] uppercase mb-2 border border-cyan-100">
                    <Sparkles size={11} />
                    {t('history.audits.certificate')}
                  </div>
                  <h3 className="text-[18px] font-black text-navy leading-tight">{t('history.audits.audit_title')}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><Calendar size={11} className="text-cyan" /> {formatTimestamp(selectedAuditor.timestamp).full}</p>
                    <span className="text-slate-200">·</span>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><UserIcon size={11} className="text-cyan" /> {selectedAuditor.user_name}</p>
                    <span className="text-slate-200">·</span>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><Layout size={11} className="text-cyan" /> {selectedAuditor.input_data.platform || '—'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden xl:block">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-1">{t('history.audits.health_status')}</p>
                  <p className={`text-[15px] font-black ${(selectedAuditor.output_data?.identified_issues?.length || 0) === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {(selectedAuditor.output_data?.identified_issues?.length || 0) === 0
                      ? t('history.audits.neural_approved')
                      : t('history.audits.conflict_detected')}
                  </p>
                </div>
                <button
                  onClick={() => setIsAuditorDetailOpen(false)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-rose-50 rounded-xl text-slate-300 hover:text-rose-500 transition-all border border-transparent hover:border-rose-100 active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden bg-slate-50/30 flex flex-col lg:flex-row relative z-0">
              {/* Left: Input text */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm h-full flex flex-col overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <FileCode size={15} className="text-navy" />
                      <div>
                        <span className="text-[11px] font-black text-navy uppercase tracking-[0.25em] block">{t('history.audits.blueprint')}</span>
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{t('history.audits.encoding')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
                      <span className="text-[10px] font-bold text-cyan-500">{t('history.audits.live_vector')}</span>
                    </div>
                  </div>
                  <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                    <p className="text-[15px] text-navy font-bold leading-[1.8] whitespace-pre-wrap italic">
                      "{selectedAuditor.input_data.text || selectedAuditor.input_data.rawText}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Issues panel */}
              <div className="w-[540px] shrink-0 border-l border-slate-100 bg-white/60 backdrop-blur-sm p-8 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-6 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <h4 className="text-[14px] font-black text-navy leading-none">{t('history.audits.risk_log')}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest">{t('history.audits.thread')}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 bg-navy text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md">
                    {t('history.audits.conflict_nodes', { count: selectedAuditor.output_data?.identified_issues?.length || 0 })}
                  </span>
                </div>

                <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pb-4">
                  {selectedAuditor.output_data?.identified_issues?.length > 0 ? (
                    selectedAuditor.output_data.identified_issues.map((issue: any, idx: number) => {
                      const cat = getCatMeta(issue.category);
                      const sev = getSevMeta(issue.severity);
                      return (
                        <div
                          key={idx}
                          className="bg-white rounded-2xl border border-slate-100 p-5 hover:border-slate-200 hover:shadow-md transition-all duration-300 animate-in slide-in-from-right-4"
                          style={{ animationDelay: `${idx * 80}ms` }}
                        >
                          {/* Issue header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${cat.bg} ${cat.border}`}>
                              <span className={cat.color}>{cat.icon}</span>
                              <span className={`text-[9px] font-black uppercase tracking-widest ${cat.color}`}>{cat.label}</span>
                            </div>
                            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${sev.bg} ${sev.border}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                              <span className={`text-[9px] font-black uppercase tracking-widest ${sev.color}`}>{issue.severity}</span>
                            </div>
                          </div>

                          {/* Problematic text */}
                          <div className="mb-3 pl-3 border-l-2 border-rose-200">
                            <p className="text-[13px] text-navy font-black leading-snug italic">"{issue.problematic_text}"</p>
                          </div>

                          {/* Citation */}
                          {issue.citation && (
                            <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 w-fit">
                              <div className="w-1.5 h-1.5 rounded-full bg-cyan" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('history.audits.protocol_id')}: <span className="text-navy">{issue.citation}</span></span>
                            </div>
                          )}

                          {/* Reason */}
                          <p className="text-[12px] text-slate-500 leading-relaxed mb-3">{issue.reason}</p>

                          {/* Suggestion */}
                          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                            <div className="flex items-center gap-2 mb-2 text-emerald-600">
                              <div className="w-6 h-6 bg-white rounded-lg shadow-sm flex items-center justify-center flex-shrink-0">
                                <Check size={12} strokeWidth={3} className="text-emerald-500" />
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-widest">{t('history.audits.corrective_vector')}</span>
                            </div>
                            <p className="text-[12px] text-emerald-900 font-bold leading-relaxed">{issue.suggestion}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-5">
                        <ShieldCheck size={36} className="text-emerald-400" strokeWidth={1.5} />
                      </div>
                      <p className="text-[15px] font-black text-emerald-600">{t('history.audits.flawless')}</p>
                      <p className="text-[12px] text-slate-400 mt-2 leading-relaxed max-w-[260px]">{t('history.audits.flawless_desc')}</p>
                      <div className="flex gap-1.5 mt-6">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                      </div>
                    </div>
                  )}
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

export default HistoryAuditsTab;
