
import React, { useState, useEffect } from 'react';
import { FileText, Globe, X, Upload, Tag, Target, Palette, MessageSquare, ShieldCheck, Book, Sparkles, RefreshCw, Loader2, AlertTriangle, Zap } from 'lucide-react';
import { db } from '../firebase';
import firebase from '../firebase';
import { useTranslation } from 'react-i18next';
import { Brand, AnalysisResult, User } from '../types';
import { createGuidelineFromFile, analyzeWebsite, analyzeFile, approveGuideline } from '../services/api';

interface BrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (brand: Brand) => void;
  brand: Brand | null;
  currentUser: User;
  setToast: (toast: any) => void;
}

const BrandModal: React.FC<BrandModalProps> = ({ isOpen, onClose, onSave, brand, currentUser, setToast }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'identity' | 'strategy' | 'rules' | 'guideline'>('identity');
  const [formData, setFormData] = useState<Partial<Brand>>({});
  const [initialGuidelineType, setInitialGuidelineType] = useState<"none" | "file" | "website">("none");
  const [guidelineFile, setGuidelineFile] = useState<File | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isAnalyzingPreview, setIsAnalyzingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState(""); // Simplified state
  const [previewError, setPreviewError] = useState('');

  // FILE SIZE LIMIT (20MB in bytes)
  const MAX_FILE_SIZE = 20 * 1024 * 1024;

  useEffect(() => {
    if (isOpen) {
      if (brand) {
        setFormData({
          ...brand,
          secondary_colors: brand.secondary_colors || [],
          core_values: brand.core_values || [],
          usp: brand.usp || [],
          brand_personality: brand.brand_personality || [],
          do_words: brand.do_words || [],
          dont_words: brand.dont_words || []
        });
      } else {
        setFormData({
          id: Date.now().toString(),
          name: "",
          domain: "",
          personality: "",
          voice: "",
          slug: "",
          slogan: "",
          tagline: "",
          industry: "",
          positioning_statement: "",
          primary_color: "#102d62",
          secondary_colors: [],
          core_values: [],
          usp: [],
          brand_personality: [],
          do_words: [],
          dont_words: [],
          style_rules: ""
        });
      }
      setActiveTab('identity');
      setInitialGuidelineType("none");
      setGuidelineFile(null);
      setWebsiteUrl("");
      setSavingStatus(t('admin.brands.modal.saving'));
    }
  }, [brand, isOpen, t]);

  const updateField = (field: keyof Brand, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayInput = (field: keyof Brand, value: string) => {
    const items = value.split(',').map(i => i.trim()).filter(i => i !== "");
    updateField(field, items);
  };

  const applyAnalysisToBrand = (data: AnalysisResult) => {
    setFormData(prev => ({
      ...prev,
      name: data.brandName || prev.name,
      industry: data.industry || prev.industry,
      summary: data.summary || prev.summary,
      tone_of_voice: data.tone || prev.tone_of_voice,
      core_values: data.coreValues || prev.core_values,
      usp: data.keywords && data.keywords.length > 0 ? data.keywords : prev.usp,
      brand_personality: data.tone ? [data.tone] : prev.brand_personality,
      do_words: data.dos || prev.do_words,
      dont_words: data.donts || prev.dont_words,
      style_rules: data.visualStyle || prev.style_rules
    }));
    setToast({ type: 'success', message: t('admin.brands.modal.auto_fill_success') });
    setActiveTab('identity');
  };

  const handleAnalyzeWebsite = async () => {
    let url = (websiteUrl || '').trim();
    setPreviewError('');
    if (!url) { setPreviewError(t('admin.brands.modal.url_error')); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    setIsAnalyzingPreview(true);
    try {
      const data = await analyzeWebsite(url);
      applyAnalysisToBrand(data);
    } catch (err: any) {
      setPreviewError(err.message || t('research.error_system'));
    } finally {
      setIsAnalyzingPreview(false);
    }
  };

  const handleAnalyzeFile = async () => {
    if (!guidelineFile) { setPreviewError(t('admin.brands.modal.file_error')); return; }
    setPreviewError('');
    setIsAnalyzingPreview(true);
    try {
      const data = await analyzeFile(guidelineFile);
      applyAnalysisToBrand(data);
    } catch (err: any) {
      setPreviewError(err.message || t('research.error_system'));
    } finally {
      setIsAnalyzingPreview(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreviewError('');
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setPreviewError(t('admin.brands.modal.file_size_error', { size: MAX_FILE_SIZE / (1024 * 1024) }));
        setGuidelineFile(null);
      } else {
        setGuidelineFile(file);
      }
    } else {
      setGuidelineFile(null);
    }
  };

  const handleSubmit = async () => {
    const brandName = formData.name?.trim();
    if (!brandName) {
      setToast({ type: "error", message: t('admin.brands.modal.fill_name_error') });
      return;
    }

    setIsSaving(true);
    setSavingStatus(t('admin.brands.modal.saving'));

    try {
      const isNew = !brand; // Check if creating new brand
      const brandId = formData.id || Date.now().toString();
      const finalData: Brand = {
        ...formData as Brand,
        id: brandId,
        name: brandName,
        personality: formData.brand_personality?.join(', ') || formData.personality || '',
        voice: formData.tone_of_voice || formData.voice || ''
      };

      await db.collection("brands").doc(brandId).set(finalData, { merge: true });

      // LINK BRAND TO OWNER IF APPLICABLE
      if (isNew && currentUser.role === 'brand_owner') {
        await db.collection('users').doc(currentUser.uid).update({
          ownedBrandIds: firebase.firestore.FieldValue.arrayUnion(brandId)
        });
      }

      // AUTO-APPROVE / INGEST LOGIC (Skip Admin Approval)
      if (initialGuidelineType === "file" && guidelineFile) {
        setSavingStatus(t('admin.brands.modal.uploading'));
        const uploadRes = await createGuidelineFromFile(brandId, brandName, guidelineFile, currentUser);

        if (uploadRes && uploadRes.id) {
          setSavingStatus(t('admin.brands.modal.ingesting'));
          // Tự động gọi approve/ingest ngay lập tức
          await approveGuideline(uploadRes.id, true);
        }
      } else if (initialGuidelineType === "website" && websiteUrl.trim()) {
        const timestamp = Date.now();
        const guideId = `GUIDE_${brandId}_AUTO_${timestamp}`;

        setSavingStatus(t('admin.brands.modal.metadata_saving'));
        await db.collection("brand_guidelines").doc(guideId).set({
          id: guideId,
          brand_id: brandId,
          type: "auto_generated",
          status: "pending", // Sẽ chuyển sang approved ngay sau đó
          description: `Auto-generated from ${websiteUrl}`,
          file_name: `${brandName}-auto.md`,
          guideline_text: `# Brand Analysis from ${websiteUrl}\n\n${formData.summary || ''}`,
          created_at: firebase.firestore.FieldValue.serverTimestamp(),
        });

        setSavingStatus(t('admin.brands.modal.ingesting'));
        await approveGuideline(guideId, false);
      }

      setToast({ type: "success", message: t('admin.brands.modal.success_msg') });
      onSave?.(finalData);
      onClose();
    } catch (err: any) {
      setToast({ type: "error", message: err.message || t('admin.brands.modal.fill_name_error') });
    } finally {
      setIsSaving(false);
      setSavingStatus(t('admin.brands.modal.save_ingest'));
    }
  };

  if (!isOpen) return null;

  const inputClass = "w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#102d62] placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#102d62]/20 outline-none transition-all shadow-inner-soft";
  const labelClass = "block text-[11px] font-black text-[#102d62] uppercase tracking-[0.1em] mb-2 ml-1 opacity-90";

  const renderTabButton = (id: typeof activeTab, label: string, Icon: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === id
        ? 'bg-[#102d62] text-white shadow-lg shadow-blue-900/20'
        : 'text-slate-500 hover:bg-slate-100'
        }`}
    >
      <Icon size={18} /> {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
        <div className="px-8 py-7 border-b border-slate-100 flex justify-between items-center bg-white relative z-10">
          <div>
            <h2 className="text-2xl font-black text-[#102d62]">{brand ? t('admin.brands.modal.edit_title') : t('admin.brands.modal.add_title')}</h2>
            <p className="text-sm text-slate-500 font-bold mt-1 opacity-70">{t('admin.brands.modal.subtitle')}</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-slate-50">
            <X size={28} />
          </button>
        </div>

        <div className="px-8 py-3 border-b border-slate-50 flex gap-2 bg-slate-50/20 overflow-x-auto custom-scrollbar">
          {renderTabButton('identity', t('admin.brands.modal.tabs.identity'), Palette)}
          {renderTabButton('strategy', t('admin.brands.modal.tabs.strategy'), Target)}
          {renderTabButton('rules', t('admin.brands.modal.tabs.rules'), ShieldCheck)}
          {renderTabButton('guideline', t('admin.brands.modal.tabs.ingest'), Book)}
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-white">
          {activeTab === 'identity' && (
            <div className="space-y-6 animate-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>{t('admin.brands.modal.name_label')}</label>
                  <input className={inputClass} value={formData.name || ''} onChange={(e) => updateField('name', e.target.value)} placeholder="VD: MOODBIZ" />
                </div>
                <div>
                  <label className={labelClass}>{t('admin.brands.modal.industry_label')}</label>
                  <input className={inputClass} value={formData.industry || ''} onChange={(e) => updateField('industry', e.target.value)} placeholder="VD: Marketing, F&B..." />
                </div>
                <div>
                  <label className={labelClass}>{t('admin.brands.modal.slogan_label')}</label>
                  <input className={inputClass} value={formData.slogan || ''} onChange={(e) => updateField('slogan', e.target.value)} placeholder="Vươn cao cùng đối tác..." />
                </div>
                <div>
                  <label className={labelClass}>{t('admin.brands.modal.slug_label')}</label>
                  <input className={`${inputClass} font-mono`} value={formData.id || ''} onChange={(e) => updateField('id', e.target.value)} disabled={!!brand} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>{t('admin.brands.modal.domain_label')}</label>
                  <input
                    className={`${inputClass} font-mono`}
                    value={formData.domain || ''}
                    onChange={(e) => updateField('domain', e.target.value)}
                    placeholder={t('admin.brands.modal.domain_placeholder')}
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <label className={labelClass}><Palette size={14} className="inline mr-1" /> {t('admin.brands.modal.colors_label')}</label>
                <div className="flex items-center gap-8 mt-2">
                  <div className="flex flex-col items-center gap-2">
                    <input type="color" className="w-14 h-14 rounded-2xl cursor-pointer border-none p-0 shadow-sm" value={formData.primary_color || '#102d62'} onChange={(e) => updateField('primary_color', e.target.value)} />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('admin.brands.modal.primary')}</span>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">{t('admin.brands.modal.secondary')}</label>
                    <input className={inputClass} value={formData.secondary_colors?.join(', ') || ''} onChange={(e) => handleArrayInput('secondary_colors', e.target.value)} placeholder="#FFFFFF, #01CCFF..." />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'strategy' && (
            <div className="space-y-6 animate-in">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}><Zap size={14} className="inline mr-1" /> {t('admin.brands.modal.usp_label')}</label>
                  <textarea className={`${inputClass} h-32 custom-scrollbar`} value={formData.usp?.join('\n') || ''} onChange={(e) => updateField('usp', (e.target.value || '').split('\n'))} placeholder="Mỗi dòng là 1 lợi thế..." />
                </div>
                <div>
                  <label className={labelClass}><Target size={14} className="inline mr-1" /> {t('admin.brands.modal.positioning_label')}</label>
                  <textarea className={`${inputClass} h-32 custom-scrollbar`} value={formData.positioning_statement || ''} onChange={(e) => updateField('positioning_statement', e.target.value)} placeholder="Brand đứng ở đâu trong tâm trí khách hàng..." />
                </div>
              </div>

              <div>
                <label className={labelClass}>{t('admin.brands.modal.core_values_label')}</label>
                <input className={inputClass} value={formData.core_values?.join(', ') || ''} onChange={(e) => handleArrayInput('core_values', e.target.value)} placeholder="Chính trực, Sáng tạo, Đồng hành..." />
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-8 animate-in">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <label className={labelClass}><Tag size={14} className="inline mr-1" /> {t('admin.brands.modal.personality_label')}</label>
                  <input className={inputClass} value={formData.brand_personality?.join(', ') || ''} onChange={(e) => handleArrayInput('brand_personality', e.target.value)} placeholder="Professional, Strategic, Results-driven, Expert..." />
                </div>
                <div>
                  <label className={labelClass}><MessageSquare size={14} className="inline mr-1" /> {t('admin.brands.modal.tone_label')}</label>
                  <input className={inputClass} value={formData.tone_of_voice || ''} onChange={(e) => updateField('tone_of_voice', e.target.value)} placeholder="VD: Trân trọng nhưng gần gũi..." />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100 flex flex-col h-full">
                  <label className="text-[11px] font-black text-emerald-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span> {t('admin.brands.modal.do_words')}
                  </label>
                  <textarea className={`${inputClass} border-emerald-200/50 bg-white/50 focus:bg-white h-40 custom-scrollbar`} value={formData.do_words?.join(', ') || ''} onChange={(e) => handleArrayInput('do_words', e.target.value)} placeholder="Focus on measurable impact, Utilize advanced technology..." />
                </div>
                <div className="bg-red-50/50 p-6 rounded-[2rem] border border-red-100 flex flex-col h-full">
                  <label className="text-[11px] font-black text-red-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-red-500 rounded-full"></span> {t('admin.brands.modal.dont_words')}
                  </label>
                  <textarea className={`${inputClass} border-red-200/50 bg-white/50 focus:bg-white h-40 custom-scrollbar`} value={formData.dont_words?.join(', ') || ''} onChange={(e) => handleArrayInput('dont_words', e.target.value)} placeholder="Don't focus on vanity metrics, Don't act merely as a vendor..." />
                </div>
              </div>

              <div>
                <label className={labelClass}><ShieldCheck size={14} className="inline mr-1" /> {t('admin.brands.modal.style_rules_label')}</label>
                <textarea className={`${inputClass} h-32 custom-scrollbar`} value={formData.style_rules || ''} onChange={(e) => updateField('style_rules', e.target.value)} placeholder="VD: Xưng hô 'Chúng tôi' và 'Bạn', Viết hoa tên riêng..." />
              </div>
            </div>
          )}

          {activeTab === 'guideline' && (
            <div className="space-y-6 animate-in">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-[#01ccff]/10 flex items-center justify-center text-[#01ccff]"><Book size={24} /></div>
                <div>
                  <h3 className="font-black text-lg text-[#102d62]">{t('admin.brands.modal.ingest_title')}</h3>
                  <p className="text-sm font-bold text-slate-500 opacity-70">{t('admin.brands.modal.ingest_desc')}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setInitialGuidelineType("website")} className={`flex-1 p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${initialGuidelineType === "website" ? "border-[#102d62] bg-[#102d62]/5" : "border-slate-100 hover:border-blue-200"}`}>
                  <Globe size={28} className={initialGuidelineType === "website" ? "text-[#102d62]" : "text-slate-300"} />
                  <span className="text-xs font-black uppercase tracking-widest">{t('admin.brands.modal.scrape_btn')}</span>
                </button>
                <button type="button" onClick={() => setInitialGuidelineType("file")} className={`flex-1 p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${initialGuidelineType === "file" ? "border-[#102d62] bg-[#102d62]/5" : "border-slate-100 hover:border-blue-200"}`}>
                  <Upload size={28} className={initialGuidelineType === "file" ? "text-[#102d62]" : "text-slate-300"} />
                  <span className="text-xs font-black uppercase tracking-widest">{t('admin.brands.modal.upload_btn')}</span>
                </button>
              </div>

              {initialGuidelineType === "website" && (
                <div className="space-y-4 animate-in">
                  <div className="flex gap-3">
                    <input className={inputClass} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" />
                    <button onClick={handleAnalyzeWebsite} disabled={isAnalyzingPreview} className="px-8 bg-[#102d62] text-white rounded-2xl font-black flex items-center gap-2 disabled:opacity-50 hover:bg-[#0a1d40] transition-colors shadow-lg shadow-blue-900/10">
                      {isAnalyzingPreview ? <RefreshCw className="animate-spin" size={18} /> : <Globe size={18} />}
                      {t('admin.brands.modal.analyze_btn')}
                    </button>
                  </div>
                  {previewError && <p className="text-xs text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={14} /> {previewError}</p>}
                </div>
              )}

              {initialGuidelineType === "file" && (
                <div className="space-y-4 animate-in">
                  <div className="bg-slate-50 p-10 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center relative group transition-all hover:border-blue-200">
                    <input type="file" id="file-upload" className="hidden" onChange={handleFileChange} />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                        <FileText size={36} className="text-[#01ccff]" />
                      </div>
                      <p className="text-base font-black text-[#102d62]">{guidelineFile ? guidelineFile.name : t('admin.brands.modal.upload_placeholder')}</p>
                      <p className="text-xs font-bold text-slate-400 mt-1">{t('admin.brands.modal.upload_hint')}</p>
                    </label>
                  </div>

                  {guidelineFile && (
                    <div className="flex justify-center">
                      <button onClick={handleAnalyzeFile} disabled={isAnalyzingPreview} className="px-8 py-3 bg-[#102d62] text-white rounded-2xl font-black flex items-center gap-2 disabled:opacity-50 hover:bg-[#0a1d40] transition-colors shadow-lg shadow-blue-900/10">
                        {isAnalyzingPreview ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
                        {t('admin.brands.modal.analyze_btn')}
                      </button>
                    </div>
                  )}
                  {previewError && initialGuidelineType === 'file' && <p className="text-xs text-red-600 font-bold flex items-center gap-1 justify-center"><AlertTriangle size={14} /> {previewError}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-4 relative z-10">
          <button type="button" onClick={onClose} disabled={isSaving} className="px-8 py-3.5 text-sm font-black rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors uppercase tracking-widest">{t('admin.brands.modal.cancel')}</button>
          <button type="button" onClick={handleSubmit} disabled={isSaving} className="px-12 py-3.5 text-sm font-black rounded-2xl bg-[#102d62] text-white hover:bg-[#0a1d40] flex items-center gap-2 shadow-xl shadow-blue-900/20 disabled:opacity-70 transition-all uppercase tracking-widest min-w-[200px] justify-center">
            {isSaving ? <><Loader2 className="animate-spin" size={20} /> {savingStatus}</> : t('admin.brands.modal.save_ingest')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BrandModal;
