import React, { useState, useMemo } from 'react';
import { Sparkles, FileCode, Plus, Save, RotateCcw, PenTool, Activity, Trash2, Edit3, X, Layout, Globe, Mail, Facebook, Linkedin, BookOpen, BrainCircuit, SearchCode, Terminal, Settings, ChevronDown, Code2, Type } from 'lucide-react';
import { SystemPrompts, AuditRule } from '../../types';
import SectionHeader from '../SectionHeader';
import { CustomSelect, MultiSelect, ConfirmationModal } from '../UIComponents';
import { GEN_PROMPTS_DEFAULTS, AUDIT_PROMPTS_DEFAULTS, PLATFORM_CONFIGS } from '../../constants';
import { db } from '../../firebase';
import firebase from '../../firebase';
import { useTranslation } from 'react-i18next';

interface SettingsTabProps {
  systemPrompts: SystemPrompts;
  setSystemPrompts: (prompts: SystemPrompts) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning' | 'info') => void;
  setToast: (toast: any) => void;
  auditRules: AuditRule[];
}

const SettingsTab: React.FC<SettingsTabProps> = ({ systemPrompts, setSystemPrompts, showConfirm, setToast, auditRules }) => {
  const { t } = useTranslation();
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<AuditRule> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPromptPlatform, setSelectedPromptPlatform] = useState('Facebook Post');
  const [activePromptType, setActivePromptType] = useState<'generator' | 'auditor'>('generator');

  const textareaClass = "input-premium h-80 p-6 font-mono text-[13px] shadow-inner-soft custom-scrollbar";
  const inputClass = "input-premium p-3 font-bold";

  const handleSaveRule = async () => {
    if (!editingRule?.label || !editingRule?.content) {
      setToast({ type: 'warning', message: t('admin.settings.modal.toast_warn') });
      return;
    }
    setIsSaving(true);
    try {
      const id = editingRule.id || `RULE_${Date.now()}`;
      await db.collection('audit_rules').doc(id).set({
        ...editingRule,
        apply_to_language: editingRule.apply_to_language || 'all',
        id,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      setIsRuleModalOpen(false);
      setToast({ type: 'success', message: t('admin.settings.modal.toast_save') });
    } catch (e: any) {
      setToast({ type: 'error', message: t('common.error') + e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = (id: string) => {
    showConfirm(t('admin.settings.modal.toast_delete_title'), t('admin.settings.modal.toast_delete_msg'), async () => {
      await db.collection('audit_rules').doc(id).delete();
      setToast({ type: 'success', message: t('admin.settings.modal.toast_delete_success') });
    });
  };

  const updatePrompt = (type: 'generator' | 'auditor', platform: string, newVal: string) => {
    setSystemPrompts({
      ...systemPrompts,
      [type]: {
        ...systemPrompts[type],
        [platform]: newVal
      }
    });
  };

  return (
    <>
      <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 flex flex-col h-full">
        <SectionHeader title={t('admin.settings.title')} subtitle={t('admin.settings.subtitle')}>
          <div className="flex flex-wrap gap-6 w-full xl:w-auto">
            <button
              onClick={() => showConfirm(t('admin.settings.reset_intelligence'), t('admin.settings.reset_confirm'), () => {
                setSystemPrompts({ generator: GEN_PROMPTS_DEFAULTS, auditor: AUDIT_PROMPTS_DEFAULTS });
                setToast({ type: 'success', message: t('admin.settings.reset_success') });
              })}
              className="flex-1 lg:flex-none px-8 py-5 rounded-[2.5rem] text-label-caps opacity-40 hover:text-navy hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 flex items-center justify-center gap-4 italic"
            >
              <RotateCcw size={18} /> {t('admin.settings.refresh')}
            </button>
            <button
              onClick={() => {
                localStorage.setItem('moodbiz_prompts', JSON.stringify(systemPrompts));
                setToast({ type: 'success', message: t('admin.settings.sync_success') });
              }}
              className="group flex-1 lg:flex-none px-12 py-5 rounded-[2.5rem] bg-navy text-white text-label-caps !text-white shadow-2xl hover:bg-slate-800 flex items-center justify-center gap-4 transition-all active:scale-[0.97] shadow-glow border border-white/5 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan/20 via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <Save size={20} className="text-cyan group-hover:scale-110 transition-transform relative z-10" />
              <span className="relative z-10">{t('admin.settings.save')}</span>
            </button>
          </div>
        </SectionHeader>

        <div className="space-y-24">
          {/* SOP Rules Section */}
          <div className="premium-card p-16 glow border-none shadow-premium bg-white/80 backdrop-blur-sm relative overflow-hidden group/sop">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-navy/5 rounded-full blur-[120px] -mr-64 -mt-64 pointer-events-none" />

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 mb-16 border-b border-slate-100/50 pb-16 relative z-10">
              <div className="flex items-center gap-8">
                <div className="w-20 h-20 bg-navy text-white rounded-[2.5rem] shadow-glow flex items-center justify-center transform -rotate-6 group-hover/sop:rotate-0 transition-transform duration-700 border border-white/10">
                  <FileCode size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-navy/5 text-navy/80 text-label-caps mb-3 border border-navy/10 shadow-sm">
                    <Sparkles size={14} className="animate-pulse" /> Compliance Core
                  </div>
                  <h3 className="text-h1-premium leading-none mb-3">{t('admin.settings.standard_protocols')}</h3>
                  <p className="text-label-caps opacity-60">{t('admin.settings.governance_matrix')}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingRule({ type: 'ai_logic', code: '', label: '', content: '', apply_to_language: 'all' });
                  setIsRuleModalOpen(true);
                }}
                className="group px-10 py-5 rounded-[2.5rem] bg-navy text-white text-label-caps !text-white shadow-2xl hover:bg-slate-800 flex items-center justify-center gap-4 transition-all active:scale-[0.97] shadow-glow border border-white/5 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <Plus size={20} className="text-white group-hover:scale-110 transition-transform relative z-10" />
                <span className="relative z-10">{t('admin.settings.add_rule')}</span>
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10 relative z-10">
              {auditRules.map((rule, idx) => (
                <div key={rule.id} className="p-10 bg-white/50 rounded-[3rem] border border-slate-100/50 hover:border-navy/30 hover:shadow-2xl hover:shadow-navy/5 transition-all group/card animate-in fade-in slide-in-from-bottom-6 duration-700" style={{ animationDelay: `${idx * 100}ms` }}>
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex flex-col gap-3">
                      <span className={`px-4 py-1.5 rounded-[1rem] text-label-caps w-fit border shadow-inner-soft ${rule.type === 'language' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-navy/5 text-navy/70 border-navy/10'}`}>
                        {rule.type} protocol // {rule.code}
                      </span>
                      {rule.type === 'language' && (
                        <span className="text-label-caps opacity-60 flex items-center gap-2.5">
                          <Globe size={12} /> {rule.apply_to_language === 'all' || !rule.apply_to_language ? t('admin.settings.universal_vector') : `${rule.apply_to_language.toUpperCase()} CLUSTER`}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2.5 opacity-0 group-hover/card:opacity-100 transition-all transform translate-x-4 group-hover/card:translate-x-0">
                      <button onClick={() => { setEditingRule(rule); setIsRuleModalOpen(true); }} className="w-11 h-11 flex items-center justify-center text-blue-600 bg-white border border-slate-100 hover:bg-navy hover:text-white rounded-[1.2rem] transition-all shadow-soft"><Edit3 size={18} /></button>
                      <button onClick={() => handleDeleteRule(rule.id)} className="w-11 h-11 flex items-center justify-center text-rose-500 bg-white border border-slate-100 hover:bg-rose-500 hover:text-white rounded-[1.2rem] transition-all shadow-soft"><Trash2 size={18} /></button>
                    </div>
                  </div>
                  <h4 className="text-h2-premium mb-4 uppercase truncate italic">{rule.label}</h4>
                  <p className="text-subtitle-italic opacity-60 group-hover:opacity-100 transition-opacity drop-shadow-sm line-clamp-3">{rule.content}</p>

                  <div className="mt-8 pt-8 border-t border-slate-100/50 flex items-center justify-between">
                    <span className="text-label-caps">{t('admin.settings.mdx_clearance')}</span>
                    <Activity size={12} className="text-slate-200 group-hover/card:text-navy/40 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Unified Prompt Editor Section */}
          <div className="premium-card p-6 glow border-none shadow-premium bg-white/40 backdrop-blur-2xl relative overflow-hidden group/cluster">
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[150px] -ml-64 -mb-64 pointer-events-none" />

            <div className="flex flex-col lg:flex-row gap-8 h-[900px]">
              <div className="lg:w-96 shrink-0 bg-white rounded-[4rem] p-10 space-y-12 shadow-premium overflow-y-auto custom-scrollbar border border-slate-100/50">
                {/* Type Selector */}
                <div className="flex bg-slate-50 p-2 rounded-[2.5rem] shadow-inner-soft border border-slate-100/50 min-h-[70px]">
                  <button onClick={() => setActivePromptType('generator')} className={`flex-1 rounded-[2rem] text-label-caps transition-all duration-700 flex items-center justify-center gap-3 ${activePromptType === 'generator' ? 'bg-navy text-white shadow-2xl scale-[1.02] border border-white/5' : 'text-slate-400 hover:text-navy hover:bg-white'}`}>
                    <PenTool size={16} /> {t('common.generator')}
                  </button>
                  <button onClick={() => setActivePromptType('auditor')} className={`flex-1 rounded-[2rem] text-label-caps transition-all duration-700 flex items-center justify-center gap-3 ${activePromptType === 'auditor' ? 'bg-navy text-white shadow-2xl scale-[1.02] border border-white/5' : 'text-slate-400 hover:text-navy hover:bg-white'}`}>
                    <Activity size={16} /> {t('common.auditor')}
                  </button>
                </div>

                <div className="space-y-10">
                  <div className="flex items-center gap-6 px-4">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-white shadow-glow transform -rotate-6 transition-all duration-700 group-hover/cluster:rotate-0 border border-white/10 ${activePromptType === 'generator' ? 'bg-blue-600' : 'bg-cyan-600'}`}>
                      {activePromptType === 'generator' ? <BrainCircuit size={32} strokeWidth={2.5} /> : <SearchCode size={32} strokeWidth={2.5} />}
                    </div>
                    <div>
                      <h3 className="text-h2-premium leading-none mb-1">{activePromptType.toUpperCase()} {t('admin.settings.cluster')}</h3>
                      <p className="text-label-caps opacity-60">Active Core Nodes</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {Object.keys(PLATFORM_CONFIGS).map(platform => (
                      <button
                        key={platform}
                        onClick={() => setSelectedPromptPlatform(platform)}
                        className={`w-full text-left px-8 py-5 rounded-[2rem] text-label-caps transition-all duration-500 flex items-center gap-5 group/btn border relative overflow-hidden ${selectedPromptPlatform === platform ? 'bg-navy text-white border-white/10 shadow-2xl scale-[1.05] z-10' : 'text-slate-400 border-transparent hover:bg-slate-50 hover:text-navy'}`}
                      >
                        {selectedPromptPlatform === platform && (
                          <div className="absolute inset-0 bg-gradient-to-r from-cyan/5 to-transparent pointer-events-none" />
                        )}
                        <div className={`p-2.5 rounded-xl transition-all duration-500 ${selectedPromptPlatform === platform ? 'bg-white/10 text-cyan rotate-6' : 'bg-slate-50 text-slate-300 group-hover/btn:bg-white group-hover/btn:text-navy group-hover/btn:rotate-12'}`}>
                          {platform.includes('Facebook') && <Facebook size={16} />}
                          {platform.includes('LinkedIn') && <Linkedin size={16} />}
                          {platform.includes('Website') && <Globe size={16} />}
                          {platform.includes('Email') && <Mail size={16} />}
                          {!['Facebook', 'LinkedIn', 'Website', 'Email'].some(s => platform.includes(s)) && <Layout size={16} />}
                        </div>
                        <span className="truncate tracking-tight uppercase italic">{platform}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-white rounded-[4rem] p-16 shadow-premium flex flex-col animate-in fade-in duration-1000 relative overflow-hidden group/editor border border-slate-100/50" key={`${activePromptType}-${selectedPromptPlatform}`}>
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan/5 rounded-full blur-[150px] -mr-80 -mt-80 transition-all duration-1000 group-hover/editor:bg-cyan/10 pointer-events-none" />

                <div className="mb-14 flex flex-col md:flex-row justify-between items-start md:items-end gap-10 relative z-10">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-4 mb-5">
                      <span className={`px-5 py-2 rounded-full text-label-caps shadow-glow border border-white/10 ${activePromptType === 'generator' ? 'bg-navy text-white' : 'bg-cyan-600 text-white'}`}>
                        {activePromptType.toUpperCase()} STACK
                      </span>
                      <span className="w-2 h-2 rounded-full bg-cyan shadow-glow animate-pulse" />
                      <span className="text-label-caps opacity-60">{t('admin.settings.pathway_active')}</span>
                    </div>
                    <h4 className="text-h1-premium mb-4 italic">{selectedPromptPlatform}</h4>
                    <p className="text-subtitle-italic opacity-100 leading-relaxed border-l-4 border-slate-100 pl-6">{t('admin.settings.platform_desc')}: {PLATFORM_CONFIGS[selectedPromptPlatform]?.desc}</p>
                  </div>
                </div>

                <div className="flex-1 relative group/textarea-cont">
                  <div className="absolute top-8 left-8 z-20 flex gap-3 opacity-0 group-hover/textarea-cont:opacity-100 transition-all transform -translate-y-2 group-hover/textarea-cont:translate-y-0 duration-500 pointer-events-none">
                    <div className="px-4 py-2 bg-navy/90 backdrop-blur-xl text-white text-label-caps rounded-2xl border border-white/10 flex items-center gap-3 shadow-2xl">
                      <Terminal size={14} className="text-cyan animate-pulse" /> {t('admin.settings.live_kernel')}
                    </div>
                  </div>
                  <textarea
                    className="w-full h-full bg-slate-50/50 border border-slate-100/30 rounded-[3.5rem] p-14 font-mono text-[15px] font-bold text-navy placeholder:text-slate-200 focus:bg-white focus:ring-12 focus:ring-cyan/5 focus:border-cyan/20 transition-all custom-scrollbar outline-none shadow-inner-soft leading-relaxed selection:bg-navy selection:text-cyan italic"
                    value={systemPrompts[activePromptType][selectedPromptPlatform] || ''}
                    onChange={e => updatePrompt(activePromptType, selectedPromptPlatform, e.target.value)}
                    placeholder={t('admin.settings.placeholder_prompt', { type: activePromptType, platform: selectedPromptPlatform })}
                  />
                </div>

                <div className="mt-12 p-10 bg-navy rounded-[3.5rem] border border-white/5 flex flex-col md:flex-row items-center gap-10 relative z-10 shadow-2xl overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-cyan/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
                  <div className="p-5 bg-white/5 rounded-[2rem] shadow-glow text-cyan transform hover:rotate-12 transition-transform border border-white/5 shrink-0"><Sparkles size={28} strokeWidth={2.5} /></div>
                  <div className="flex-1">
                    <p className="text-label-caps opacity-30 mb-4 ml-1">{t('admin.settings.variables')}</p>
                    <div className="flex flex-wrap gap-x-8 gap-y-3">
                      {['{brand_name}', '{brand_voice}', '{product_context}', '{dont_words}', '{do_words}', '{guideline}'].map(v => (
                        <span key={v} className="text-label-caps !text-white/60 hover:!text-cyan transition-all cursor-help">{v}</span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 flex gap-1">
                    {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan/40 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      {/* Rule Edit Modal - Rendered at root level */}
      {isRuleModalOpen && editingRule && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
            {/* Header */}
            <div className="px-8 py-7 border-b border-slate-100 flex justify-between items-center bg-white relative z-10">
              <div>
                <h2 className="text-h2-premium">{editingRule.id ? t('admin.settings.modal.edit_rule') : t('admin.settings.modal.add_rule')}</h2>
                <p className="text-label-caps opacity-70 mt-1">{t('admin.settings.modal.rule_config')}</p>
              </div>
              <button onClick={() => setIsRuleModalOpen(false)} disabled={isSaving} className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-slate-50">
                <X size={28} />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-white space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-label-caps mb-2 ml-1 opacity-90">{t('admin.settings.modal.rule_type')}</label>
                  <div className="relative">
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-[#102d62] placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#102d62]/20 outline-none transition-all shadow-inner-soft appearance-none cursor-pointer"
                      value={editingRule.type}
                      onChange={e => setEditingRule({ ...editingRule, type: e.target.value as any })}
                      disabled={isSaving}
                    >
                      <option value="ai_logic">AI Logic</option>
                      <option value="language">Language</option>
                      <option value="brand">Brand</option>
                      <option value="product">Product</option>
                      <option value="legal">Legal</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  </div>
                </div>

                {editingRule.type === 'language' && (
                  <div>
                    <label className="block text-label-caps mb-2 ml-1 opacity-90">{t('admin.settings.modal.language_apply')}</label>
                    <div className="relative">
                      <select
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-[#102d62] placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#102d62]/20 outline-none transition-all shadow-inner-soft appearance-none cursor-pointer"
                        value={editingRule.apply_to_language || 'all'}
                        onChange={e => setEditingRule({ ...editingRule, apply_to_language: e.target.value as any })}
                        disabled={isSaving}
                      >
                        <option value="all">{t('admin.settings.modal.all')}</option>
                        <option value="vi">{t('admin.settings.modal.vi')}</option>
                        <option value="en">{t('admin.settings.modal.en')}</option>
                        <option value="ja">{t('admin.settings.modal.ja')}</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-label-caps mb-2 ml-1 opacity-90">{t('admin.settings.modal.code')}</label>
                  <input
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-[#102d62] placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#102d62]/20 outline-none transition-all shadow-inner-soft"
                    value={editingRule.code}
                    onChange={e => setEditingRule({ ...editingRule, code: e.target.value })}
                    placeholder={t('admin.settings.modal.placeholder_code')}
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-label-caps mb-2 ml-1 opacity-90">{t('admin.settings.modal.label')}</label>
                  <input
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-[#102d62] placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#102d62]/20 outline-none transition-all shadow-inner-soft"
                    value={editingRule.label}
                    onChange={e => setEditingRule({ ...editingRule, label: e.target.value })}
                    placeholder={t('admin.settings.modal.placeholder_label')}
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div>
                <label className="block text-label-caps mb-2 ml-1 opacity-90">{t('admin.settings.modal.md_content')}</label>
                <textarea
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-[#102d62] placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#102d62]/20 outline-none transition-all shadow-inner-soft h-64 font-mono custom-scrollbar"
                  value={editingRule.content}
                  onChange={e => setEditingRule({ ...editingRule, content: e.target.value })}
                  placeholder={t('admin.settings.modal.placeholder_md')}
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-4 relative z-10">
              <button type="button" onClick={() => setIsRuleModalOpen(false)} disabled={isSaving} className="px-8 py-3.5 rounded-[1.5rem] text-label-caps font-bold">{t('admin.settings.modal.cancel')}</button>
              <button type="button" onClick={handleSaveRule} disabled={isSaving} className="px-12 py-3.5 rounded-[1.5rem] bg-[#102d62] text-white flex items-center gap-2 shadow-xl shadow-blue-900/20 disabled:opacity-70 transition-all text-label-caps !text-white min-w-[200px] justify-center">
                {isSaving ? (
                  <><RotateCcw className="animate-spin" size={20} /> {t('admin.settings.modal.saving')}</>
                ) : (
                  editingRule.id ? t('admin.settings.modal.update') : t('admin.settings.modal.save')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsTab;