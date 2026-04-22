import React from 'react';
import { PlusCircle, Building2, Edit3, Trash2, Target, Zap, Globe, ShieldCheck } from 'lucide-react';
import { Brand, User } from '../../types';
import SectionHeader from '../SectionHeader';
import { useTranslation } from 'react-i18next';

interface BrandsTabProps {
  availableBrands: Brand[];
  currentUser: User;
  setEditingBrand: (brand: Brand | null) => void;
  setIsBrandModalOpen: (isOpen: boolean) => void;
  handleDeleteBrand: (id: string) => void;
}

const BrandsTab: React.FC<BrandsTabProps> = ({ availableBrands, currentUser, setEditingBrand, setIsBrandModalOpen, handleDeleteBrand }) => {
  const { t } = useTranslation();

  return (
    <div className="animate-in fade-in w-full pb-20">
      <SectionHeader title={t('admin.brands.title')} subtitle={t('admin.brands.subtitle')}>
        {(currentUser.role === 'admin' || currentUser.role === 'brand_owner') && (
          <button
            onClick={() => { setEditingBrand(null); setIsBrandModalOpen(true); }}
            className="group px-8 py-4 bg-navy text-white rounded-[1.5rem] font-black hover:bg-slate-800 shadow-2xl flex items-center gap-3 transition-all hover:-translate-y-1 active:scale-95 text-xs uppercase tracking-[0.2em] relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan/20 via-transparent to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <PlusCircle size={20} className="text-cyan group-hover:rotate-90 transition-transform duration-500" />
            <span className="relative z-10 text-label-caps !text-white">{t('admin.brands.add_btn')}</span>
          </button>
        )}
      </SectionHeader>

      <div className="grid gap-6">
        {availableBrands.length === 0 ? (
          <div className="premium-card p-32 bg-slate-50/50 border-2 border-dashed border-slate-200 text-center text-slate-300">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner-soft shadow-glow-hover">
              <Building2 size={48} className="opacity-20" strokeWidth={1} />
            </div>
            <p className="text-label-caps opacity-50">{t('admin.brands.empty_text')}</p>
          </div>
        ) : availableBrands.map((b, idx) => (
          <div key={b.id} className="premium-card flex flex-col md:flex-row overflow-hidden group hover:border-cyan/30 duration-500 animate-in glow" style={{ animationDelay: `${idx * 150}ms` }}>
            {/* Brand Color Strip */}
            <div className="w-full md:w-4 shrink-0 transition-all group-hover:w-6 shadow-xl" style={{ backgroundColor: b.primary_color || '#0f172a' }}></div>

            <div className="p-7 flex-1 flex flex-col md:flex-row gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-5 mb-6">
                  <div className="w-14 h-14 bg-navy text-white rounded-2xl flex items-center justify-center shadow-glow transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 text-2xl font-black !text-white">
                    {b.name.substring(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-h2-premium group-hover:text-cyan transition-colors">{b.name}</h3>
                      {b.industry && <span className="px-2.5 py-0.5 bg-cyan/5 text-[10px] font-black uppercase tracking-widest !text-cyan rounded-full border border-cyan/10">{b.industry}</span>}
                    </div>
                    <p className="text-label-caps text-slate-500 ml-1">{b.slogan || b.tagline || 'Digital Growth Vector'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-50">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-400"><Zap size={12} className="text-amber-400" /> {t('products.modal.usp_label')}</span>
                    <p className="text-[14px] font-bold text-slate-600 leading-relaxed tracking-tight">{b.usp?.join(', ') || t('admin.brands.no_usp')}</p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-cyan-600"><Target size={12} className="text-cyan" /> {t('admin.brands.intelligence_profile')}</span>
                    <div className="flex flex-wrap gap-2">
                      {b.brand_personality?.slice(0, 4).map((p, i) => (
                        <span key={i} className="px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg text-[10px] uppercase font-black tracking-widest border border-slate-100 group-hover:border-cyan/20 transition-colors shadow-soft">
                          {p}
                        </span>
                      ))}
                      {(!b.brand_personality || b.brand_personality.length === 0) && <span className="text-subtitle-italic text-slate-400 ml-1 text-xs">{t('admin.brands.no_personality')}</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-7 md:pt-0 md:pl-7 min-w-[160px]">
                <button
                  onClick={() => { setEditingBrand(b); setIsBrandModalOpen(true); }}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-100 text-navy rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-cyan/30 hover:shadow-cyan/5 hover:bg-slate-50 transition-all shadow-soft active:scale-95"
                >
                  <Edit3 size={14} className="text-slate-400" /> {t('admin.brands.edit')}
                </button>
                {(currentUser.role === 'admin' || currentUser.role === 'brand_owner') && (
                  <button
                    onClick={() => handleDeleteBrand(b.id)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-soft active:scale-95"
                  >
                    <Trash2 size={14} /> {t('admin.brands.delete')}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BrandsTab;
