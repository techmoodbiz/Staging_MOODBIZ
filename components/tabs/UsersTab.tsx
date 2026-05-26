import React, { useMemo } from 'react';
import {
  Users, UserPlus, Shield, Cpu, PlusCircle, Edit3, Trash2,
  RotateCcw, BarChart3, TrendingUp, Crown, Paintbrush, Eye,
  Building2, Lock, Unlock, ChevronRight
} from 'lucide-react';
import { User, Brand } from '../../types';
import { db } from '../../firebase';
import SectionHeader from '../SectionHeader';
import UsageHistoryModal from '../UsageHistoryModal';
import { useTranslation } from 'react-i18next';
import { ALL_FEATURE_IDS } from '../../constants';

interface UsersTabProps {
  users: User[];
  brands: Brand[];
  currentUser: User;
  setEditingUser: (user: User | null) => void;
  setIsUserModalOpen: (isOpen: boolean) => void;
  handleDeleteUser: (id: string) => void;
}

const ROLE_CONFIG = {
  admin: {
    label: 'Admin',
    icon: Shield,
    bg: 'bg-violet-50',
    text: 'text-violet-600',
    border: 'border-violet-100',
    dot: 'bg-violet-500',
  },
  brand_owner: {
    label: 'Brand Owner',
    icon: Crown,
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-100',
    dot: 'bg-blue-500',
  },
  content_creator: {
    label: 'Content Creator',
    icon: Paintbrush,
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-100',
    dot: 'bg-emerald-500',
  },
  viewer: {
    label: 'Viewer',
    icon: Eye,
    bg: 'bg-slate-50',
    text: 'text-slate-500',
    border: 'border-slate-100',
    dot: 'bg-slate-400',
  },
};

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-400 to-teal-500',
  'from-rose-400 to-pink-500',
  'from-amber-400 to-orange-500',
  'from-sky-400 to-blue-500',
];

const UsersTab: React.FC<UsersTabProps> = ({ users, brands, currentUser, setEditingUser, setIsUserModalOpen, handleDeleteUser }) => {
  const { t } = useTranslation();
  const [historyUser, setHistoryUser] = React.useState<User | null>(null);
  const [reportMode, setReportMode] = React.useState(false);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (currentUser.role === 'admin') return true;
      if (currentUser.role === 'brand_owner') {
        if (u.role === 'content_creator') {
          return u.assignedBrandIds?.some(id => currentUser.ownedBrandIds?.includes(id));
        }
        return u.uid === currentUser.uid;
      }
      return false;
    });
  }, [users, currentUser]);

  const stats = useMemo(() => ({
    total: filteredUsers.length,
    admins: filteredUsers.filter(u => u.role === 'admin').length,
    brand_owners: filteredUsers.filter(u => u.role === 'brand_owner').length,
    creators: filteredUsers.filter(u => u.role === 'content_creator').length,
  }), [filteredUsers]);

  const handleResetTokens = async (userId: string) => {
    if (!window.confirm(t('admin.users.confirm_reset'))) return;
    try {
      await db.collection('users').doc(userId).update({
        'usageStats.totalTokens': 0,
        'usageStats.requestCount': 0,
        'usageStats.breakdown': {}
      });
      alert(t('admin.users.reset_success'));
    } catch {
      alert(t('admin.users.reset_error'));
    }
  };

  const formatTokenCount = (num: number) => {
    if (!num) return '0';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'k';
    return num.toLocaleString();
  };

  const getAvatarColor = (idx: number) => AVATAR_COLORS[idx % AVATAR_COLORS.length];

  const getDisplayName = (u: User) =>
    u.name || u.displayName || (u.email ? u.email.split('@')[0] : 'Unknown');

  const getUserBrands = (u: User) => {
    const ids = u.role === 'brand_owner' ? u.ownedBrandIds : u.assignedBrandIds;
    return (ids || []).map(id => brands.find(b => b.id === id)).filter(Boolean) as Brand[];
  };

  const getPermissionCount = (u: User) => {
    if (u.role === 'admin') return ALL_FEATURE_IDS.length;
    return (u.featurePermissions ?? ALL_FEATURE_IDS).length;
  };

  // Token report chart
  const UsageChart = () => {
    const chartData = useMemo(() => {
      return [...filteredUsers]
        .sort((a, b) => (b.usageStats?.totalTokens || 0) - (a.usageStats?.totalTokens || 0))
        .slice(0, 10)
        .map(u => ({ name: getDisplayName(u), tokens: u.usageStats?.totalTokens || 0 }));
    }, []);
    const maxTokens = Math.max(...chartData.map(d => d.tokens), 1);

    return (
      <div className="bg-white rounded-[2rem] p-6 shadow-2xl border border-slate-100 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
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
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-[1rem] text-emerald-600 border border-emerald-100">
            <TrendingUp size={14} strokeWidth={3} />
            <span className="text-label-caps">{t('admin.users.live_sync')}</span>
          </div>
        </div>
        <div className="flex items-end gap-5 h-52 px-4 overflow-x-auto custom-scrollbar pt-8">
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
              <p className="mt-3 text-label-caps opacity-40 text-center truncate w-full group-hover:text-navy group-hover:opacity-100 transition-all">{d.name}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Token report table
  const ReportTable = () => {
    const bd_cols = [
      { key: 'AUDIT_LOGIC_LEGAL', label: t('admin.users.breakdown.audit_logic_legal'), color: 'text-purple-600' },
      { key: 'AUDIT_BRAND_PRODUCT', label: t('admin.users.breakdown.audit_brand_product'), color: 'text-blue-600' },
      { key: 'AUDIT_LANGUAGE', label: t('admin.users.breakdown.audit_language'), color: 'text-emerald-600' },
      { key: 'GENERATE_CONTENT', label: t('admin.users.breakdown.generate'), color: 'text-slate-500' },
      { key: 'SCRAPE_WEBSITE', label: t('admin.users.breakdown.scrape'), color: 'text-slate-500' },
      { key: 'ANALYZE_FILE', label: t('admin.users.breakdown.file'), color: 'text-slate-500' },
      { key: 'ANALYZE_WEBSITE', label: t('admin.users.breakdown.website'), color: 'text-slate-500' },
      { key: 'APPROVE_INGEST_FILE', label: t('admin.users.breakdown.ocr'), color: 'text-slate-500' },
      { key: 'APPROVE_INGEST_TEXT', label: t('admin.users.breakdown.clean'), color: 'text-slate-500' },
      { key: 'RESEARCH_ANALYSIS_GEMINI', label: t('admin.users.breakdown.research'), color: 'text-cyan-600' },
    ];

    return (
      <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl border border-slate-100">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4 text-left whitespace-nowrap text-label-caps sticky left-0 bg-slate-50/80 z-10">{t('admin.users.identity')}</th>
                <th className="px-5 py-4 text-right whitespace-nowrap text-label-caps bg-blue-50/50">{t('admin.users.total')}</th>
                {bd_cols.map(c => (
                  <th key={c.key} className={`px-5 py-4 text-right whitespace-nowrap text-label-caps ${c.color}`}>{c.label}</th>
                ))}
                <th className="px-3 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((u, idx) => {
                const bd = u.usageStats?.breakdown || {};
                return (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-all">
                    <td className="px-5 py-3 sticky left-0 bg-white hover:bg-slate-50/60 font-black text-navy text-[13px] border-r border-slate-100 whitespace-nowrap">
                      {getDisplayName(u)}
                    </td>
                    <td className="px-5 py-3 text-right font-black text-navy bg-blue-50/20 text-[13px]">
                      {formatTokenCount(u.usageStats?.totalTokens || 0)}
                    </td>
                    {bd_cols.map(c => (
                      <td key={c.key} className={`px-5 py-3 text-right font-black text-[12px] ${c.color}`}>
                        {formatTokenCount(bd[c.key] || 0)}
                      </td>
                    ))}
                    <td className="px-3 py-3">
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
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in w-full pb-20 space-y-6">
      {/* Header */}
      <SectionHeader title={t('admin.users.title')} subtitle={t('admin.users.subtitle')}>
        <div className="flex gap-3">
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setReportMode(!reportMode)}
              className={`px-5 py-3.5 rounded-[1.25rem] text-label-caps transition-all shadow-sm flex items-center gap-2 border ${
                reportMode
                  ? 'bg-navy text-cyan border-navy shadow-navy/20'
                  : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'
              }`}
            >
              <BarChart3 size={16} />
              {reportMode ? t('admin.users.table_view') : t('admin.users.token_report')}
            </button>
          )}
          <button
            onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}
            className="group px-6 py-3.5 bg-navy text-white rounded-[1.25rem] transition-all hover:-translate-y-0.5 active:scale-95 text-label-caps !text-white relative overflow-hidden shadow-xl shadow-navy/20 flex items-center gap-2"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan/20 via-transparent to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <PlusCircle size={17} className="text-cyan flex-shrink-0" />
            <span className="relative z-10">{t('admin.users.add_btn')}</span>
          </button>
        </div>
      </SectionHeader>

      {/* Stats row */}
      {!reportMode && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          {[
            { label: 'Tổng người dùng', value: stats.total, icon: Users, color: 'text-navy', bg: 'bg-slate-50', border: 'border-slate-100' },
            { label: 'Admin', value: stats.admins, icon: Shield, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
            { label: 'Brand Owner', value: stats.brand_owners, icon: Crown, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            { label: 'Content Creator', value: stats.creators, icon: Paintbrush, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          ].map((s, i) => (
            <div key={i} className={`bg-white rounded-2xl p-4 border ${s.border} shadow-sm flex items-center gap-3`}>
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <s.icon size={16} className={s.color} />
              </div>
              <div>
                <p className="text-[22px] font-black text-navy leading-none">{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report mode */}
      {reportMode && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-6">
          <UsageChart />
          <ReportTable />
        </div>
      )}

      {/* User cards */}
      {!reportMode && (
        <div className="space-y-2 animate-in fade-in duration-500">
          {users.filter(u => {
            if (u.role === 'admin' && currentUser.role !== 'admin') return false;
            if (currentUser.role === 'brand_owner') {
              if (u.role === 'brand_owner' && u.uid !== currentUser.uid) return false;
              if (u.role === 'content_creator') {
                return u.assignedBrandIds?.some(id => currentUser.ownedBrandIds?.includes(id));
              }
              if (u.uid !== currentUser.uid) return false;
            }
            return true;
          }).map((u, idx) => {
            const role = ROLE_CONFIG[u.role] || ROLE_CONFIG.viewer;
            const RoleIcon = role.icon;
            const userBrands = getUserBrands(u);
            const tokens = u.usageStats?.totalTokens || 0;
            const requests = u.usageStats?.requestCount || 0;
            const permCount = getPermissionCount(u);
            const isFullPerm = permCount >= ALL_FEATURE_IDS.length;

            return (
              <div
                key={u.id}
                className="group bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all duration-300 animate-in fade-in"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarColor(idx)} flex items-center justify-center text-white text-[13px] font-black flex-shrink-0 shadow-sm`}>
                    {getDisplayName(u).substring(0, 1).toUpperCase()}
                  </div>

                  {/* Name & email */}
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-navy text-[14px] leading-tight truncate group-hover:text-cyan transition-colors">
                      {getDisplayName(u)}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{u.email}</p>
                  </div>

                  {/* Role badge */}
                  <div className={`hidden md:flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border w-[148px] flex-shrink-0 ${role.bg} ${role.border}`}>
                    <RoleIcon size={11} className={role.text} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${role.text}`}>{role.label}</span>
                  </div>

                  {/* Tokens */}
                  <div className="hidden lg:flex flex-col items-end flex-shrink-0 w-[110px]">
                    <div className="flex items-center gap-1.5">
                      <Cpu size={11} className="text-cyan" />
                      <span className="text-[15px] font-black text-navy">{formatTokenCount(tokens)}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">tokens</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5">{requests} yêu cầu</span>
                  </div>

                  {/* Brands */}
                  <div className="hidden xl:flex flex-col justify-center gap-1 flex-shrink-0 w-[200px]">
                    {userBrands.length === 0 ? (
                      <span className="text-[11px] text-slate-300 italic">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {userBrands.slice(0, 2).map(b => (
                          <span key={b.id} className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-500 max-w-[90px]">
                            <Building2 size={9} className="flex-shrink-0" />
                            <span className="truncate">{b.name}</span>
                          </span>
                        ))}
                        {userBrands.length > 2 && (
                          <span className="flex items-center px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-400">
                            +{userBrands.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Permission indicator */}
                  <div className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl flex-shrink-0 ${isFullPerm ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
                    {isFullPerm
                      ? <Unlock size={11} className="text-emerald-500" />
                      : <Lock size={11} className="text-amber-500" />
                    }
                    <span className={`text-[10px] font-black ${isFullPerm ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {permCount}/{ALL_FEATURE_IDS.length}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <button
                      onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-navy hover:bg-slate-100 rounded-xl transition-all active:scale-95"
                      title="Chỉnh sửa"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.id!)}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-95"
                      title="Xóa"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Mobile extras row */}
                <div className="md:hidden flex items-center gap-3 px-5 pb-3 -mt-1">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${role.bg} ${role.border}`}>
                    <RoleIcon size={10} className={role.text} />
                    <span className={`text-[9px] font-black uppercase tracking-widest ${role.text}`}>{role.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Cpu size={10} className="text-cyan" />
                    <span className="text-[12px] font-black text-navy">{formatTokenCount(tokens)}</span>
                    <span className="text-[9px] text-slate-400">tokens</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UsageHistoryModal
        isOpen={!!historyUser}
        onClose={() => setHistoryUser(null)}
        user={historyUser}
      />
    </div>
  );
};

export default UsersTab;
