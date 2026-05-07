import React, { useState, useEffect } from 'react';
import {
  Search, Loader2, AlertTriangle, RefreshCw,
  Trash2, Plus, List, Globe, ShieldAlert,
  ExternalLink, TrendingUp, TrendingDown, Minus,
  Monitor, ArrowLeft, CheckCircle2
} from 'lucide-react';
import { auth } from '../../firebase';
import { RankKeyword, RankingResult, Brand, User } from '../../types';
import { useTranslation } from 'react-i18next';
import SectionHeader from '../SectionHeader';

interface RankCheckerTabProps {
  selectedBrandId: string;
  setSelectedBrandId: (id: string) => void;
  setToast?: (toast: { type: 'success' | 'error', message: string }) => void;
  availableBrands: Brand[];
  currentUser?: User | null;
}

const BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://staging-backend-one.vercel.app/api";

const RankCheckerTab: React.FC<RankCheckerTabProps> = ({
  selectedBrandId,
  setSelectedBrandId,
  setToast,
  availableBrands,
}) => {
  const { t } = useTranslation();
  const [keywords, setKeywords] = useState<RankKeyword[]>([]);
  const [rankings, setRankings] = useState<RankingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkKeywords, setBulkKeywords] = useState('');
  const [isExtensionReady, setIsExtensionReady] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<any>(null);

  const selectedBrand = availableBrands.find(b => b.id === selectedBrandId);

  useEffect(() => {
    const handleReady = () => setIsExtensionReady(true);
    window.addEventListener('rank-checker-ready', handleReady);
    window.dispatchEvent(new CustomEvent('rank-checker-ping'));
    return () => window.removeEventListener('rank-checker-ready', handleReady);
  }, []);

  useEffect(() => {
    if (selectedBrandId) {
      fetchKeywords();
      fetchRankings();
    }
  }, [selectedBrandId]);

  useEffect(() => {
    let interval: any;
    if (isChecking && jobId) {
      interval = setInterval(fetchJobStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [isChecking, jobId]);

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
    setLoading(true);
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
      setLoading(false);
    }
  };

  const fetchJobStatus = async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`${BASE_URL}/rank-checker?action=get-job-status&jobId=${jobId}`);
      const data = await res.json();
      if (res.ok) {
        setJobProgress(data);
        if (data.done) {
          setIsChecking(false);
          fetchRankings();
          if (setToast) setToast({ type: 'success', message: 'Kiểm tra thứ hạng hoàn tất' });
        }
      }
    } catch (err) {
      console.error('Fetch job status error:', err);
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim() || !selectedBrandId) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BASE_URL}/rank-checker?action=manage-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'add', subAction: 'add', brandId: selectedBrandId, brand_id: selectedBrandId, keyword: newKeyword.trim() })
      });
      if (res.ok) {
        setNewKeyword('');
        fetchKeywords();
        fetchRankings();
        if (setToast) setToast({ type: 'success', message: 'Đã thêm từ khóa' });
      }
    } catch (err) {}
  };

  const handleBulkAdd = async () => {
    if (!bulkKeywords.trim() || !selectedBrandId) return;
    const kwList = bulkKeywords.split('\n').map(k => k.trim()).filter(k => k);
    if (!kwList.length) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BASE_URL}/rank-checker?action=manage-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'bulk-add', subAction: 'bulk-add', brandId: selectedBrandId, brand_id: selectedBrandId, keywords: kwList })
      });
      if (res.ok) {
        setBulkKeywords('');
        setShowBulkAdd(false);
        fetchKeywords();
        fetchRankings();
        if (setToast) setToast({ type: 'success', message: `Đã thêm ${kwList.length} từ khóa` });
      }
    } catch (err) {}
  };

  const handleDeleteKeyword = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa từ khóa này?')) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`${BASE_URL}/rank-checker?action=manage-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete', subAction: 'delete', keywordId: id, keyword_id: id })
      });
      fetchKeywords();
      fetchRankings();
    } catch (err) {}
  };

  const startChecking = async () => {
    if (!keywords.length || !selectedBrandId) return;
    setIsChecking(true);
    setJobProgress(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BASE_URL}/rank-checker?action=create-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ brandId: selectedBrandId, brand_id: selectedBrandId })
      });
      const data = await res.json();
      if (res.ok && data.jobId) {
        setJobId(data.jobId);
        window.dispatchEvent(new CustomEvent('rank-checker-trigger', { detail: { jobId: data.jobId, token } }));
      } else {
        setIsChecking(false);
        alert(data.message || 'Lỗi khi khởi tạo job');
      }
    } catch (err) {
      setIsChecking(false);
    }
  };

  const top3Count = rankings.filter(r => r.position && r.position <= 3).length;
  const top10Count = rankings.filter(r => r.position && r.position <= 10).length;
  const progressPct = jobProgress ? Math.round((jobProgress.completed / jobProgress.total) * 100) : 0;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-1000 space-y-8 pb-12">
      <SectionHeader
        title="Google Rank Checker"
        subtitle="Theo dõi thứ hạng từ khóa thời gian thực qua trình duyệt."
      >
        <div className="flex flex-wrap gap-2">
          {availableBrands.map(brand => (
            <button
              key={brand.id}
              onClick={() => setSelectedBrandId(brand.id)}
              className={`px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${
                selectedBrandId === brand.id
                  ? 'bg-navy text-white shadow-premium scale-105'
                  : 'bg-white text-slate-400 border border-slate-200 hover:border-cyan hover:text-navy'
              }`}
            >
              {brand.name}
            </button>
          ))}
        </div>
      </SectionHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* ── Left Column ── */}
        <div className="lg:col-span-1 space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="premium-card p-6 border border-slate-100 shadow-soft flex flex-col items-center justify-center text-center">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Top 3</div>
              <div className="text-3xl font-black text-amber-500 tabular-nums">{top3Count}</div>
            </div>
            <div className="premium-card p-6 border border-slate-100 shadow-soft flex flex-col items-center justify-center text-center">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Top 10</div>
              <div className="text-3xl font-black text-emerald-500 tabular-nums">{top10Count}</div>
            </div>
          </div>

          {/* Keyword Manager */}
          <div className="premium-card p-8 border border-slate-100 shadow-premium relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan/10 rounded-full blur-[40px] -mr-16 -mt-16 pointer-events-none group-hover:bg-cyan/20 transition-colors" />

            <h3 className="text-sm font-black text-navy uppercase tracking-[0.15em] mb-6 flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan" /> Keywords
            </h3>

            <form onSubmit={handleAddKeyword} className="flex gap-2 relative z-10">
              <input
                type="text"
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                placeholder="Nhập từ khóa..."
                className="flex-1 bg-white/50 border border-slate-200 rounded-[1.5rem] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/50 transition-all font-medium text-navy placeholder:text-slate-300 shadow-inner-soft"
              />
              <button
                type="submit"
                className="p-3 bg-navy hover:bg-cyan text-white rounded-[1.5rem] transition-all shadow-glow hover:shadow-[0_0_20px_rgba(45,212,191,0.4)]"
              >
                <Plus size={18} />
              </button>
            </form>

            <button
              onClick={() => setShowBulkAdd(!showBulkAdd)}
              className="mt-3 text-[10px] font-black text-slate-400 hover:text-cyan uppercase tracking-widest flex items-center gap-2 transition-colors"
            >
              <List size={13} /> + Thêm nhiều từ khóa
            </button>

            {showBulkAdd && (
              <div className="mt-4 space-y-3 animate-in slide-in-from-top-2">
                <textarea
                  value={bulkKeywords}
                  onChange={e => setBulkKeywords(e.target.value)}
                  placeholder="Mỗi dòng một từ khóa..."
                  rows={5}
                  className="w-full bg-white/50 border border-slate-200 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/30 font-medium text-navy placeholder:text-slate-300 shadow-inner-soft"
                />
                <button
                  onClick={handleBulkAdd}
                  className="w-full py-3 bg-navy text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-cyan transition-all shadow-glow"
                >
                  Xác nhận thêm
                </button>
              </div>
            )}

            {/* Extension status */}
            <div className="flex items-center gap-2 mt-5 mb-3">
              <div className={`w-2 h-2 rounded-full transition-colors ${isExtensionReady ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-slate-300'}`} />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Extension: {isExtensionReady ? 'Ready' : 'Not Detected'}
              </span>
            </div>

            {/* Keyword list */}
            <div className="max-h-[320px] overflow-y-auto custom-scrollbar space-y-1.5 mt-2">
              {keywords.length === 0 ? (
                <p className="text-center py-10 text-slate-300 text-xs italic">Chưa có từ khóa nào</p>
              ) : (
                keywords.map(kw => (
                  <div
                    key={kw.id}
                    className="group flex items-center justify-between px-4 py-3 bg-slate-50/80 hover:bg-white rounded-2xl hover:shadow-soft transition-all border border-transparent hover:border-slate-100"
                  >
                    <span className="text-sm font-bold text-navy truncate mr-3">{kw.keyword}</span>
                    <button
                      onClick={() => handleDeleteKeyword(kw.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 transition-all shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Extension note */}
          <div className="premium-card p-6 border border-slate-200 shadow-soft bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-slate-400" /> Yêu cầu Extension
            </h4>
            <p className="text-[13px] text-slate-500 leading-relaxed">
              Tính năng này yêu cầu <strong>Moodbiz Rank Checker Extension</strong> chạy ở chế độ ẩn danh để đảm bảo kết quả chính xác.
            </p>
          </div>
        </div>

        {/* ── Right Column ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Inline progress panel — hiện khi đang check */}
          {isChecking && (
            <div className="premium-card border border-slate-100 shadow-premium overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/30 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-cyan/10 flex items-center justify-center shrink-0">
                  <Monitor className="w-5 h-5 text-cyan" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-black text-navy uppercase tracking-[0.15em]">Đang kiểm tra thứ hạng</h3>
                  {jobProgress && (
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5 truncate">
                      Job ID: {jobProgress.jobId}
                    </p>
                  )}
                </div>
                {jobProgress?.done && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Hoàn tất</span>
                  </div>
                )}
              </div>

              <div className="p-8 space-y-5">
                {/* Progress bar */}
                {jobProgress ? (
                  <>
                    <div className="flex items-center justify-between text-xs font-black text-navy uppercase">
                      <span>Tiến độ: {jobProgress.completed} / {jobProgress.total}</span>
                      <span className="text-cyan tabular-nums">{progressPct}%</span>
                    </div>
                    <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
                      <div
                        className="h-full bg-navy rounded-full transition-all duration-700 ease-out shadow-glow"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan" />
                    <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Khởi tạo job...</span>
                  </div>
                )}

                {/* Console */}
                <div className="bg-slate-900 rounded-2xl p-5 font-mono text-[11px] text-cyan/80 border border-white/5">
                  <div className="flex items-center gap-2 mb-3 text-white/30 border-b border-white/5 pb-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="ml-2 uppercase tracking-widest text-[9px] font-black">Scraper Console</span>
                  </div>
                  <div className="space-y-1 h-36 overflow-y-auto custom-scrollbar">
                    <p className="text-white/40">[SYSTEM] Initializing scraping engine...</p>
                    {jobProgress ? (
                      <>
                        <p className="text-cyan">
                          {jobProgress.done ? '[SUCCESS] Job completed successfully!' : '[PROCESS] Checking keywords...'}
                        </p>
                        {jobProgress.results?.slice(-8).map((r: any, i: number) => (
                          <p key={i} className={r.position ? 'text-emerald-400' : 'text-slate-500'}>
                            {`> ${r.keyword}: ${r.position ? `Top ${r.position}` : 'Not found'}`}
                          </p>
                        ))}
                      </>
                    ) : (
                      <p className="text-cyan animate-pulse">[PROCESS] Waiting for extension...</p>
                    )}
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 font-medium italic text-center">
                  Quá trình kiểm tra chạy ngầm qua Extension — bạn có thể tiếp tục sử dụng các tab khác.
                </p>
              </div>
            </div>
          )}

          {/* Results card */}
          <div className="premium-card border border-slate-100 shadow-premium overflow-hidden flex flex-col min-h-[500px]">

            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-navy uppercase tracking-[0.15em] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" /> Bảng xếp hạng
                </h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                  Domain: <span className="text-cyan">{selectedBrand?.domain || 'Chưa cấu hình'}</span>
                </p>
              </div>

              <button
                onClick={startChecking}
                disabled={loading || (isChecking && !jobProgress?.done) || !keywords.length}
                className="px-6 py-3 bg-navy hover:bg-cyan text-white rounded-[1.5rem] font-bold text-[11px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 shadow-glow hover:shadow-[0_0_24px_rgba(45,212,191,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChecking && !jobProgress?.done
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang kiểm tra...</>
                  : <><RefreshCw className="w-4 h-4" /> Bắt đầu check</>
                }
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-x-auto custom-scrollbar">
              {loading ? (
                <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <Loader2 className="w-10 h-10 text-cyan animate-spin" />
                  <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Đang tải dữ liệu...</p>
                </div>
              ) : rankings.length === 0 ? (
                <div className="h-full min-h-[380px] flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <Search className="w-8 h-8 text-slate-200" />
                  </div>
                  <h3 className="text-lg font-bold text-navy mb-2">Chưa có dữ liệu</h3>
                  <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                    Thêm từ khóa và nhấn <strong>"Bắt đầu check"</strong> để xem kết quả xếp hạng.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Từ khóa</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vị trí</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Xu hướng</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">URL Kết quả</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cập nhật</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((rank, idx) => (
                      <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors">
                        <td className="px-6 py-5">
                          <div className="font-bold text-navy text-sm">{rank.keyword}</div>
                        </td>
                        <td className="px-6 py-5">
                          {rank.position ? (
                            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl font-black text-sm tabular-nums ${
                              rank.position <= 3
                                ? 'bg-amber-100 text-amber-700'
                                : rank.position <= 10
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : rank.position <= 30
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-500'
                            }`}>
                              #{rank.position}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-bold text-sm italic">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Minus size={14} />
                            <span className="text-[10px] font-black uppercase tracking-wider">Steady</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {rank.url ? (
                            <a
                              href={rank.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan hover:text-navy hover:underline truncate max-w-[180px] transition-colors"
                            >
                              {(() => { try { return new URL(rank.url).pathname || '/'; } catch { return rank.url; } })()}
                              <ExternalLink size={11} />
                            </a>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-[10px] font-bold text-slate-400">
                            {rank.checkedAt
                              ? new Date(rank.checkedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                              : 'Chưa check'}
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
    </div>
  );
};

export default RankCheckerTab;
