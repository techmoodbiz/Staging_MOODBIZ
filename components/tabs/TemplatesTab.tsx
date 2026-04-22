
import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Edit3, Type, Info, Activity, Sparkles, ChevronDown } from 'lucide-react';
import { Brand, ContentTemplate } from '../../types';
import { db } from '../../firebase';
import SectionHeader from '../SectionHeader';
import { BrandSelector } from '../UIComponents';
import { useTranslation } from 'react-i18next';

interface TemplatesTabProps {
  availableBrands: Brand[];
  selectedBrandId: string;
}

const TemplatesTab: React.FC<TemplatesTabProps> = ({ availableBrands, selectedBrandId: initialBrandId }) => {
  const { t } = useTranslation();
  const [brandId, setBrandId] = useState(initialBrandId);
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContentTemplate | null>(null);

  const [formData, setFormData] = useState<Partial<ContentTemplate>>({
    name: '', structure: 'AIDA', description: '', prompt_skeleton: ''
  });

  useEffect(() => {
    if (!brandId) return;
    return db.collection('content_templates').where('brand_id', '==', brandId).onSnapshot(snap => {
      setTemplates(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentTemplate)));
    });
  }, [brandId]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 flex flex-col h-full">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-12 mb-20">
        <SectionHeader title={t('templates.title')} subtitle={t('templates.subtitle')} />
        <button
          onClick={() => { setEditingTemplate(null); setFormData({ name: '', structure: 'AIDA', description: '', prompt_skeleton: '' }); setIsModalOpen(true); }}
          className="group px-10 py-5 bg-navy text-white rounded-[2.5rem] hover:bg-slate-800 shadow-2xl flex items-center gap-4 transition-all hover:shadow-cyan/10 active:scale-[0.97] text-label-caps !text-white relative overflow-hidden border border-white/5"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan/20 via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          <Plus size={22} className="text-cyan group-hover:rotate-90 transition-transform duration-700" />
          <span className="relative z-10">{t('templates.add_btn')}</span>
        </button>
      </div>

      <div className="mb-16 w-full max-w-sm">
        <label className="text-label-caps mb-5 block ml-1">{t('templates.brand_label')}</label>
        <BrandSelector availableBrands={availableBrands} selectedBrandId={brandId} onChange={setBrandId} />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-10 pb-32">
        {templates.map((template, idx) => (
          <div key={template.id} className="premium-card p-10 flex gap-8 hover:border-cyan/30 transition-all duration-700 animate-in glow group border-none shadow-premium bg-white/80 backdrop-blur-sm" style={{ animationDelay: `${idx * 100}ms` }}>
            <div className="w-20 h-20 bg-slate-50/50 text-navy rounded-3xl flex items-center justify-center shrink-0 shadow-inner-soft group-hover:bg-navy group-hover:text-cyan transition-all duration-700 group-hover:rotate-6 group-hover:scale-110 border border-slate-100/50 group-hover:border-white/10">
              <ClipboardList size={32} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-6 mb-6">
                <div>
                  <div className="inline-flex px-3 py-1 bg-cyan/10 text-cyan rounded-lg border border-cyan/10 mb-3 shadow-glow text-label-caps !text-cyan">{template.structure} {t('templates.matrix_suffix')}</div>
                  <h3 className="text-h2-premium leading-none">{template.name}</h3>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-4 group-hover:translate-x-0">
                  <button onClick={() => { setEditingTemplate(template); setFormData(template); setIsModalOpen(true); }} className="p-3 text-slate-400 hover:text-cyan hover:bg-cyan/5 rounded-2xl transition-all border border-transparent hover:border-cyan/10"><Edit3 size={18} /></button>
                  <button onClick={() => db.collection('content_templates').doc(template.id).delete()} className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all border border-transparent hover:border-rose-100"><Trash2 size={18} /></button>
                </div>
              </div>
              <p className="text-subtitle-italic opacity-60 group-hover:opacity-100 transition-opacity mb-8 drop-shadow-sm line-clamp-3">{template.description || t('templates.empty_desc')}</p>

              <div className="flex items-center justify-between pt-6 border-t border-slate-100/50">
                <span className="text-label-caps">{t('templates.protocol_id')}: {template.id.slice(0, 8)}</span>
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-cyan/30 group-hover:bg-cyan group-hover:animate-pulse transition-all duration-500" style={{ animationDelay: `${i * 200}ms` }} />)}
                </div>
              </div>
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="col-span-full py-40 premium-card border-2 border-dashed border-slate-200/50 bg-slate-50/20 flex flex-col items-center justify-center text-slate-300 group hover:bg-white hover:border-cyan/20 transition-all duration-1000">
            <div className="w-32 h-32 bg-white rounded-[4rem] shadow-2xl flex items-center justify-center mb-10 shadow-glow border border-transparent group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000">
              <ClipboardList size={56} strokeWidth={0.5} className="opacity-20 group-hover:opacity-40 transition-opacity" />
            </div>
            <h3 className="text-h2-premium opacity-30 mb-4">{t('templates.empty_title')}</h3>
            <p className="text-subtitle-italic opacity-60 text-center max-w-sm">{t('templates.empty_desc_init')}</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/80 backdrop-blur-xl p-8 animate-in fade-in duration-700">
          <div className="bg-white w-full max-w-3xl rounded-[5rem] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-700 border border-white/20 relative">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan/5 rounded-full blur-[120px] -mr-64 -mt-64 pointer-events-none" />

            <div className="px-16 py-12 border-b border-slate-100/50 flex items-center justify-between bg-white shrink-0 relative z-10">
              <div className="flex items-center gap-8">
                <div className="w-20 h-20 bg-navy text-cyan rounded-[2.5rem] shadow-glow flex items-center justify-center transform rotate-6 hover:rotate-12 transition-transform duration-700 border border-white/10">
                  <ClipboardList size={36} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-cyan/10 text-cyan text-label-caps mb-3 border border-cyan/10 shadow-glow">
                    <Sparkles size={14} className="animate-pulse" />
                    {t('templates.modal.config_title')}
                  </div>
                  <h2 className="text-h1-premium leading-none">{t('templates.modal.registry_title')}</h2>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-5 hover:bg-rose-50 rounded-[2rem] text-slate-300 hover:text-rose-500 transition-all duration-500 border border-transparent hover:border-rose-100 shadow-soft"
              >
                <Plus size={36} className="rotate-45" />
              </button>
            </div>

            <div className="p-16 space-y-12 overflow-y-auto custom-scrollbar relative z-0">
              <div className="space-y-10">
                <div className="group/field">
                  <label className="text-label-caps mb-5 block ml-1 group-focus-within/field:text-cyan transition-colors">{t('templates.modal.name_label')}</label>
                  <div className="relative">
                    <Type className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-200 group-focus-within/field:text-cyan transition-colors" size={20} />
                    <input className="w-full pl-16 pr-8 py-6 bg-slate-50/50 border border-slate-100/50 rounded-2.5xl text-[16px] font-bold text-navy outline-none focus:bg-white focus:ring-8 focus:ring-cyan/5 transition-all shadow-inner-soft placeholder:text-slate-200 italic" placeholder={t('templates.modal.name_placeholder')} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="group/field">
                    <label className="text-label-caps mb-5 block ml-1 group-focus-within/field:text-cyan transition-colors">{t('templates.modal.type_label')}</label>
                    <div className="relative">
                      <select className="w-full px-8 py-6 bg-slate-50/50 border border-slate-100/50 rounded-2.5xl text-label-caps outline-none focus:bg-white focus:ring-8 focus:ring-cyan/5 transition-all shadow-inner-soft appearance-none cursor-pointer italic" value={formData.structure} onChange={e => setFormData({ ...formData, structure: e.target.value as any })}>
                        <option value="AIDA">AIDA Model</option>
                        <option value="PAS">PAS Framework</option>
                        <option value="Storytelling">Storytelling Approach</option>
                        <option value="H-P-I-S-C">H-P-I-S-C Sequence</option>
                      </select>
                      <ChevronDown size={20} className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within/field:text-cyan transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="text-label-caps mb-5 block ml-1">{t('templates.modal.complexity_label')}</label>
                    <div className="flex gap-4">
                      {['Standard', 'Advanced', 'Expert'].map(level => (
                        <div key={level} className={`flex-1 py-6 text-center rounded-2.5xl text-label-caps transition-all duration-500 cursor-pointer border shadow-soft ${level === 'Advanced' ? 'bg-navy !text-white shadow-glow border-white/5' : 'bg-slate-50/50 text-slate-400 border-slate-100/50 hover:bg-white hover:border-cyan/20'}`}>
                          {level}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="group/field">
                  <label className="text-label-caps mb-5 block ml-1 group-focus-within/field:text-cyan transition-colors">{t('templates.modal.desc_label')}</label>
                  <div className="relative">
                    <Info className="absolute left-8 top-8 text-slate-200 group-focus-within/field:text-cyan transition-colors" size={20} />
                    <textarea className="w-full pl-16 pr-8 py-7 bg-slate-50/50 border border-slate-100/50 rounded-[2.5rem] h-32 text-[16px] font-bold text-navy outline-none focus:bg-white focus:ring-8 focus:ring-cyan/5 transition-all shadow-inner-soft resize-none italic leading-relaxed" placeholder={t('templates.modal.desc_placeholder')} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                </div>

                <div className="group/field">
                  <label className="text-label-caps mb-5 block ml-1 group-focus-within/field:text-cyan transition-colors">{t('templates.modal.skeleton_label')}</label>
                  <textarea className="w-full p-10 bg-navy text-cyan border border-white/5 rounded-[3rem] h-60 font-mono text-[13px] focus:ring-8 focus:ring-cyan/10 transition-all shadow-glow leading-relaxed selection:bg-cyan/20" placeholder={t('templates.modal.skeleton_placeholder')} value={formData.prompt_skeleton} onChange={e => setFormData({ ...formData, prompt_skeleton: e.target.value })} />
                  <div className="mt-6 flex items-center justify-between px-8">
                    <p className="flex items-center gap-3 italic opacity-60 text-label-caps">
                      <Activity size={14} className="text-cyan animate-pulse shadow-glow" /> {t('templates.modal.skeleton_hint')}
                    </p>
                    <div className="flex gap-1">
                      {[1, 2, 3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-cyan/40 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-16 py-10 bg-slate-50/20 border-t border-slate-100/50 flex justify-end items-center gap-8 shrink-0 relative z-10 bg-white/80 backdrop-blur-md">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-10 py-5 text-label-caps text-slate-400 hover:text-navy transition-all duration-500"
              >
                {t('templates.modal.cancel')}
              </button>
              <button
                onClick={async () => {
                  const data = { ...formData, brand_id: brandId };
                  if (editingTemplate) {
                    await db.collection('content_templates').doc(editingTemplate.id).update(data);
                  } else {
                    const timestamp = Date.now();
                    const templateId = `TPL_${brandId}_${timestamp}`;
                    await db.collection('content_templates').doc(templateId).set({ ...data, id: templateId });
                  }
                  setIsModalOpen(false);
                }}
                className="px-14 py-6 bg-navy text-white rounded-[2.5rem] shadow-2xl hover:shadow-glow transition-all duration-700 active:scale-[0.97] border border-white/5 text-label-caps !text-white"
              >
                {t('templates.modal.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesTab;
