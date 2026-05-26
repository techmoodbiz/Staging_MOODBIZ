import React, { useMemo } from 'react';
import {
  Languages, BrainCircuit, Award, ShoppingBag, Shield,
  CheckCircle2, TrendingDown, TrendingUp, Activity,
  AlertTriangle, BarChart3, Zap, ShieldCheck, AlertCircle,
  Target, Flame, ArrowUp, ArrowDown, Minus
} from 'lucide-react';
import SectionHeader from '../SectionHeader';
import { BrandSelector } from '../UIComponents';
import { useTranslation } from 'react-i18next';
import { Brand, Auditor } from '../../types';

interface AnalyticsTabProps {
  availableBrands: Brand[];
  auditors: Auditor[];
  selectedBrandId: string;
  setSelectedBrandId: (id: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'language', icon: Languages,    label: 'Language',    color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-100',   bar: 'bg-blue-500',    ring: 'ring-blue-100'   },
  { id: 'ai_logic', icon: BrainCircuit, label: 'AI & Logic',  color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-100', bar: 'bg-purple-500',  ring: 'ring-purple-100' },
  { id: 'brand',    icon: Award,        label: 'Brand Voice', color: 'text-navy',       bg: 'bg-slate-50',   border: 'border-slate-200',  bar: 'bg-slate-600',   ring: 'ring-slate-100'  },
  { id: 'product',  icon: ShoppingBag,  label: 'Product',     color: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-100',bar: 'bg-emerald-500', ring: 'ring-emerald-100'},
  { id: 'legal',    icon: Shield,       label: 'Legal',       color: 'text-rose-600',   bg: 'bg-rose-50',    border: 'border-rose-100',   bar: 'bg-rose-500',    ring: 'ring-rose-100'   },
];

const matchCat = (catName: string, id: string) => {
  const n = (catName || 'language').toLowerCase();
  if (id === 'ai_logic') return n.includes('logic') || n.includes('ai');
  return n.includes(id);
};

// ─────────────────────────────────────────────────────────────────────────────
const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  availableBrands, auditors, selectedBrandId, setSelectedBrandId
}) => {
  const { t } = useTranslation();

  const brandAudits = useMemo(() =>
    !selectedBrandId ? auditors : auditors.filter(a => a.brand_id === selectedBrandId),
    [auditors, selectedBrandId]
  );

  // ── Derived stats ──────────────────────────────────────────────────────────
  const derived = useMemo(() => {
    const total       = brandAudits.length;
    const compliant   = brandAudits.filter(a => (a.output_data?.identified_issues?.length || 0) === 0).length;
    const withIssues  = total - compliant;
    const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 0;

    // All issues flat
    const allIssues: any[] = brandAudits.flatMap(a => a.output_data?.identified_issues || []);
    const totalIssues = allIssues.length;
    const highCount   = allIssues.filter(i => i.severity?.toLowerCase() === 'high').length;
    const medCount    = allIssues.filter(i => i.severity?.toLowerCase() === 'medium').length;
    const lowCount    = allIssues.filter(i => i.severity?.toLowerCase() === 'low').length;

    // Per-category counts
    const catStats = CATEGORIES.map(cat => {
      const count = allIssues.filter(i => matchCat(i.category, cat.id)).length;
      const high  = allIssues.filter(i => matchCat(i.category, cat.id) && i.severity?.toLowerCase() === 'high').length;
      const med   = allIssues.filter(i => matchCat(i.category, cat.id) && i.severity?.toLowerCase() === 'medium').length;
      const low   = allIssues.filter(i => matchCat(i.category, cat.id) && i.severity?.toLowerCase() === 'low').length;
      const rate  = total > 0 ? +(count / total).toFixed(2) : 0;
      const risk  = rate > 3 ? 'High' : rate > 1 ? 'Medium' : 'Low';
      return { ...cat, count, high, med, low, rate, risk };
    });

    const maxCatCount = Math.max(...catStats.map(c => c.count), 1);
    const topCat = [...catStats].sort((a, b) => b.count - a.count)[0];

    // Platform breakdown
    const platformMap: Record<string, number> = {};
    brandAudits.forEach(a => {
      const p = a.input_data?.platform || 'Unknown';
      platformMap[p] = (platformMap[p] || 0) + 1;
    });
    const platforms = Object.entries(platformMap).sort((a, b) => b[1] - a[1]);

    return { total, compliant, withIssues, complianceRate, totalIssues, highCount, medCount, lowCount, catStats, maxCatCount, topCat, platforms };
  }, [brandAudits]);

  const { total, compliant, withIssues, complianceRate, totalIssues, highCount, medCount, lowCount, catStats, maxCatCount, topCat, platforms } = derived;

  // Compliance color
  const compColor = complianceRate >= 80 ? 'text-emerald-600' : complianceRate >= 50 ? 'text-amber-500' : 'text-rose-500';
  const compBg    = complianceRate >= 80 ? 'bg-emerald-50 border-emerald-100' : complianceRate >= 50 ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100';
  const compBar   = complianceRate >= 80 ? 'bg-emerald-500' : complianceRate >= 50 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="animate-in fade-in w-full pb-20 space-y-6">

      {/* ── Header ── */}
      <SectionHeader title={t('analytics.title')} subtitle={t('analytics.subtitle')}>
        <div className="min-w-[260px]">
          <BrandSelector
            availableBrands={availableBrands}
            selectedBrandId={selectedBrandId}
            onChange={setSelectedBrandId}
          />
        </div>
      </SectionHeader>

      {/* ── Summary KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
        {/* Compliance rate */}
        <div className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col gap-2 ${compBg}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Compliance Rate</span>
            <ShieldCheck size={16} className={compColor} />
          </div>
          <p className={`text-[32px] font-black leading-none tabular-nums ${compColor}`}>{complianceRate}<span className="text-[16px] ml-0.5">%</span></p>
          <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${compBar}`} style={{ width: `${complianceRate}%` }} />
          </div>
          <p className="text-[10px] text-slate-400">{compliant}/{total} audits passed</p>
        </div>

        {/* Total audits */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Audits</span>
            <Activity size={16} className="text-cyan" />
          </div>
          <p className="text-[32px] font-black text-navy leading-none tabular-nums">{total}</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
              <CheckCircle2 size={10} /> {compliant} passed
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
              <AlertTriangle size={10} /> {withIssues} flagged
            </span>
          </div>
        </div>

        {/* Total issues */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Issues</span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <p className="text-[32px] font-black text-navy leading-none tabular-nums">{totalIssues}</p>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">{highCount} HIGH</span>
            <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">{medCount} MED</span>
            <span className="flex items-center gap-1 text-[9px] font-black text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{lowCount} LOW</span>
          </div>
        </div>

        {/* Top risk category */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Risk</span>
            <Flame size={16} className="text-rose-500" />
          </div>
          {topCat && topCat.count > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${topCat.bg} ${topCat.border} border`}>
                  <topCat.icon size={15} className={topCat.color} />
                </div>
                <p className="text-[16px] font-black text-navy leading-tight">{topCat.label}</p>
              </div>
              <p className="text-[10px] text-slate-400">{topCat.count} issues · rate {topCat.rate}/audit</p>
            </>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <ShieldCheck size={20} className="text-emerald-400" />
              <p className="text-[14px] font-black text-emerald-600">No issues</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Category metric cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {catStats.map((cat, idx) => (
          <div
            key={cat.id}
            className="bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all duration-300 p-5 flex flex-col gap-4 animate-in fade-in"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            {/* Icon + count */}
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${cat.bg} ${cat.border}`}>
                <cat.icon size={17} className={cat.color} />
              </div>
              <div className="text-right">
                <p className="text-[28px] font-black text-navy leading-none tabular-nums">{cat.count}</p>
                <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">issues</p>
              </div>
            </div>

            {/* Label */}
            <div>
              <p className="text-[13px] font-black text-navy leading-tight">{cat.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{t(`analytics.category.${cat.id}.desc`)}</p>
            </div>

            {/* Bar chart relative to max */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Relative risk</span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                  cat.risk === 'High' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                  cat.risk === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                  'bg-emerald-50 text-emerald-600 border-emerald-100'
                }`}>{cat.risk}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${cat.bar}`}
                  style={{ width: `${maxCatCount > 0 ? Math.round((cat.count / maxCatCount) * 100) : 0}%` }}
                />
              </div>
            </div>

            {/* Severity breakdown */}
            {cat.count > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {cat.high > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded">{cat.high}H</span>}
                {cat.med  > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded">{cat.med}M</span>}
                {cat.low  > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 bg-slate-50 text-slate-500 border border-slate-100 rounded">{cat.low}L</span>}
              </div>
            )}
            {cat.count === 0 && (
              <div className="flex items-center gap-1.5 text-emerald-500">
                <CheckCircle2 size={12} />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Clean</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Bottom row: Risk Matrix + Platform breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">

        {/* Risk distribution chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center">
              <BarChart3 size={17} className="text-cyan" />
            </div>
            <div>
              <h3 className="text-[14px] font-black text-navy">Risk Distribution</h3>
              <p className="text-[10px] text-slate-400">Issues per category — all severities</p>
            </div>
          </div>

          <div className="space-y-3">
            {catStats.map(cat => {
              const pct = maxCatCount > 0 ? Math.round((cat.count / maxCatCount) * 100) : 0;
              return (
                <div key={cat.id} className="flex items-center gap-3">
                  <div className="w-[90px] flex-shrink-0 flex items-center gap-2">
                    <cat.icon size={12} className={cat.color} />
                    <span className="text-[11px] font-bold text-slate-600 truncate">{cat.label}</span>
                  </div>
                  <div className="flex-1 h-7 bg-slate-50 rounded-xl overflow-hidden relative border border-slate-100">
                    <div
                      className={`h-full rounded-xl transition-all duration-700 flex items-center px-2 ${cat.bar}`}
                      style={{ width: `${Math.max(pct, cat.count > 0 ? 8 : 0)}%` }}
                    />
                    <span className="absolute inset-y-0 left-3 flex items-center text-[10px] font-black text-white mix-blend-difference pointer-events-none">
                      {cat.count > 0 ? cat.count : ''}
                    </span>
                  </div>
                  <div className="w-[60px] flex-shrink-0 text-right">
                    <span className="text-[11px] font-black text-navy">{cat.count}</span>
                    <span className="text-[9px] text-slate-300 ml-1">/{total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Compliance gauge */}
          <div className="bg-navy rounded-2xl p-6 text-white shadow-xl relative overflow-hidden flex-1">
            <div className="absolute top-0 right-0 w-40 h-40 bg-cyan/10 rounded-full blur-3xl -mr-10 -mt-10" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={14} className="text-cyan" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{t('analytics.risk_protocol')}</span>
              </div>

              {/* Big compliance number */}
              <div className="mb-4">
                <p className="text-[56px] font-black leading-none tabular-nums text-white">{complianceRate}<span className="text-[24px] text-white/40">%</span></p>
                <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mt-1">compliance rate</p>
              </div>

              {/* Progress ring replacement — simple bar */}
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                <div className={`h-full rounded-full transition-all duration-700 ${complianceRate >= 80 ? 'bg-emerald-400' : complianceRate >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                  style={{ width: `${complianceRate}%` }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-[22px] font-black text-white tabular-nums">{total}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mt-0.5">{t('analytics.neural_syncs')}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-[22px] font-black text-white tabular-nums">{compliant}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mt-0.5">{t('analytics.threats_neutralized')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Platform breakdown */}
          {platforms.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target size={14} className="text-slate-400" />
                <h4 className="text-[12px] font-black text-navy uppercase tracking-widest">By Platform</h4>
              </div>
              <div className="space-y-2">
                {platforms.slice(0, 4).map(([name, count], i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 truncate flex-1">{name}</span>
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan rounded-full" style={{ width: `${Math.round((count / (platforms[0]?.[1] || 1)) * 100)}%` }} />
                    </div>
                    <span className="text-[11px] font-black text-navy w-5 text-right">{count}</span>
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

export default AnalyticsTab;
