
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
   Eye, CheckCircle, AlertCircle, X, Activity, Filter, Search,
   Calendar, Globe, ShieldCheck, AlertTriangle, Languages, BrainCircuit,
   Award, ShoppingBag, Copy, ChevronRight, FileCode, Check, Shield, User as UserIcon, Layout, BookOpen, Sparkles
} from 'lucide-react';
import { Auditor, User, Brand } from '../../types';
import SectionHeader from '../SectionHeader';
import { BrandSelector } from '../UIComponents';
import { db } from '../../firebase';
import { useTranslation } from 'react-i18next';

interface HistoryAuditsTabProps {
   auditors: Auditor[];
   brands: Brand[];
   availableBrands: Brand[];
}

const HistoryAuditsTab: React.FC<HistoryAuditsTabProps> = ({ auditors, brands, availableBrands }) => {
   const { t, i18n } = useTranslation();
   const [selectedAuditsFilterBrand, setSelectedAuditsFilterBrand] = useState('all');
   const [searchTerm, setSearchTerm] = useState('');
   const [selectedAuditor, setSelectedAuditor] = useState<Auditor | null>(null);
   const [isAuditorDetailOpen, setIsAuditorDetailOpen] = useState(false);
   const [mounted, setMounted] = useState(false);

   useEffect(() => {
      setMounted(true);
      return () => setMounted(false);
   }, []);

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
      } catch (e) { return { full: '', time: '', date: '' }; }
   };

   const filteredAudits = useMemo(() => {
      return auditors.filter(a => {
         const matchesBrand = selectedAuditsFilterBrand === 'all' || a.brand_id === selectedAuditsFilterBrand;
         const textToSearch = (a.input_data.text || a.input_data.rawText || '').toLowerCase();
         const matchesSearch = textToSearch.includes(searchTerm.toLowerCase());
         return matchesBrand && matchesSearch;
      });
   }, [auditors, selectedAuditsFilterBrand, searchTerm]);

   const getIssueCategoryIcon = (category: string) => {
      switch (category?.toLowerCase()) {
         case 'language': return <Languages size={14} />;
         case 'ai_logic': return <BrainCircuit size={14} />;
         case 'brand': return <Award size={14} />;
         case 'product': return <ShoppingBag size={14} />;
         case 'legal': return <Shield size={14} />;
         default: return <AlertCircle size={14} />;
      }
   };

   return (
      <>
         <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 flex flex-col h-full">
            <SectionHeader title={t('history.audits.title')} subtitle={t('history.audits.subtitle')}>
               <div className="flex flex-col lg:flex-row items-center gap-6 w-full lg:w-auto">
                  <div className="relative group w-full lg:w-[450px]">
                     <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-cyan group-focus-within:scale-110 transition-all duration-500" size={20} />
                     <input
                        type="text"
                        placeholder={t('history.audits.search_placeholder')}
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
                        selectedBrandId={selectedAuditsFilterBrand}
                        onChange={setSelectedAuditsFilterBrand}
                        showAllOption={true}
                     />
                  </div>
               </div>
            </SectionHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 pb-32">
               {filteredAudits.length === 0 ? (
                  <div className="col-span-full py-48 premium-card border-none flex flex-col items-center justify-center text-slate-300 bg-white/50 backdrop-blur-sm shadow-premium group/empty">
                     <div className="w-32 h-32 bg-slate-50 rounded-[3.5rem] flex items-center justify-center mb-10 shadow-inner-soft group-hover/empty:scale-110 group-hover/empty:rotate-6 transition-all duration-700">
                        <ShieldCheck size={64} strokeWidth={1} className="opacity-20 text-navy" />
                     </div>
                     <p className="text-h2-premium italic">{t('history.audits.empty_title')}</p>
                     <p className="text-subtitle-italic opacity-60 mt-4 uppercase tracking-widest">{t('history.audits.empty_desc')}</p>
                  </div>
               ) : filteredAudits.map((a, idx) => {
                  const brand = brands.find(b => b.id === a.brand_id);
                  const ts = formatTimestamp(a.timestamp);
                  const issuesCount = a.output_data?.identified_issues?.length || 0;
                  const status = issuesCount === 0 ? 'Compliant' : 'Conflict';

                  return (
                     <div
                        key={a.id}
                        onClick={() => { setSelectedAuditor(a); setIsAuditorDetailOpen(true); }}
                        className="premium-card p-8 group glow cursor-pointer flex flex-col h-full animate-in fade-in slide-in-from-bottom-8 duration-700 hover:-translate-y-3 border-none shadow-premium bg-white/80 backdrop-blur-sm relative overflow-hidden"
                        style={{ animationDelay: `${idx * 60}ms` }}
                     >
                        <div className="absolute top-0 right-0 p-12 text-slate-50 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none">
                           <ShieldCheck size={120} strokeWidth={1} />
                        </div>

                        <div className="flex justify-between items-start mb-6 relative z-10">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-[1.5rem] bg-slate-50 text-navy flex items-center justify-center shadow-inner-soft group-hover:bg-navy group-hover:text-cyan transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 border border-slate-100 group-hover:border-navy/10 group-hover:shadow-glow">
                                 <Shield size={22} strokeWidth={2.5} />
                              </div>
                              <div>
                                 <h3 className="text-h2-premium opacity-90 line-clamp-1 truncate max-w-[180px] leading-none mb-1.5">{brand?.name || t('history.central_intel')}</h3>
                                 <p className="text-label-caps text-slate-500 flex items-center gap-1.5 font-bold">
                                    <Calendar size={10} className="text-cyan" /> {ts.date} <span className="text-slate-300">•</span> {ts.time}
                                 </p>
                              </div>
                           </div>
                           <div className={`px-4 py-2 rounded-xl text-label-caps border shadow-sm transition-all duration-500 group-hover:shadow-glow leading-none ${status === 'Compliant' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                              {status === 'Compliant' ? t('history.audits.status_compliant') : t('history.audits.status_conflict')}
                           </div>
                        </div>

                        <div className="flex-1 mb-6 relative z-10">
                           <div className="flex flex-wrap items-center gap-2 mb-4">
                              <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-lg border border-slate-100 flex items-center gap-2 transition-colors group-hover:bg-white text-[10px] uppercase font-black tracking-widest">
                                 <Layout size={11} /> {a.input_data.platform || t('history.generations.brand_context')}
                              </span>
                              <span className="px-3 py-1 bg-cyan-50/50 text-cyan-700 rounded-lg border border-cyan-100/50 flex items-center gap-2 transition-colors group-hover:bg-cyan-50 text-[10px] uppercase font-black tracking-widest">
                                 <Languages size={11} /> {a.input_data.language || (i18n.language === 'en' ? t('languages.vietnamese') : 'Tiếng Việt')}
                              </span>
                           </div>
                           <div className="relative">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-100 rounded-full group-hover:bg-cyan/30 transition-all duration-700" />
                              <p className="text-[14px] text-slate-600 font-bold italic leading-relaxed line-clamp-2 pl-6 py-1 selection:bg-cyan/10">
                                 "{a.input_data.text || a.input_data.rawText}"
                              </p>
                           </div>
                        </div>

                        <div className="mb-6 relative z-10">
                           <div className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-3 border transition-all duration-700 group-hover:shadow-soft ${issuesCount > 0 ? 'bg-amber-50 text-amber-700 border-amber-200/50' : 'bg-emerald-50 text-emerald-700 border-emerald-200/50'}`}>
                              {issuesCount > 0 ? <AlertTriangle size={14} className="animate-pulse" /> : <CheckCircle size={14} />}
                              <span className="text-[10px] uppercase font-black tracking-widest leading-none">
                                 {issuesCount === 0 ? t('history.audits.verified') : t('history.audits.issues_detected', { count: issuesCount })}
                              </span>
                           </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100/50 flex items-center justify-between relative z-10">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center text-[10px] font-black !text-white border border-white/10 uppercase shadow-glow">
                                 {a.user_name?.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-label-caps text-navy/70 font-bold ml-1">{a.user_name}</span>
                           </div>
                           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-navy/50 italic group-hover:text-cyan transition-all group-hover:gap-4">
                              {t('history.audits.report')} <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                           </div>
                        </div>
                     </div>
                  );
               })}
            </div>

            {/* Detail Modal */}
            {mounted && isAuditorDetailOpen && selectedAuditor && createPortal(
               <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/80 backdrop-blur-xl p-8 animate-in fade-in duration-700">
                  <div className="bg-white w-full max-w-[1600px] rounded-[5rem] shadow-2xl flex flex-col h-[94vh] overflow-hidden animate-in zoom-in-95 duration-700 border border-white/20 relative">
                     <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-cyan-500/5 rounded-full blur-[180px] -mr-96 -mt-96 pointer-events-none" />

                     <div className="px-16 py-10 border-b border-slate-100/50 flex justify-between items-center bg-white/80 backdrop-blur-md shrink-0 relative z-10">
                        <div className="flex items-center gap-10">
                           <div className="w-24 h-24 rounded-[3rem] bg-navy text-cyan flex items-center justify-center shadow-glow border border-white/10 group-hover:scale-105 transition-transform duration-700">
                              <ShieldCheck size={48} strokeWidth={2.5} className="animate-pulse" />
                           </div>
                           <div>
                              <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-cyan/5 text-cyan-600 text-label-caps mb-4 border border-cyan-100 shadow-sm relative overflow-hidden">
                                 <div className="absolute inset-0 bg-gradient-to-r from-cyan/20 to-transparent animate-shimmer" />
                                 <Sparkles size={14} className="relative z-10" />
                                 <span className="relative z-10">{t('history.audits.certificate')}</span>
                              </div>
                              <h3 className="text-h1-premium mb-4">{t('history.audits.audit_title')}</h3>
                              <div className="flex items-center gap-8">
                                 <p className="text-subtitle-italic opacity-70 flex items-center gap-3"><Calendar size={16} className="text-cyan" /> {formatTimestamp(selectedAuditor.timestamp).full}</p>
                                 <div className="w-2 h-2 rounded-full bg-slate-100"></div>
                                 <p className="text-subtitle-italic opacity-70 flex items-center gap-3"><UserIcon size={16} className="text-cyan" /> {selectedAuditor.user_name}</p>
                                 <div className="w-2 h-2 rounded-full bg-slate-100"></div>
                                 <p className="text-subtitle-italic opacity-70 flex items-center gap-3"><Layout size={16} className="text-cyan" /> {selectedAuditor.input_data.platform || t('history.generations.brand_context')}</p>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-12">
                           <div className="text-right hidden xl:block">
                              <div className="text-label-caps opacity-60 mb-3">{t('history.audits.health_status')}</div>
                              <div className={`text-h2-premium ${(selectedAuditor.output_data?.identified_issues?.length || 0) === 0 ? 'text-emerald-500 drop-shadow-glow' : 'text-red-500 drop-shadow-glow-red'}`}>
                                 {(selectedAuditor.output_data?.identified_issues?.length || 0) === 0 ? t('history.audits.neural_approved') : t('history.audits.conflict_detected')}
                              </div>
                           </div>
                           <div className="w-px h-16 bg-slate-100/50" />
                           <button onClick={() => setIsAuditorDetailOpen(false)} className="p-6 hover:bg-rose-50 rounded-full text-slate-300 hover:text-rose-500 transition-all duration-500 border border-transparent hover:border-rose-100 shadow-soft active:scale-90">
                              <X size={40} />
                           </button>
                        </div>
                     </div>

                     <div className="flex-1 overflow-hidden bg-slate-50/20 flex flex-col lg:flex-row relative z-0">
                        {/* LEFT COLUMN: Input */}
                        <div className="flex-1 overflow-y-auto p-16 custom-scrollbar">
                           <div className="premium-card h-full flex flex-col overflow-hidden glow border-none shadow-2xl bg-white/60 backdrop-blur-sm relative group/input">
                              <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px] -mr-64 -mt-64 pointer-events-none" />

                              <div className="px-12 py-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between shrink-0">
                                 <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 bg-white rounded-2xl shadow-soft flex items-center justify-center text-navy transform -rotate-6 group-hover/input:rotate-0 transition-transform duration-500">
                                       <FileCode size={22} />
                                    </div>
                                    <div>
                                       <span className="text-[11px] font-black text-navy uppercase tracking-[0.3em] block">{t('history.audits.blueprint')}</span>
                                       <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-0.5 block">{t('history.audits.encoding')}</span>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan shadow-glow animate-pulse" />
                                    <span className="text-label-caps !text-cyan-500 italic">{t('history.audits.live_vector')}</span>
                                 </div>
                              </div>
                              <div className="p-20 flex-1 overflow-y-auto custom-scrollbar relative z-10 selection:bg-navy selection:text-white">
                                 <div className="text-[18px] text-navy font-black leading-[1.8] whitespace-pre-wrap italic tracking-tight opacity-90 first-letter:text-4xl first-letter:font-black first-letter:mr-6 first-letter:float-left first-letter:text-navy/20">
                                    "{selectedAuditor.input_data.text || selectedAuditor.input_data.rawText}"
                                 </div>
                              </div>
                           </div>
                        </div>

                        {/* RIGHT COLUMN: Violation Log */}
                        <div className="w-[580px] shrink-0 h-full border-l border-slate-100/50 bg-white/40 backdrop-blur-3xl p-16 flex flex-col relative overflow-hidden">
                           <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-red-500/5 rounded-full blur-[100px] -mr-48 -mb-48 pointer-events-none" />

                           <div className="flex items-center justify-between mb-12 shrink-0 relative z-10">
                              <div className="flex items-center gap-6">
                                 <div className="w-14 h-14 rounded-2.5xl bg-red-600 text-white flex items-center justify-center shadow-glow border border-white/10 transform rotate-3"><AlertTriangle size={28} /></div>
                                 <div>
                                    <h4 className="text-h2-premium leading-none mb-2">{t('history.audits.risk_log')}</h4>
                                    <p className="text-label-caps opacity-60">{t('history.audits.thread')}</p>
                                 </div>
                              </div>
                              <div className="px-5 py-2.5 bg-navy text-white text-label-caps !leading-none rounded-2xl shadow-glow border border-white/5 mx-auto">
                                 {t('history.audits.conflict_nodes', { count: selectedAuditor.output_data?.identified_issues?.length || 0 })}
                              </div>
                           </div>

                           <div className="space-y-8 overflow-y-auto custom-scrollbar pr-6 flex-1 scroll-smooth relative z-10 pb-10">
                              {selectedAuditor.output_data?.identified_issues?.length > 0 ? (
                                 selectedAuditor.output_data.identified_issues.map((issue: any, idx: number) => (
                                    <div key={idx} className="p-10 rounded-[3.5rem] bg-white/80 border border-slate-100 shadow-premium hover:border-cyan/30 transition-all duration-700 group/issue animate-in slide-in-from-right-8" style={{ animationDelay: `${idx * 150}ms` }}>
                                       <div className="flex items-center justify-between mb-8">
                                          <div className="flex items-center gap-5">
                                             <div className="w-12 h-12 bg-slate-50 rounded-2xl text-slate-400 group-hover/issue:bg-navy group-hover/issue:text-cyan group-hover/issue:scale-110 group-hover/issue:rotate-6 transition-all duration-700 flex items-center justify-center border border-slate-100">
                                                {getIssueCategoryIcon(issue.category)}
                                             </div>
                                             <div>
                                                <span className="text-label-caps leading-none mb-1.5 block">{issue.category} Protocol</span>
                                                <span className="text-label-caps opacity-60 block">{t('history.audits.deviation')}</span>
                                             </div>
                                          </div>
                                          <span className={`px-4 py-2 rounded-xl text-label-caps border shadow-sm italic ${issue.severity?.toLowerCase() === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-500/5' : 'bg-amber-50 text-amber-600 border-amber-100 shadow-amber-500/5'}`}>
                                             {issue.severity} {t('history.audits.risk')}
                                          </span>
                                       </div>

                                       <div className="relative mb-8">
                                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-100 rounded-full group-hover/issue:bg-red-400 transition-colors" />
                                          <p className="text-[15px] text-navy font-black leading-relaxed pl-8 py-1 italic tracking-tight selection:bg-red-100">"{issue.problematic_text}"</p>
                                       </div>

                                       {issue.citation && (
                                          <div className="flex items-center gap-3 mb-8 px-5 py-2.5 bg-slate-50/50 rounded-xl border border-slate-100/50 w-fit">
                                             <div className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
                                             <span className="text-label-caps opacity-60">{t('history.audits.protocol_id')}: <span className="text-navy">{issue.citation}</span></span>
                                          </div>
                                       )}

                                       <div className="mb-10 text-[15px] text-slate-500/80 font-bold leading-relaxed italic opacity-80 group-hover/issue:opacity-100 transition-opacity drop-shadow-sm">
                                          {issue.reason}
                                       </div>

                                       <div className="bg-emerald-50/50 p-8 rounded-[2.5rem] border border-emerald-100/40 group-hover/issue:bg-emerald-50 transition-all duration-700 relative overflow-hidden">
                                          <div className="absolute inset-0 bg-gradient-to-r from-emerald-100/10 to-transparent pointer-events-none" />
                                          <div className="flex items-center gap-4 mb-4 text-emerald-600 relative z-10">
                                             <div className="w-10 h-10 bg-white rounded-xl shadow-soft flex items-center justify-center"><Check size={20} strokeWidth={3} /></div>
                                             <span className="text-label-caps italic">{t('history.audits.corrective_vector')}</span>
                                          </div>
                                          <p className="text-[14px] text-emerald-950 font-black leading-relaxed tracking-tight relative z-10 italic">
                                             {issue.suggestion}
                                          </p>
                                       </div>
                                    </div>
                                 ))
                              ) : (
                                 <div className="h-full flex flex-col items-center justify-center py-32 text-center animate-in zoom-in-95 duration-1000">
                                    <div className="w-40 h-40 bg-emerald-50 rounded-[4rem] flex items-center justify-center mb-12 shadow-inner-soft shadow-glow transform hover:scale-110 duration-700">
                                       <ShieldCheck size={80} className="text-emerald-500" strokeWidth={1} />
                                    </div>
                                    <p className="text-h2-premium !text-emerald-600">{t('history.audits.flawless')}</p>
                                    <p className="text-subtitle-italic opacity-70 mt-6 max-w-[320px] leading-relaxed">{t('history.audits.flawless_desc')}</p>

                                    <div className="mt-16 flex gap-2">
                                       {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-2 h-2 rounded-full bg-emerald-100 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />)}
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
         </div>
      </>
   );
};

export default HistoryAuditsTab;
