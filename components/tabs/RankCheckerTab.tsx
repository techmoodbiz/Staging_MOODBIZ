import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Search, Loader2, AlertTriangle, CheckCircle2, 
  RefreshCw, TrendingUp, TrendingDown, Trash2, 
  Plus, List, Globe, Monitor, ShieldAlert,
  ArrowRight, ExternalLink, Activity, Info
} from 'lucide-react';
import SectionHeader from '../SectionHeader';
import { auth } from '../../firebase';
import type { User, Brand } from '../../types';

interface RankCheckerTabProps {
  currentUser: User;
  availableBrands: Brand[];
}

interface RankResult {
  keywordId: string;
  keyword: string;
  position: number | null;
  url: string | null;
  checkedAt: string | null;
  history?: any[];
}

const getEnvVar = (key: string) => {
  try {
    // @ts-ignore
    return import.meta?.env?.[key];
  } catch (e) {
    return undefined;
  }
};

const BASE_URL = getEnvVar('VITE_API_URL') || "https://staging-backend-one.vercel.app/api";

const RankCheckerTab: React.FC<RankCheckerTabProps> = ({ currentUser, availableBrands }) => {
  const { t } = useTranslation();
  
  const [selectedBrandId, setSelectedBrandId] = useState<string>(() => {
    return localStorage.getItem('rank_checker_selected_brand') || (availableBrands[0]?.id || '');
  });

  const selectedBrand = useMemo(() => 
    availableBrands.find(b => b.id === selectedBrandId), 
    [selectedBrandId, availableBrands]
  );

  const [keywords, setKeywords] = useState<any[]>([]);
  const [rankings, setRankings] = useState<RankResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<any>(null);
  const [showProgress, setShowProgress] = useState(false);
  
  const [newKeyword, setNewKeyword] = useState('');
  const [bulkKeywords, setBulkKeywords] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  useEffect(() => {
    if (selectedBrandId) {
      localStorage.setItem('rank_checker_selected_brand', selectedBrandId);
      fetchKeywords();
      fetchRankings();
    }
  }, [selectedBrandId]);

  const fetchKeywords = async () => {
    if (!selectedBrandId) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BASE_URL}/rank-checker?action=get-keywords&brandId=${selectedBrandId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setKeywords(data);
    } catch (err) {
      console.error('Fetch keywords error:', err);
    }
  };

  const fetchRankings = async () => {
    if (!selectedBrandId) return;
    setLoadingRankings(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BASE_URL}/rank-checker?action=get-rankings&brandId=${selectedBrandId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setRankings(data);
    } catch (err) {
      console.error('Fetch rankings error:', err);
    } finally {
      setLoadingRankings(false);
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim() || !selectedBrandId) return;
    
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BASE_URL}/rank-checker?action=manage-keywords`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subAction: 'add',
          brandId: selectedBrandId,
          keyword: newKeyword.trim()
        })
      });
      if (res.ok) {
        setNewKeyword('');
        fetchKeywords();
        fetchRankings();
      }
    } catch (err) {
      console.error('Add keyword error:', err);
    }
  };

  const handleBulkAdd = async () => {
    const kws = bulkKeywords.split('\n').map(k => k.trim()).filter(k => k);
    if (!kws.length || !selectedBrandId) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BASE_URL}/rank-checker?action=manage-keywords`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subAction: 'bulk-add',
          brandId: selectedBrandId,
          keywords: kws
        })
      });
      if (res.ok) {
        setBulkKeywords('');
        setShowBulkAdd(false);
        fetchKeywords();
        fetchRankings();
      }
    } catch (err) {
      console.error('Bulk add error:', err);
    }
  };

  const handleDeleteKeyword = async (id: string) => {
    if (!window.confirm(t('common.confirm_delete', 'Are you sure you want to delete this?'))) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BASE_URL}/rank-checker?action=manage-keywords`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subAction: 'delete',
          keywordId: id
        })
      });
      if (res.ok) {
        fetchKeywords();
        fetchRankings();
      }
    } catch (err) {
      console.error('Delete keyword error:', err);
    }
  };

  const startChecking = async () => {
    if (!selectedBrandId || isChecking) return;
    
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BASE_URL}/rank-checker?action=create-job`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ brandId: selectedBrandId })
      });
      const data = await res.json();
      
      if (res.ok && data.jobId) {
        setJobId(data.jobId);
        setIsChecking(true);
        setShowProgress(true);
        
        // Trigger Extension via CustomEvent
        window.dispatchEvent(new CustomEvent('rank-checker-trigger', {
          detail: { jobId: data.jobId, token }
        }));
        
        // Start polling for status
        pollJobStatus(data.jobId);
      } else {
        alert(data.message || 'Lỗi khi tạo job');
      }
    } catch (err) {
      console.error('Start check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BASE_URL}/rank-checker?action=get-job-status&jobId=${id}`);
        const data = await res.json();
        if (res.ok) {
          setJobProgress(data);
          if (data.done) {
            clearInterval(interval);
            setIsChecking(false);
            fetchRankings();
          }
        }
      } catch (err) {
        console.error('Poll status error:', err);
        clearInterval(interval);
        setIsChecking(false);
      }
    }, 2000);
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = rankings.length;
    const top3 = rankings.filter(r => r.position && r.position <= 3).length;
    const top10 = rankings.filter(r => r.position && r.position <= 10).length;
    const notFound = rankings.filter(r => !r.position).length;
    return { total, top3, top10, notFound };
  }, [rankings]);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-1000 space-y-8 pb-12">
      <SectionHeader 
        title="Google Rank Checker" 
        subtitle="Theo dõi thứ hạng từ khóa thời gian thực qua trình duyệt." 
      />

      {/* Brand Selection */}
      <div className="flex flex-wrap items-center gap-4">
        {availableBrands.map(brand => (
          <button
            key={brand.id}
            onClick={() => setSelectedBrandId(brand.id)}
            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${
              selectedBrandId === brand.id
                ? 'bg-navy text-white border-navy shadow-glow scale-105'
                : 'bg-white text-slate-400 border-slate-100 hover:border-cyan hover:text-cyan'
            }`}
          >
            {brand.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left: Stats & Keywords */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="premium-card p-5 border border-slate-100 bg-white shadow-soft">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Top 3</div>
              <div className="text-2xl font-black text-amber-500 tabular-nums">{stats.top3}</div>
            </div>
            <div className="premium-card p-5 border border-slate-100 bg-white shadow-soft">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Top 10</div>
              <div className="text-2xl font-black text-emerald-500 tabular-nums">{stats.top10}</div>
            </div>
          </div>

          {/* Add Keyword Form */}
          <div className="premium-card p-6 border border-slate-100 bg-white shadow-premium">
            <h3 className="text-sm font-black text-navy uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan" /> Keywords
            </h3>
            
            <form onSubmit={handleAddKeyword} className="space-y-3 mb-6">
              <div className="relative">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Nhập từ khóa..."
                  className="w-full pl-4 pr-10 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-navy outline-none focus:ring-4 focus:ring-cyan/10 transition-all placeholder:text-slate-300"
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-cyan hover:bg-white rounded-xl transition-all">
                  <Plus size={20} strokeWidth={3} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkAdd(!showBulkAdd)}
                className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-cyan transition-colors ml-2"
              >
                + Thêm nhiều từ khóa
              </button>
            </form>

            {showBulkAdd && (
              <div className="mb-6 space-y-3 animate-in slide-in-from-top-2">
                <textarea
                  value={bulkKeywords}
                  onChange={(e) => setBulkKeywords(e.target.value)}
                  placeholder="Dán danh sách từ khóa, mỗi dòng một từ..."
                  rows={5}
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-navy outline-none focus:ring-4 focus:ring-cyan/10 transition-all placeholder:text-slate-300"
                />
                <div className="flex gap-2">
                  <button onClick={handleBulkAdd} className="flex-1 py-3 bg-cyan text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-glow">
                    Thêm tất cả
                  </button>
                  <button onClick={() => setShowBulkAdd(false)} className="px-4 py-3 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest">
                    Hủy
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2">
              {keywords.length === 0 ? (
                <p className="text-center py-10 text-slate-300 text-xs italic">Chưa có từ khóa nào</p>
              ) : (
                keywords.map(kw => (
                  <div key={kw.id} className="group flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <span className="text-sm font-bold text-slate-600 group-hover:text-navy transition-colors">{kw.keyword}</span>
                    <button onClick={() => handleDeleteKeyword(kw.id)} className="opacity-0 group-hover:opacity-100 p-2 text-rose-400 hover:text-rose-600 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Extension Notice */}
          <div className="p-6 rounded-[2rem] bg-indigo-50 border border-indigo-100">
            <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-2 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Yêu cầu Extension
            </h4>
            <p className="text-[11px] text-indigo-600/80 leading-relaxed">
              Tính năng này yêu cầu **Moodbiz Rank Checker Extension** chạy ở chế độ ẩn danh để đảm bảo kết quả chính xác.
            </p>
          </div>
        </div>

        {/* Right: Ranking Table */}
        <div className="lg:col-span-3 space-y-6">
          <div className="premium-card min-h-[600px] border border-slate-100 bg-white shadow-premium overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div>
                <h3 className="text-xl font-black text-navy tracking-tighter uppercase">Bảng xếp hạng</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Domain: <span className="text-cyan">{selectedBrand?.domain || 'Chưa cấu hình'}</span></p>
              </div>
              <button
                onClick={startChecking}
                disabled={loading || isChecking || keywords.length === 0}
                className="px-8 py-4 bg-navy hover:bg-cyan text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-glow disabled:opacity-50"
              >
                {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {isChecking ? 'Đang kiểm tra...' : 'Bắt đầu check'}
              </button>
            </div>

            <div className="flex-1 overflow-x-auto">
              {loadingRankings ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-slate-300 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-cyan/30" />
                  <p className="text-xs font-black uppercase tracking-widest">Đang tải thứ hạng...</p>
                </div>
              ) : rankings.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                  <Search className="w-16 h-16 text-slate-100 mb-4" />
                  <p className="text-slate-400 font-medium">Thêm từ khóa và nhấn "Bắt đầu check" để xem kết quả.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Từ khóa</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vị trí</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Xu hướng</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">URL kết quả</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cập nhật</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rankings.map(rank => (
                      <tr key={rank.keywordId} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="font-bold text-navy">{rank.keyword}</div>
                        </td>
                        <td className="px-8 py-6">
                          {rank.position ? (
                            <div className={`
                              inline-flex items-center justify-center w-10 h-10 rounded-xl font-black text-sm
                              ${rank.position <= 3 ? 'bg-amber-100 text-amber-600 shadow-amber-100 shadow-glow' : 
                                rank.position <= 10 ? 'bg-emerald-100 text-emerald-600' : 
                                rank.position <= 30 ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}
                            `}>
                              #{rank.position}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-bold italic">N/A</span>
                          )}
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-2">
                             {/* Simple trend indicator - could be enhanced with actual history logic */}
                             <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div className="w-full h-full bg-cyan/20" />
                             </div>
                             <span className="text-[10px] font-black text-slate-400 uppercase">Steady</span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                          {rank.url ? (
                            <a href={rank.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-cyan hover:underline truncate max-w-[200px]">
                              {new URL(rank.url).pathname} <ExternalLink size={12} />
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-[10px] font-bold text-slate-400">
                            {rank.checkedAt ? new Date(rank.checkedAt).toLocaleString() : 'Chưa check'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Modal */}
      {showProgress && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-navy/80 backdrop-blur-md animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20">
            <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-cyan text-white rounded-2xl shadow-glow">
                  <Monitor size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-navy uppercase tracking-tighter">Đang kiểm tra thứ hạng</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Job ID: {jobId}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowProgress(false)} 
                className="p-3 hover:bg-slate-50 rounded-2xl text-slate-300 hover:text-navy transition-all"
              >
                <ArrowRight className="rotate-180" />
              </button>
            </div>

            <div className="p-10 space-y-8">
              {jobProgress ? (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-500">
                      <span>Tiến độ: {jobProgress.completed} / {jobProgress.total}</span>
                      <span>{Math.round((jobProgress.completed / jobProgress.total) * 100)}%</span>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-1 shadow-inner-soft">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan to-blue-500 rounded-full transition-all duration-500 shadow-glow" 
                        style={{ width: `${(jobProgress.completed / jobProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-[2rem] p-6 font-mono text-[11px] text-emerald-400 space-y-2 h-64 overflow-y-auto custom-scrollbar shadow-2xl border border-white/5">
                    <div className="opacity-50 text-slate-500 font-bold mb-4">[SYSTEM] Initializing scraping engine...</div>
                    {jobProgress.results.slice(-8).map((res: any, i: number) => (
                      <div key={i} className="flex gap-3 animate-in slide-in-from-left-2">
                        <span className="text-slate-600 font-black">[{new Date(res.checkedAt).toLocaleTimeString()}]</span>
                        <span>{res.keyword}</span>
                        <span className="text-cyan font-black">→</span>
                        <span className={res.position ? 'text-amber-400' : 'text-slate-500 italic'}>
                          {res.position ? `#${res.position}` : 'Không tìm thấy'}
                        </span>
                      </div>
                    ))}
                    {jobProgress.done && (
                      <div className="pt-4 text-cyan font-black flex items-center gap-2">
                        <CheckCircle2 size={14} /> TẤT CẢ HOÀN TẤT
                      </div>
                    )}
                  </div>

                  {jobProgress.done ? (
                    <button
                      onClick={() => setShowProgress(false)}
                      className="w-full py-5 bg-navy text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-glow hover:bg-slate-800 transition-all"
                    >
                      Đóng & Xem kết quả
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin text-cyan" />
                      Đang xử lý trong cửa sổ ẩn danh...
                    </div>
                  )}
                </>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-12 h-12 text-cyan animate-spin" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Đang khởi tạo job...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RankCheckerTab;
