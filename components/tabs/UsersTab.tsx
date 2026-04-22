import React, { useMemo } from 'react';
import { Users, UserPlus, Shield, Smartphone, Mail, Cpu, PlusCircle, Edit3, Trash2, ScrollText, RotateCcw, BarChart3, TrendingUp } from 'lucide-react';
import { User, Brand } from '../../types';
import { db } from '../../firebase';
import SectionHeader from '../SectionHeader';
import { BrandSelector } from '../UIComponents';
import UsageHistoryModal from '../UsageHistoryModal';
import { useTranslation } from 'react-i18next';

interface UsersTabProps {
  users: User[];
  brands: Brand[];
  currentUser: User;
  setEditingUser: (user: User | null) => void;
  setIsUserModalOpen: (isOpen: boolean) => void;
  handleDeleteUser: (id: string) => void;
}

const UsersTab: React.FC<UsersTabProps> = ({ users, brands, currentUser, setEditingUser, setIsUserModalOpen, handleDeleteUser }) => {
  const { t } = useTranslation();
  const [historyUser, setHistoryUser] = React.useState<User | null>(null);
  const [reportMode, setReportMode] = React.useState(false);

  // Filter users based on role permissions
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Admin sees all users
      if (currentUser.role === 'admin') return true;
      // Brand Owner sees only their content creators
      if (currentUser.role === 'brand_owner') {
        if (u.role === 'content_creator') {
          const hasSharedBrand = u.assignedBrandIds?.some(id => currentUser.ownedBrandIds?.includes(id));
          return hasSharedBrand;
        }
        return u.uid === currentUser.uid;
      }
      return false;
    });
  }, [users, currentUser]);

  const handleResetTokens = async (userId: string) => {
    if (!window.confirm(t('admin.users.confirm_reset'))) return;

    try {
      await db.collection('users').doc(userId).update({
        'usageStats.totalTokens': 0,
        'usageStats.requestCount': 0,
        'usageStats.breakdown': {}
      });
      alert(t('admin.users.reset_success'));
    } catch (error) {
      console.error('Reset failed:', error);
      alert(t('admin.users.reset_error'));
    }
  };

  // Helper to format large numbers (e.g. 1500 -> 1.5k)
  const formatTokenCount = (num: number) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toLocaleString();
  };

  const UsageChart = () => {
    const chartData = useMemo(() => {
      // Get top 10 users by usage for the chart
      return [...filteredUsers]
        .sort((a, b) => (b.usageStats?.totalTokens || 0) - (a.usageStats?.totalTokens || 0))
        .slice(0, 10)
        .map(u => ({
          name: u.name || u.displayName || u.email?.split('@')[0] || 'Unknown',
          tokens: u.usageStats?.totalTokens || 0
        }));
    }, [filteredUsers]);

    const maxTokens = Math.max(...chartData.map(d => d.tokens), 1);

    return (
      <div className="bg-white rounded-[2rem] p-6 shadow-2xl border border-slate-100 mb-8 animate-in fade-in slide-in-from-top-8 duration-700">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-navy rounded-xl flex items-center justify-center text-cyan shadow-glow shadow-cyan/20">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="text-h2-premium leading-none mb-1">{t('admin.users.usage_distribution')}</h3>
              <p className="text-label-caps opacity-60">{t('admin.users.top_nodes')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-[1rem] text-emerald-600 border border-emerald-100 shadow-sm">
            <TrendingUp size={16} strokeWidth={3} />
            <span className="text-label-caps leading-none">{t('admin.users.live_sync')}</span>
          </div>
        </div>

        <div className="flex items-end gap-5 h-64 px-4 overflow-x-auto custom-scrollbar pt-8">
          {chartData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center group min-w-[60px] h-full">
              <div className="relative w-full flex flex-col items-center justify-end h-full">
                <div
                  className="w-full bg-gradient-to-t from-navy via-navy to-cyan rounded-t-xl transition-all duration-1000 ease-out group-hover:shadow-glow group-hover:shadow-cyan/30 relative"
                  style={{ height: `${(d.tokens / maxTokens) * 100}%`, minHeight: '4px' }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-navy text-white text-label-caps px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap shadow-xl">
                    {formatTokenCount(d.tokens)}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-label-caps opacity-40 text-center truncate w-full group-hover:text-navy group-hover:opacity-100 transition-all">{d.name}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in w-full pb-20">
      <SectionHeader title={t('admin.users.title')} subtitle={t('admin.users.subtitle')}>
        <div className="flex gap-4">
          {(currentUser.role === 'admin' || currentUser.role === 'brand_owner') && (
            <button
              onClick={() => setReportMode(!reportMode)}
              className={`px-6 py-4 rounded-[1.5rem] text-label-caps transition-all shadow-lg flex items-center gap-2 ${reportMode ? 'bg-cyan text-white shadow-cyan/20' : 'bg-white text-navy border border-slate-100'
                }`}
            >
              <Cpu size={18} />
              {reportMode ? t('admin.users.table_view') : t('admin.users.token_report')}
            </button>
          )}

          <button
            onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}
            className="group px-8 py-4 bg-navy text-white rounded-[1.5rem] transition-all hover:-translate-y-1 active:scale-95 text-label-caps !text-white relative overflow-hidden shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan/20 via-transparent to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <PlusCircle size={20} className="text-cyan group-hover:rotate-90 transition-transform duration-500" />
            <span className="relative z-10">{t('admin.users.add_btn')}</span>
          </button>
        </div>
      </SectionHeader>

      {reportMode && <UsageChart />}

      <div className="premium-card overflow-hidden glow border-none shadow-2xl w-full">
        <div className="overflow-x-auto custom-scrollbar">
          {reportMode ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-6">
                <tr>
                  <th className="px-5 py-4 text-left whitespace-nowrap sticky left-0 bg-white z-10 drop-shadow-sm">{t('admin.users.identity')}</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap bg-blue-50/50">{t('admin.users.total')}</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap text-purple-600">{t('admin.users.breakdown.audit_logic_legal')}</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap text-blue-600">{t('admin.users.breakdown.audit_brand_product')}</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap text-emerald-600">{t('admin.users.breakdown.audit_language')}</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap">{t('admin.users.breakdown.generate')}</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap">{t('admin.users.breakdown.scrape')}</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap">{t('admin.users.breakdown.file')}</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap">{t('admin.users.breakdown.website')}</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap">{t('admin.users.breakdown.ocr')}</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap">{t('admin.users.breakdown.clean')}</th>
                  <th className="px-5 py-4 text-right text-cyan-600">{t('admin.users.breakdown.research')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((u, idx) => {
                  const bd = u.usageStats?.breakdown || {};
                  return (
                    <tr key={u.id} className="group/row hover:bg-slate-50/50 transition-all">
                      <td className="px-5 py-2.5 sticky left-0 bg-white group-hover/row:bg-slate-50/50 text-[13px] font-black text-navy border-r border-slate-100">
                        {u.name || u.displayName || u.email}
                      </td>
                      <td className="px-5 py-2.5 text-right font-black text-navy bg-blue-50/30 text-[13px]">
                        {formatTokenCount(u.usageStats?.totalTokens || 0)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-purple-700 font-black text-[12px]">{formatTokenCount(bd['AUDIT_LOGIC_LEGAL'] || 0)}</td>
                      <td className="px-5 py-2.5 text-right text-blue-700 font-black text-[12px]">{formatTokenCount(bd['AUDIT_BRAND_PRODUCT'] || 0)}</td>
                      <td className="px-5 py-2.5 text-right text-emerald-700 font-black text-[12px]">{formatTokenCount(bd['AUDIT_LANGUAGE'] || 0)}</td>
                      <td className="px-5 py-2.5 text-right text-slate-500 text-[12px] font-bold">{formatTokenCount(bd['GENERATE_CONTENT'] || 0)}</td>
                      <td className="px-5 py-2.5 text-right text-slate-500 text-[12px] font-bold">{formatTokenCount(bd['SCRAPE_WEBSITE'] || 0)}</td>
                      <td className="px-5 py-2.5 text-right text-slate-500 text-[12px] font-bold">{formatTokenCount(bd['ANALYZE_FILE'] || 0)}</td>
                      <td className="px-5 py-2.5 text-right text-slate-500 text-[12px] font-bold">{formatTokenCount(bd['ANALYZE_WEBSITE'] || 0)}</td>
                      <td className="px-5 py-2.5 text-right text-slate-500 text-[12px] font-bold">{formatTokenCount(bd['APPROVE_INGEST_FILE'] || 0)}</td>
                      <td className="px-5 py-2.5 text-right text-slate-500 text-[12px] font-bold">{formatTokenCount(bd['APPROVE_INGEST_TEXT'] || 0)}</td>
                      <td className="px-5 py-2.5 text-right text-cyan-700 font-black text-[12px]">{formatTokenCount(bd['RESEARCH_ANALYSIS_GEMINI'] || 0)}</td>
                      <td className="px-5 py-2.5 text-right">
                        <button
                          onClick={() => handleResetTokens(u.id!)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-95"
                          title="Reset Token Count"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-label-caps leading-none">
                <tr>
                  <th className="px-6 py-4 text-left whitespace-nowrap">{t('admin.users.table.name')}</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">{t('admin.users.table.email')}</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">{t('admin.users.table.role')}</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">{t('admin.users.table.usage')}</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">{t('admin.users.table.brands')}</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">{t('admin.users.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.filter(u => {
                  if (u.role === 'admin' && currentUser.role !== 'admin') return false;
                  if (currentUser.role === 'brand_owner') {
                    if (u.role === 'brand_owner' && u.uid !== currentUser.uid) return false;
                    if (u.role === 'content_creator') {
                      const hasSharedBrand = u.assignedBrandIds?.some(id => currentUser.ownedBrandIds?.includes(id));
                      if (!hasSharedBrand) return false;
                    } else if (u.uid !== currentUser.uid) {
                      return false;
                    }
                  }
                  return true;
                }).map((u, idx) => {
                  const brandsList = (u.role === 'brand_owner' ? u.ownedBrandIds : u.assignedBrandIds)?.map(id => brands.find(b => b.id === id)?.name).filter(Boolean).join(', ') || '-';
                  const tokens = u.usageStats?.totalTokens || 0;
                  const requests = u.usageStats?.requestCount || 0;

                  return (
                    <tr key={u.id} className="group/row hover:bg-slate-50/50 transition-all duration-300 animate-in fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-navy/5 text-navy flex items-center justify-center text-[10px] font-black group-hover/row:bg-navy group-hover/row:!text-white transition-all duration-500">
                            {(u.name || u.displayName || 'U').substring(0, 1).toUpperCase()}
                          </div>
                          <span className="text-h2-premium group-hover/row:text-cyan transition-colors whitespace-nowrap text-[14px]">{u.name || u.displayName || (u.email ? u.email.split('@')[0] : 'Unknown')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-label-caps text-slate-500 ml-1 ml-1">{u.email || 'No Email'}</td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-1 rounded-lg border shadow-sm whitespace-nowrap text-[10px] font-black uppercase tracking-widest ${u.role === 'admin'
                          ? 'bg-purple-50 text-purple-600 border-purple-100'
                          : u.role === 'brand_owner'
                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 text-navy">
                            <Cpu size={12} className="text-cyan" />
                            <span className="text-h2-premium leading-none text-[13px]">{formatTokenCount(tokens)}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest ml-1 text-slate-500">{t('admin.users.tokens')}</span>
                          </div>
                          <span className="text-[10px] italic text-slate-400 mt-0.5 ml-5 whitespace-nowrap">{t('admin.users.requests', { count: requests })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="max-w-[200px] truncate text-label-caps text-slate-400 ml-1">
                          {brandsList}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex justify-end gap-2 opacity-20 group-hover/row:opacity-100 transition-opacity duration-300">
                          <button
                            onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }}
                            className="w-8 h-8 flex items-center justify-center text-navy bg-white border border-slate-100 rounded-lg hover:bg-navy hover:text-white hover:border-navy transition-all shadow-soft active:scale-95"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id!)}
                            className="w-8 h-8 flex items-center justify-center text-rose-500 bg-white border border-slate-100 rounded-lg hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all shadow-soft active:scale-95"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <UsageHistoryModal
        isOpen={!!historyUser}
        onClose={() => setHistoryUser(null)}
        user={historyUser}
      />
    </div>
  );
};

export default UsersTab;