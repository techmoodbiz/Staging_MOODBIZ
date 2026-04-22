import React, { useMemo } from 'react';
import {
  Languages, BrainCircuit, Award, ShoppingBag,
  Shield, CheckCircle2, TrendingDown,
  Activity, AlertCircle, BarChart3, Zap
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

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  availableBrands,
  auditors,
  selectedBrandId,
  setSelectedBrandId
}) => {
  const { t } = useTranslation();

  const brandAudits = useMemo(() => {
    if (!selectedBrandId) return auditors;
    return auditors.filter(a => a.brand_id === selectedBrandId);
  }, [auditors, selectedBrandId]);

  const stats = useMemo(() => {
    const categories = [
      { id: 'language', icon: Languages, color: 'text-blue-500', bg: 'bg-blue-50', iconBg: 'bg-blue-50' },
      { id: 'ai_logic', icon: BrainCircuit, color: 'text-purple-500', bg: 'bg-purple-50', iconBg: 'bg-purple-50' },
      { id: 'brand', icon: Award, color: 'text-cyan-500', bg: 'bg-cyan-50', iconBg: 'bg-cyan-50' },
      { id: 'product', icon: ShoppingBag, color: 'text-emerald-500', bg: 'bg-emerald-50', iconBg: 'bg-emerald-50' },
      { id: 'legal', icon: Shield, color: 'text-rose-500', bg: 'bg-rose-50', iconBg: 'bg-rose-50' },
    ];

    return categories.map(cat => {
      let issuesCount = 0;
      brandAudits.forEach(audit => {
        const issues = audit.output_data?.identified_issues || [];
        issuesCount += issues.filter((i: any) => {
          const catName = (i.category || 'language').toLowerCase();
          if (cat.id === 'ai_logic') return catName.includes('logic') || catName.includes('ai');
          return catName.includes(cat.id);
        }).length;
      });

      // Simple incident rate calculation for demo/as per screenshot looks
      const rate = brandAudits.length > 0 ? Math.round((issuesCount / brandAudits.length) * 10) / 10 : 0;

      return {
        ...cat,
        items: issuesCount,
        incidentRate: rate,
        intensityRisk: rate > 5 ? 'High' : rate > 2 ? 'Medium' : 'Low',
        riskPercent: Math.min(Math.round(rate * 5), 100)
      };
    });
  }, [brandAudits]);

  const MetricCard = ({ data }: { data: any }) => (
    <div className="premium-card p-8 group hover:scale-[1.02] transition-all duration-700 animate-in">
      <div className="flex justify-between items-start mb-8">
        <div className={`p-4 rounded-xl ${data.bg} ${data.color} shadow-inner-soft group-hover:shadow-glow transition-all duration-500`}>
          <data.icon size={22} strokeWidth={2.5} />
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black text-slate-400 tracking-[0.2em] leading-none mb-2 uppercase">Identified Incidents</div>
          <div className="text-2xl font-black text-navy leading-none tabular-nums flex items-center justify-end gap-1.5">
            <AlertCircle size={16} className={data.items > 0 ? "text-rose-500" : "text-emerald-500"} />
            {data.items}
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-50">
        <h3 className="text-sm font-black text-navy uppercase tracking-tighter mb-2 group-hover:text-cyan transition-colors">{t(`analytics.category.${data.id}.label`)}</h3>
        <p className="text-[12px] text-slate-400 font-medium leading-relaxed italic opacity-80">
          {t(`analytics.category.${data.id}.desc`)}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-1000 space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <SectionHeader
          title={t('analytics.title')}
          subtitle={t('analytics.subtitle')}
        />
        <div className="min-w-[320px]">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 ml-2">{t('common.brand_label')}</p>
          <BrandSelector
            availableBrands={availableBrands}
            selectedBrandId={selectedBrandId}
            onChange={setSelectedBrandId}
            className="!rounded-2xl shadow-soft"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
        {stats.map((stat, idx) => (
          <MetricCard key={idx} data={stat} />
        ))}
      </div>

      {/* NEURAL COMPLIANCE FORECASTING ENGINE HERO */}
      <div className="bg-navy rounded-[3rem] p-12 md:p-20 shadow-2xl relative overflow-hidden group min-h-[500px] flex flex-col lg:flex-row items-center justify-between gap-16">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan/10 rounded-full blur-[150px] -mr-64 -mt-64 pointer-events-none group-hover:bg-cyan/15 transition-colors duration-1000" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px] -ml-64 -mb-64 pointer-events-none" />

        <div className="relative z-10 flex-1 max-w-2xl text-center lg:text-left">
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-cyan text-[10px] font-black uppercase tracking-[0.3em] mb-12 shadow-inner-soft">
            <Activity className="w-4 h-4" />
            {t('analytics.risk_protocol')}
          </div>

          <h1 className="text-4xl md:text-7xl font-black text-white leading-[1.1] tracking-tighter mb-12 uppercase">
            {t('analytics.compliance_title')} <br />
            <span className="text-cyan drop-shadow-glow">{t('analytics.forecasting_engine')}</span>
          </h1>

          <p className="text-white/40 text-sm md:text-base font-medium leading-relaxed max-w-xl italic">
            {t('analytics.desc')}
          </p>
        </div>

        <div className="relative z-10 w-full lg:w-[520px]">
          <div className="grid grid-cols-2 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-12 divide-x divide-white/10 shadow-premium group-hover:border-white/20 transition-all duration-700">
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="text-[120px] font-black text-white/5 line-height-none absolute inset-0 flex items-center justify-center select-none">0</div>
                <div className="text-5xl font-black text-white relative z-10 tabular-nums">0</div>
              </div>
              <div className="text-[11px] font-black text-white/30 uppercase tracking-[0.4em] pt-4">{t('analytics.neural_syncs')}</div>
            </div>
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="text-[120px] font-black text-white/5 line-height-none absolute inset-0 flex items-center justify-center select-none">0</div>
                <div className="text-5xl font-black text-white relative z-10 tabular-nums">0</div>
              </div>
              <div className="text-[11px] font-black text-white/30 uppercase tracking-[0.4em] pt-4">{t('analytics.threats_neutralized')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
