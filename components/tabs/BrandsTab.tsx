import React from 'react';
import {
  PlusCircle, Building2, Edit3, Trash2, Globe,
  Target, Palette, MessageSquare, Tag, LayoutGrid, List, Layers
} from 'lucide-react';
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

// ── helpers ─────────────────────────────────────────────────────────────────
const getBrandColor = (b: Brand) => b.primary_color || '#020617';

const hexLuminance = (hex: string) => {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const bl = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + bl * 114) / 1000;
};
const isLight = (hex: string) => hexLuminance(hex) > 160;

// Tạo màu text tương phản tốt với nền brand
const contrastText = (hex: string) => (isLight(hex) ? '#020617' : '#ffffff');

// ─────────────────────────────────────────────────────────────────────────────
const BrandsTab: React.FC<BrandsTabProps> = ({
  availableBrands, currentUser, setEditingBrand, setIsBrandModalOpen, handleDeleteBrand
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'brand_owner';

  // ── GRID CARD ─────────────────────────────────────────────────────────────
  const GridCard = ({ b, idx }: { b: Brand; idx: number }) => {
    const color    = getBrandColor(b);
    const light    = isLight(color);
    const textOn   = contrastText(color);
    const secondaries = b.secondary_colors?.slice(0, 4) || [];

    return (
      <div
        className="group relative bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 flex flex-col animate-in fade-in border border-slate-100 hover:-translate-y-1"
        style={{ animationDelay: `${idx * 60}ms` }}
      >
        {/* ── Color header ── */}
        <div className="relative h-36 flex flex-col justify-between p-5" style={{ backgroundColor: color }}>
          {/* mesh/noise overlay */}
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: `radial-gradient(circle at 80% 20%, ${light ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.25)'} 0%, transparent 60%)` }}
          />

          {/* Top row: industry + swatches */}
          <div className="relative z-10 flex items-center justify-between">
            {b.industry
              ? <span
                  className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest backdrop-blur-md"
                  style={{ backgroundColor: light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)', color: textOn }}
                >
                  {b.industry}
                </span>
              : <span />
            }

            {/* Color dots */}
            <div className="flex items-center gap-1.5">
              <div
                className="w-5 h-5 rounded-full border-2 shadow-md"
                style={{ backgroundColor: color, borderColor: light ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)' }}
              />
              {secondaries.map((sc, i) => (
                <div key={i} className="w-4 h-4 rounded-full border-2 shadow-sm"
                  style={{ backgroundColor: sc, borderColor: 'rgba(255,255,255,0.35)' }}
                />
              ))}
            </div>
          </div>

          {/* Brand avatar */}
          <div className="relative z-10 flex items-end justify-between">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-[22px] font-black shadow-xl border-2 translate-y-7"
              style={{
                backgroundColor: light ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.22)',
                borderColor: light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.35)',
                color: textOn,
                backdropFilter: 'blur(8px)',
              }}
            >
              {b.logo_url
                ? <img src={b.logo_url} alt={b.name} className="w-full h-full object-cover rounded-2xl" />
                : b.name.substring(0, 1).toUpperCase()
              }
            </div>

            {/* Domain pill */}
            {b.domain && (
              <span
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold backdrop-blur-md mb-0.5"
                style={{ backgroundColor: light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.18)', color: textOn }}
              >
                <Globe size={9} />
                {b.domain}
              </span>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="pt-10 px-5 pb-5 flex flex-col flex-1">
          {/* Name */}
          <h3 className="text-[17px] font-black text-navy leading-tight mb-1 group-hover:text-cyan transition-colors duration-300">
            {b.name}
          </h3>

          {/* Slogan / tagline */}
          {(b.slogan || b.tagline) && (
            <p className="text-[11px] text-slate-400 font-medium italic mb-3 line-clamp-1">
              "{b.slogan || b.tagline}"
            </p>
          )}

          {/* USP */}
          {b.usp && b.usp.length > 0 && (
            <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2 mb-4 flex-1">
              {b.usp[0]}
            </p>
          )}
          {(!b.usp || b.usp.length === 0) && <div className="flex-1" />}

          {/* Personality tags */}
          {b.brand_personality && b.brand_personality.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {b.brand_personality.slice(0, 4).map((p, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border"
                  style={{
                    backgroundColor: `${color}12`,
                    borderColor: `${color}30`,
                    color: hexLuminance(color) > 60 ? color : '#64748b',
                  }}
                >
                  {p}
                </span>
              ))}
              {b.brand_personality.length > 4 && (
                <span className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black text-slate-300">
                  +{b.brand_personality.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Action row */}
          <div className="flex gap-2 pt-3 border-t border-slate-100">
            <button
              onClick={() => { setEditingBrand(b); setIsBrandModalOpen(true); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95 shadow-md hover:shadow-lg hover:-translate-y-0.5"
              style={{ backgroundColor: color, boxShadow: `0 4px 14px ${color}50` }}
            >
              <Edit3 size={12} />
              {t('admin.brands.edit')}
            </button>
            {canEdit && (
              <button
                onClick={() => handleDeleteBrand(b.id)}
                className="w-10 flex items-center justify-center rounded-xl border border-slate-100 text-slate-300 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all active:scale-95"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── LIST ROW ──────────────────────────────────────────────────────────────
  const ListRow = ({ b, idx }: { b: Brand; idx: number }) => {
    const color  = getBrandColor(b);
    const textOn = contrastText(color);

    return (
      <div
        className="group bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all duration-300 overflow-hidden animate-in fade-in"
        style={{ animationDelay: `${idx * 40}ms` }}
      >
        <div className="flex items-center gap-4 px-4 py-3.5">
          {/* Avatar block with brand color */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-[15px] font-black flex-shrink-0 shadow-md transition-transform group-hover:scale-105 duration-300"
            style={{ backgroundColor: color, color: textOn, boxShadow: `0 4px 12px ${color}50` }}
          >
            {b.logo_url
              ? <img src={b.logo_url} alt={b.name} className="w-full h-full object-cover rounded-xl" />
              : b.name.substring(0, 1).toUpperCase()
            }
          </div>

          {/* Name + domain */}
          <div className="min-w-0 flex-1">
            <p className="font-black text-navy text-[14px] leading-tight group-hover:text-cyan transition-colors truncate">
              {b.name}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 truncate">
              {b.domain
                ? <><Globe size={9} className="flex-shrink-0" />{b.domain}</>
                : <><MessageSquare size={9} className="flex-shrink-0" />{b.slogan || b.tagline || '—'}</>
              }
            </p>
          </div>

          {/* Industry */}
          {b.industry && (
            <span
              className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex-shrink-0 border"
              style={{ backgroundColor: `${color}12`, borderColor: `${color}30`, color: hexLuminance(color) > 60 ? color : '#64748b' }}
            >
              <Tag size={8} />
              {b.industry}
            </span>
          )}

          {/* Personality */}
          <div className="hidden lg:flex items-center gap-1 flex-shrink-0 w-[190px]">
            {(b.brand_personality || []).slice(0, 3).map((p, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest truncate max-w-[60px] border"
                style={{ backgroundColor: `${color}10`, borderColor: `${color}25`, color: hexLuminance(color) > 60 ? color : '#94a3b8' }}
              >
                {p}
              </span>
            ))}
            {!b.brand_personality?.length && <span className="text-[11px] text-slate-200 italic">—</span>}
          </div>

          {/* Color swatches */}
          <div className="hidden xl:flex items-center gap-1.5 flex-shrink-0">
            <div className="w-5 h-5 rounded-full border-2 border-white shadow ring-1 ring-slate-100" style={{ backgroundColor: color }} />
            {b.secondary_colors?.slice(0, 3).map((c, i) => (
              <div key={i} className="w-4 h-4 rounded-full border-2 border-white shadow ring-1 ring-slate-100" style={{ backgroundColor: c }} />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <button
              onClick={() => { setEditingBrand(b); setIsBrandModalOpen(true); }}
              className="w-8 h-8 flex items-center justify-center rounded-xl transition-all active:scale-95 text-white shadow-sm"
              style={{ backgroundColor: color, boxShadow: `0 2px 8px ${color}60` }}
              title={t('admin.brands.edit')}
            >
              <Edit3 size={13} />
            </button>
            {canEdit && (
              <button
                onClick={() => handleDeleteBrand(b.id)}
                className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl border border-slate-100 hover:border-rose-100 transition-all active:scale-95"
                title={t('admin.brands.delete')}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in w-full pb-20 space-y-6">
      {/* Header */}
      <SectionHeader title={t('admin.brands.title')} subtitle={t('admin.brands.subtitle')}>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 p-1 bg-slate-100 rounded-xl">
            {(['grid', 'list'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                  viewMode === mode ? 'bg-white shadow-sm text-navy' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {mode === 'grid' ? <LayoutGrid size={14} /> : <List size={14} />}
              </button>
            ))}
          </div>

          {canEdit && (
            <button
              onClick={() => { setEditingBrand(null); setIsBrandModalOpen(true); }}
              className="group px-6 py-3.5 bg-navy text-white rounded-[1.25rem] transition-all hover:-translate-y-0.5 active:scale-95 text-label-caps !text-white relative overflow-hidden shadow-xl shadow-navy/20 flex items-center gap-2"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan/20 via-transparent to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <PlusCircle size={17} className="text-cyan flex-shrink-0" />
              <span className="relative z-10">{t('admin.brands.add_btn')}</span>
            </button>
          )}
        </div>
      </SectionHeader>

      {/* Stats pills */}
      {availableBrands.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 animate-in fade-in">
          {[
            { icon: Building2, value: availableBrands.length, label: 'thương hiệu', color: 'text-navy', bg: 'bg-slate-50', border: 'border-slate-200' },
            { icon: Globe,     value: availableBrands.filter(b => b.domain).length,         label: 'có domain',   color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100' },
            { icon: Palette,   value: availableBrands.filter(b => b.primary_color).length,  label: 'có màu sắc',  color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
            { icon: Layers,    value: availableBrands.filter(b => (b.brand_personality?.length ?? 0) > 0).length, label: 'có personality', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          ].map((s, i) => (
            <div key={i} className={`flex items-center gap-2 px-4 py-2.5 ${s.bg} border ${s.border} rounded-2xl shadow-sm`}>
              <s.icon size={14} className={s.color} />
              <span className={`text-[14px] font-black ${s.color}`}>{s.value}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {availableBrands.length === 0 && (
        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-24 text-center animate-in fade-in">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-slate-200" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] font-bold text-slate-400 mb-4">{t('admin.brands.empty_text')}</p>
          {canEdit && (
            <button
              onClick={() => { setEditingBrand(null); setIsBrandModalOpen(true); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
            >
              <PlusCircle size={14} className="text-cyan" />
              {t('admin.brands.add_btn')}
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {availableBrands.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {availableBrands.map((b, idx) => <GridCard key={b.id} b={b} idx={idx} />)}
        </div>
      )}

      {/* List */}
      {availableBrands.length > 0 && viewMode === 'list' && (
        <div className="space-y-2">
          {availableBrands.map((b, idx) => <ListRow key={b.id} b={b} idx={idx} />)}
        </div>
      )}
    </div>
  );
};

export default BrandsTab;
