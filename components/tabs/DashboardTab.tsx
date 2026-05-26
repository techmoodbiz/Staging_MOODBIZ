import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenTool, Activity, Building2, Zap, Users, ShieldCheck, Target, Search, Globe, BarChart2 } from 'lucide-react';
import { User, Brand, Generation, Auditor } from '../../types';
import { StatCard, QuickActionCard, SkeletonCard, ActivityItem } from '../UIComponents';
import SectionHeader from '../SectionHeader';
import { db } from '../../firebase';
import { useTranslation } from 'react-i18next';

interface DashboardTabProps {
  currentUser: User;
  showLoading: boolean;
  availableBrands: Brand[];
  generations: Generation[];
  auditors: Auditor[];
}

const DashboardTab: React.FC<DashboardTabProps> = ({
  currentUser,
  showLoading,
  availableBrands,
  generations,
  auditors
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Real-world counts for users
  const [userCount, setUserCount] = useState('0');

  useEffect(() => {
    let unsubUsers = () => { };
    if (currentUser.role === 'admin') {
      unsubUsers = db.collection('users').onSnapshot(snap => setUserCount(snap.size.toString()));
    } else if (currentUser.role === 'brand_owner') {
      unsubUsers = db.collection('users').where('role', '==', 'content_creator').onSnapshot(snap => {
        const myBrands = currentUser.ownedBrandIds || [];
        const count = snap.docs.filter(doc => {
          const userData = doc.data();
          const assigned = userData.assignedBrandIds || [];
          return assigned.some((bid: string) => myBrands.includes(bid));
        }).length;
        setUserCount(count.toString());
      });
    }
    return () => unsubUsers();
  }, [currentUser]);

  // Derived stats array to ensure reactive translations and safe filtering
  const stats = React.useMemo(() => {
    const allStats = [
      { id: 'brands', label: t('dashboard.brands'), value: availableBrands.length.toString(), icon: Building2 },
      { id: 'generations', label: t('dashboard.generations'), value: generations.length.toString(), icon: Zap },
      { id: 'audits', label: t('dashboard.audits'), value: auditors.length.toString(), icon: ShieldCheck },
      { id: 'users', label: t('dashboard.users'), value: userCount, icon: Users },
    ];

    // Filter out restricted stats: only Admin and Owner can see user counts
    return allStats.filter(stat => {
      if (stat.id === 'users') {
        return currentUser.role === 'admin' || currentUser.role === 'brand_owner';
      }
      return true;
    });
  }, [t, availableBrands.length, generations.length, auditors.length, userCount, currentUser.role]);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4">
      {showLoading ? <SkeletonCard className="h-64" /> : (
        <div className="bg-navy rounded-[3rem] p-10 md:p-16 shadow-2xl relative overflow-hidden group">
          {/* Decorative Glows */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan/10 rounded-full blur-[120px] -mr-48 -mt-48 pointer-events-none group-hover:bg-cyan/15 transition-colors duration-1000"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -ml-32 -mb-32 pointer-events-none"></div>

          <div className="relative z-10 max-w-4xl">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-cyan text-[10px] font-black uppercase tracking-[0.2em] mb-10 shadow-inner-soft">
              <Activity className="w-3.5 h-3.5" />
              {t('dashboard.digital_partner')}
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-[1.1] mb-10">
              {t('dashboard.hello')}, <br />
              <span className="text-cyan drop-shadow-glow">{currentUser.name || currentUser.displayName || currentUser.email}</span>
            </h1>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 pt-10 border-t border-white/10">
              <div className="space-y-2">
                <p className="text-white/30 text-[10px] uppercase font-black tracking-[0.3em]">{t('dashboard.role')}</p>
                <p className="text-xl font-black text-white/90 capitalize tracking-tight flex items-center gap-2">
                  <ShieldCheck size={18} className="text-cyan" />
                  {currentUser.role.replace('_', ' ')}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-white/30 text-[10px] uppercase font-black tracking-[0.3em]">{t('dashboard.brands_managed')}</p>
                <p className="text-xl font-black text-white/90 tracking-tight flex items-center gap-2">
                  <Building2 size={18} className="text-cyan" />
                  {availableBrands.length}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-white/30 text-[10px] uppercase font-black tracking-[0.3em]">{t('dashboard.generations')}</p>
                <p className="text-xl font-black text-white/90 tracking-tight flex items-center gap-2">
                  <Zap size={18} className="text-cyan" />
                  {generations.length}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-white/30 text-[10px] uppercase font-black tracking-[0.3em]">{t('dashboard.audits')}</p>
                <p className="text-xl font-black text-white/90 tracking-tight flex items-center gap-2">
                  <ShieldCheck size={18} className="text-cyan" />
                  {auditors.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {(() => {
        const canAccessRankChecker = currentUser.role === 'admin' || currentUser.role === 'brand_owner';
        const gridCols = canAccessRankChecker
          ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
          : 'grid-cols-2 md:grid-cols-4';
        return (
          <div className={`grid ${gridCols} gap-6`}>
            <QuickActionCard compact={canAccessRankChecker} title={t('dashboard.create_content')} desc={t('dashboard.create_content_desc')} icon={PenTool} onClick={() => navigate('/generator')} color="blue" />
            <QuickActionCard compact={canAccessRankChecker} title={t('dashboard.ai_research')} desc={t('dashboard.ai_research_desc')} icon={Search} onClick={() => navigate('/research')} color="indigo" />
            <QuickActionCard compact={canAccessRankChecker} title={t('dashboard.check_voice')} desc={t('dashboard.check_voice_desc')} icon={Activity} onClick={() => navigate('/auditor')} color="cyan" />
            <QuickActionCard compact={canAccessRankChecker} title={t('dashboard.seo_inspector')} desc={t('dashboard.seo_inspector_desc')} icon={Globe} onClick={() => navigate('/seo-inspector')} color="emerald" />
            {canAccessRankChecker && (
              <QuickActionCard compact title={t('dashboard.rank_checker')} desc={t('dashboard.rank_checker_desc')} icon={BarChart2} onClick={() => navigate('/rank-checker')} color="violet" />
            )}
          </div>
        );
      })()}

      {/* Stats & Values */}
      <div className="space-y-8">
        <SectionHeader title={t('dashboard.brand_activities')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, idx) => (
            <StatCard key={stat.id} label={stat.label} value={stat.value} delay={idx * 100} icon={stat.icon} />
          ))}
        </div>
      </div>

      {/* Brand Values */}
      <div className="space-y-8">
        <SectionHeader title={t('dashboard.brand_values')} subtitle={t('dashboard.brand_values_subtitle')} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {availableBrands.length > 0 ? (
            availableBrands.map((brand, idx) => (
              <div key={brand.id} className="premium-card p-8 group hover:scale-[1.02] transition-all duration-700 animate-in fade-in" style={{ animationDelay: `${idx * 150}ms` }}>
                <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-50">
                  <div className="w-12 h-12 rounded-[1.25rem] bg-slate-50 text-navy border border-slate-100 flex items-center justify-center font-black uppercase shadow-inner-soft group-hover:bg-navy group-hover:text-white transition-colors">
                    {brand.name.substring(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-navy truncate" title={brand.name}>{brand.name}</h3>
                    <p className="text-label-caps opacity-60 truncate">{brand.industry || 'General'}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {brand.core_values && brand.core_values.length > 0 ? (
                    brand.core_values.slice(0, 4).map((val, vIdx) => (
                      <div key={vIdx} className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0"></div>
                        <span className="text-[13px] font-bold text-slate-500 truncate">{val}</span>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center">
                      <Target size={24} className="mx-auto text-slate-100 mb-2" />
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t('dashboard.no_values')}</span>
                    </div>
                  )}

                  {brand.core_values && brand.core_values.length > 4 && (
                    <div className="pt-2 pl-4">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">{t('dashboard.more_values', { count: brand.core_values.length - 4 })}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-20 premium-card bg-white/50 border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-400">
              <Building2 size={40} className="mb-4 opacity-10" />
              <p className="text-[11px] font-black uppercase tracking-widest opacity-40">{t('dashboard.no_brands')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      {(generations.length > 0 || auditors.length > 0) && (
        <div>
          <SectionHeader title={t('dashboard.recent_activities')} subtitle={t('dashboard.recent_activities_subtitle')} />
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="space-y-4">
              {[
                ...generations.map(g => ({ type: 'generator' as const, title: g.input_data.topic, subtitle: g.input_data.platform, time: g.timestamp, id: g.id })),
                ...auditors.map(a => ({ type: 'auditor' as const, title: t('dashboard.audit_content'), subtitle: a.brand_name || 'Brand', time: a.timestamp, id: a.id })),
              ]
                .sort((a, b) => (b.time?.seconds || 0) - (a.time?.seconds || 0))
                .slice(0, 5)
                .map(item => (
                  <ActivityItem key={item.id} type={item.type} title={item.title} subtitle={item.subtitle} time={item.time} />
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardTab;
