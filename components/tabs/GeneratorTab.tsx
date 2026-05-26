import React, { useState, useMemo, useEffect } from 'react';
import {
  RefreshCw, Sparkles, Copy, PenTool,
  Globe, Layout, Zap, BookOpen,
  Mail, Facebook, Linkedin, ShoppingBag,
  UserCircle, Users, Award, ShieldCheck, Target
} from 'lucide-react';
// @ts-ignore
import ReactMarkdown from 'react-markdown';
import { Brand, SystemPrompts, User, Auditor, Guideline, Product, Persona } from '../../types';
import SectionHeader from '../SectionHeader';
import { BrandSelector, CustomSelect, MultiSelect } from '../UIComponents';
import { SUPPORTED_LANGUAGES, PLATFORM_CONFIGS } from '../../constants';
import { generateContent } from '../../services/api';
import firebase, { db } from '../../firebase';
import { useTranslation } from 'react-i18next';

interface GeneratorTabProps {
  availableBrands: Brand[];
  selectedBrandId: string;
  setSelectedBrandId: (id: string) => void;
  systemPrompts: SystemPrompts;
  currentUser: User;
  setToast: (toast: any) => void;
  auditors: Auditor[];
  guidelines: Guideline[];
  persistentState: any;
  updatePersistentState: (data: any) => void;
}

const GeneratorTab: React.FC<GeneratorTabProps> = ({
  availableBrands,
  selectedBrandId,
  setSelectedBrandId,
  systemPrompts,
  currentUser,
  setToast,
  auditors,
  guidelines,
  persistentState,
  updatePersistentState
}) => {
  const { t } = useTranslation();
  // --- STATE PERSISTENCE LOGIC ---
  const [genPlatform, setGenPlatform] = useState(() => {
    return localStorage.getItem('moodbiz_generator_platform') || 'Facebook Post';
  });

  const [genLanguage, setGenLanguage] = useState(() => {
    return localStorage.getItem('moodbiz_generator_language') || 'Vietnamese';
  });

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(() => {
    return localStorage.getItem('moodbiz_generator_advanced_open') === 'true';
  });

  // Derived from persistentState
  const genTopic = persistentState.genTopic || '';
  const setGenTopic = (val: string) => updatePersistentState({ genTopic: val });

  const genResult = persistentState.genResult || '';
  const setGenResult = (val: string) => updatePersistentState({ genResult: val });

  const citations = persistentState.citations || [];
  const setCitations = (val: string[]) => updatePersistentState({ citations: val });

  const selectedProductIds = persistentState.selectedProductIds || [];
  const setSelectedProductIds = (val: string[]) => updatePersistentState({ selectedProductIds: val });

  const selectedPersonaId = persistentState.selectedPersonaId || '';
  const setSelectedPersonaId = (val: string) => updatePersistentState({ selectedPersonaId: val });

  // Sync Global Prefs
  useEffect(() => {
    localStorage.setItem('moodbiz_generator_platform', genPlatform);
    localStorage.setItem('moodbiz_generator_language', genLanguage);
    localStorage.setItem('moodbiz_generator_advanced_open', isAdvancedOpen.toString());
  }, [genPlatform, genLanguage, isAdvancedOpen]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);

  useEffect(() => {
    if (!selectedBrandId) return;

    // Fetch Products
    const unsubProducts = db.collection('products').where('brand_id', '==', selectedBrandId).onSnapshot(snap => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    // Fetch Personas
    const unsubPersonas = db.collection('personas').where('brand_id', '==', selectedBrandId).onSnapshot(snap => {
      setPersonas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Persona)));
    });

    return () => {
      unsubProducts();
      unsubPersonas();
    }
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
    const opts = [{ value: '', label: t('generator.select_product'), icon: Award }];
    products.forEach(p => {
      opts.push({ value: p.id, label: p.name, icon: ShoppingBag });
    });
    return opts;
  }, [products, t]);

  const personaOptions = useMemo(() => {
    const opts = [{ value: '', label: t('generator.select_persona'), icon: Users }];
    personas.forEach(p => {
      opts.push({ value: p.id, label: p.name, icon: UserCircle });
    });
    return opts;
  }, [personas, t]);

  // --- LOGIC CẢI TIẾN: LEARNING FROM MISTAKES ---
  const learningInsights = useMemo(() => {
    if (!auditors || !selectedBrandId) return { language: [], ai_logic: [], brand: [], product: [] };
    const brandAudits = auditors
      .filter(a => a.brand_id === selectedBrandId)
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
      .slice(0, 50);

    const uniqueIssues = {
      language: new Set<string>(),
      ai_logic: new Set<string>(),
      brand: new Set<string>(),
      product: new Set<string>()
    };

    brandAudits.forEach(audit => {
      const issues = audit.output_data?.identified_issues || [];
      issues.forEach((issue: any) => {
        const cat = (issue.category || 'language').toLowerCase();
        const reasonShort = issue.reason?.split('.')[0] || issue.reason;
        if (cat.includes('language')) uniqueIssues.language.add(reasonShort);
        else if (cat.includes('logic') || cat.includes('ai')) uniqueIssues.ai_logic.add(reasonShort);
        else if (cat.includes('brand')) uniqueIssues.brand.add(reasonShort);
        else if (cat.includes('product')) uniqueIssues.product.add(reasonShort);
      });
    });

    return {
      language: Array.from(uniqueIssues.language).slice(0, 5),
      ai_logic: Array.from(uniqueIssues.ai_logic).slice(0, 5),
      brand: Array.from(uniqueIssues.brand).slice(0, 5),
      product: Array.from(uniqueIssues.product).slice(0, 5)
    };
  }, [auditors, selectedBrandId]);

  const handleGenerate = async () => {
    const brand = availableBrands.find(b => b.id === selectedBrandId);
    if (!brand) { setToast({ type: 'error', message: t('generator.error_brand') }); return; }
    setIsGenerating(true);
    setGenResult('');

    const selectedProducts = products.filter(p => selectedProductIds.includes(p.id));
    const selectedPersona = personas.find(p => p.id === selectedPersonaId);

    let contextData = '';
    if (selectedProducts.length > 0) {
      selectedProducts.forEach((p, index) => {
        contextData += `[${t('products.modal.subtitle')} ${index + 1}: ${p.name}]\n- ${t('products.modal.audience_label')}: ${p.target_audience}\n- ${t('products.modal.benefits_label')}: ${p.benefits}\n- ${t('products.modal.usp_label')}: ${p.usp}\n\n`;
      });
    }

    if (selectedPersona) {
      contextData += `[${t('personas.modal.architecture')}: ${selectedPersona.name}]\n- ${t('personas.modal.job_label')}: ${selectedPersona.jobTitle} (${selectedPersona.industry})\n- ${t('personas.modal.goals_label')}: ${selectedPersona.goals}\n- ${t('personas.modal.pain_points_label')}: ${selectedPersona.painPoints}\n- ${t('auditor.language')}: ${selectedPersona.preferredLanguage}\n`;
    }

    if (!contextData) contextData = `[${t('products.title')} & ${t('personas.title')}] ${t('history.generations.brand_context')}`;

    const pastMistakes = `
[NEGATIVE KNOWLEDGE - ${t('history.audits.issues_detected', { count: 0 }).toUpperCase()}]
1. ${t('analytics.category.language.label')}: ${learningInsights.language.join(', ') || 'OK'}
2. ${t('analytics.category.ai_logic.label')}: ${learningInsights.ai_logic.join(', ') || 'OK'}
3. ${t('analytics.category.brand.label')}: ${learningInsights.brand.join(', ') || 'OK'}
4. ${t('analytics.category.product.label')}: ${learningInsights.product.join(', ') || 'OK'}`;

    const basePromptTemplate = systemPrompts.generator[genPlatform] || Object.values(systemPrompts.generator)[0];
    const systemPrompt = basePromptTemplate
      .replace(/{brand_name}/g, brand.name)
      .replace(/{brand_personality}/g, brand.brand_personality?.join(', ') || brand.personality)
      .replace(/{brand_voice}/g, brand.tone_of_voice || brand.voice)
      .replace(/{dont_words}/g, brand.dont_words?.join(', ') || 'N/A')
      .replace(/{do_words}/g, brand.do_words?.join(', ') || 'N/A')
      .replace(/{common_mistakes}/g, pastMistakes)
      .replace(/{language}/g, genLanguage)
      .replace(/{platform}/g, genPlatform)
      .replace(/{product_context}/g, contextData);

    const approvedGuidelines = guidelines.filter(g => g.brand_id === selectedBrandId && g.status === 'approved');
    const context = approvedGuidelines.map(g => `[Data Source: ${g.file_name}]: ${g.guideline_text || ''}`).join('\n\n');

    try {
      const data = await generateContent({ brand, topic: genTopic, platform: genPlatform, language: genLanguage, context, systemPrompt });
      setGenResult(data.result);
      setCitations(data.citations || []);

      const timestamp = Date.now();
      await db.collection('generations').doc(`GEN_${brand.id}_${timestamp}`).set({
        id: `GEN_${brand.id}_${timestamp}`,
        brand_id: brand.id,
        user_id: currentUser.uid,
        user_name: currentUser.name || currentUser.displayName,
        input_data: {
          platform: genPlatform, topic: genTopic, language: genLanguage,
          product_ids: selectedProductIds, persona_id: selectedPersonaId
        },
        output_data: data.result,
        citations: data.citations || [],
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e: any) {
      setGenResult(t('generator.error_system') + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 flex flex-col h-full space-y-8">
      <SectionHeader title={t('generator.title')} subtitle={t('generator.subtitle')} />

      <div className="flex flex-col gap-8 pb-20">
        {/* INPUT SECTION (TOP) */}
        <div className="premium-card p-8 flex flex-col gap-6 glow transition-all duration-700 border-none shadow-premium bg-white/90 backdrop-blur-xl relative group">
          <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan/5 rounded-full blur-[100px] -mr-32 -mt-32 group-hover:bg-cyan/10 transition-all duration-1000" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-30">
            {/* Column 1: Brand, Products, Persona */}
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">{t('generator.brand')}</p>
                <BrandSelector availableBrands={availableBrands} selectedBrandId={selectedBrandId} onChange={setSelectedBrandId} className="!rounded-2xl shadow-soft" />
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">{t('generator.target_product')}</p>
                <MultiSelect
                  options={productOptions}
                  value={selectedProductIds}
                  onChange={setSelectedProductIds}
                  placeholder={t('generator.placeholder_product')}
                  icon={ShoppingBag}
                  className="!rounded-2xl shadow-soft"
                />
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">{t('generator.target_persona')}</p>
                <CustomSelect
                  options={personaOptions}
                  value={selectedPersonaId}
                  onChange={setSelectedPersonaId}
                  placeholder={t('generator.placeholder_persona')}
                  className="!rounded-2xl shadow-soft"
                />
              </div>
            </div>

            {/* Column 2: Language, Platform */}
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t('generator.language')}</p>
                <CustomSelect options={languageOptions} value={genLanguage} onChange={setGenLanguage} icon={Globe} className="!rounded-2xl shadow-soft" />
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t('generator.platform')}</p>
                <CustomSelect options={platformOptions} value={genPlatform} onChange={setGenPlatform} className="!rounded-2xl shadow-soft" />
              </div>
            </div>

            {/* Column 3: Topic + Generate button */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t('generator.input_topic')}</p>
                <textarea
                  className="flex-1 w-full bg-slate-50/50 border border-slate-200 rounded-3xl p-5 min-h-[160px] text-[15px] font-bold text-navy placeholder:text-slate-300 focus:bg-white focus:ring-12 focus:ring-cyan/5 focus:border-cyan/30 transition-all custom-scrollbar outline-none shadow-inner-soft italic leading-relaxed resize-none"
                  placeholder={t('generator.placeholder_topic')}
                  value={genTopic}
                  onChange={e => setGenTopic(e.target.value)}
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !genTopic}
                className="w-full py-5 bg-navy text-white rounded-3xl font-black text-[13px] flex justify-center items-center gap-3 shadow-2xl hover:shadow-cyan/10 transition-all duration-1000 active:scale-[0.98] disabled:opacity-30 uppercase tracking-[0.3em] relative overflow-hidden group border border-white/10"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan/20 via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                {isGenerating ? <RefreshCw className="animate-spin text-cyan" size={22} /> : <Zap size={22} className="text-cyan drop-shadow-glow" />}
                <span className="relative z-10">{isGenerating ? t('generator.generating') : t('generator.start_generate')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* OUTPUT SECTION (BOTTOM) */}
        <div className="flex-1 min-h-[600px]">
          {genResult ? (
            <div className="premium-card h-full flex flex-col animate-in slide-in-from-bottom-12 duration-1000 bg-white shadow-premium relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan/5 rounded-full blur-[160px] -mr-64 -mt-64 pointer-events-none" />

              <div className="bg-navy px-8 py-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 shrink-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-cyan/5 opacity-50 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                <div className="flex items-center gap-8 relative z-10">
                  <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 text-cyan flex items-center justify-center shadow-glow shadow-cyan/20 transform rotate-3 hover:rotate-6 transition-all duration-700">
                    <Sparkles size={28} className="drop-shadow-glow" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-cyan text-[9px] font-black uppercase tracking-[0.2em] mb-3 shadow-inner-soft">
                      <Zap size={12} className="animate-pulse" />
                      {t('generator.result_badge')}
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-none">{t('generator.result_title')}</h3>
                  </div>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(genResult); setToast({ type: 'success', message: t('history.generations.copy_success') }); }}
                  className="xl:min-w-[180px] px-8 py-4 bg-white text-navy hover:bg-cyan hover:text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all duration-700 active:scale-95 shadow-2xl relative z-10 group/copy"
                >
                  <Copy size={18} className="text-cyan group-hover/copy:text-white transition-colors" />
                  {t('generator.copy')}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-10 md:p-16 relative z-10">
                <div className="text-prose-premium prose-navy max-w-none">
                  <ReactMarkdown>{genResult}</ReactMarkdown>
                </div>
              </div>

              {citations.length > 0 && (
                <div className="p-8 border-t border-slate-100 bg-slate-50/50 backdrop-blur-xl shrink-0 relative z-10">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-cyan/10 text-cyan border border-cyan/20"><BookOpen size={16} /></div>
                    <div>
                      <span className="text-[10px] font-black text-navy/40 uppercase tracking-[0.4em] block">{t('generator.citations_title')}</span>
                      <span className="text-[12px] font-bold text-slate-400 italic mt-0.5 block px-1">{t('generator.citations_subtitle', { count: citations.length })}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(citations as string[]).map((source: string, i: number) => (
                      <div key={i} className="px-6 py-3 bg-white text-navy rounded-full text-[12px] font-black border border-slate-200 flex items-center gap-3 shadow-soft hover:shadow-cyan/10 hover:border-cyan/30 hover:-translate-y-1 transition-all duration-500 group cursor-default">
                        <div className="w-2 h-2 rounded-full bg-cyan shadow-glow shadow-cyan/40 scale-0 group-hover:scale-100 transition-transform" />
                        <span className="opacity-60 group-hover:opacity-100 transition-opacity uppercase tracking-widest leading-none">{source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full premium-card border-none bg-slate-50/20 backdrop-blur-3xl shadow-inner-soft flex flex-col items-center justify-center text-slate-300 p-20 group transition-all duration-1000 hover:bg-white hover:shadow-premium min-h-[500px]">
              <div className="w-40 h-40 bg-white rounded-[4rem] shadow-2xl flex items-center justify-center mb-10 text-slate-50 group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000 group-hover:text-cyan/40 shadow-glow group-hover:border-cyan/10 border border-transparent relative">
                <div className="absolute inset-0 rounded-[inherit] border-4 border-dashed border-slate-100 animate-rotate-slow opacity-30" />
                <PenTool size={60} strokeWidth={0.5} className="group-hover:rotate-6 transition-transform relative z-10" />
              </div>
              <h3 className="font-black text-navy text-3xl mb-4 tracking-tighter uppercase opacity-30 italic">{t('generator.title')}</h3>
              <p className="text-[14px] text-slate-400 text-center max-w-sm font-bold leading-relaxed tracking-tight italic opacity-60">
                {t('generator.waiting_data')}
              </p>
              <div className="mt-12 flex gap-8 opacity-10 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-110">
                {[Globe, Zap, ShieldCheck, Target].map((Icon, i) => (
                  <div key={i} className="w-14 h-14 rounded-3xl bg-white flex items-center justify-center shadow-premium border border-slate-50 hover:bg-navy hover:text-white transition-all duration-700 hover:-translate-y-4 hover:shadow-glow hover:rotate-12">
                    <Icon size={24} strokeWidth={1.5} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneratorTab;