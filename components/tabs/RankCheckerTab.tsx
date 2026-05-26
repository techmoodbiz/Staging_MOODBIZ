import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Loader2, RefreshCw, Trash2, Plus, List, Globe, ShieldAlert,
  ExternalLink, BarChart2, PlusCircle, Copy, Download,
  ArrowUp, ArrowDown, FolderOpen, Folder, X, Check, Pencil,
  ChevronsUpDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { auth } from '../../firebase';
import { RankKeyword, RankingResult, Brand, User } from '../../types';
import { useTranslation } from 'react-i18next';
import SectionHeader from '../SectionHeader';

interface RankProject {
  id: string;
  name: string;
  domain: string;
  brandId: string;
}

interface RankCheckerTabProps {
  selectedBrandId: string;
  setSelectedBrandId: (id: string) => void;
  setToast?: (toast: { type: 'success' | 'error', message: string }) => void;
  availableBrands: Brand[];
  currentUser?: User | null;
  setEditingBrand?: (brand: Brand | null) => void;
  setIsBrandModalOpen?: (isOpen: boolean) => void;
  handleDeleteBrand?: (id: string) => void;
}

const BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://staging-backend-one.vercel.app/api";

const RankCheckerTab: React.FC<RankCheckerTabProps> = ({
  selectedBrandId, setSelectedBrandId, setToast,
  availableBrands, currentUser,
  setEditingBrand, setIsBrandModalOpen, handleDeleteBrand,
}) => {
  const { t } = useTranslation();

  // ─── Project state ───
  const [projects, setProjects] = useState<RankProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [projectsLoading, setProjectsLoading] = useState(false);
  const newProjectInputRef = useRef<HTMLInputElement>(null);

  // ─── Keyword / ranking state ───
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
  const [jobKeywordIds, setJobKeywordIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'top3' | 'top5' | 'top10' | 'outside10' | 'outside100'>('all');
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [previousRankings, setPreviousRankings] = useState<RankingResult[]>([]);
  const [currentKeyword, setCurrentKeyword] = useState<string>('');
  const [jobStartTime, setJobStartTime] = useState<number | null>(null);
  const [isCaptchaDetected, setIsCaptchaDetected] = useState(false);
  const [sortBy, setSortBy] = useState<'original' | 'keyword' | 'position' | 'bestPosition' | 'checkedAt'>('original');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const selectedBrand = availableBrands.find(b => b.id === selectedBrandId);
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  useEffect(() => {
    const handleReady = () => setIsExtensionReady(true);
    window.addEventListener('rank-checker-ready', handleReady);
    window.dispatchEvent(new CustomEvent('rank-checker-ping'));
    return () => window.removeEventListener('rank-checker-ready', handleReady);
  }, []);

  useEffect(() => {
    const handleStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.currentKeyword) setCurrentKeyword(detail.currentKeyword);
      setIsCaptchaDetected(!!detail?.captchaDetected);
    };
    window.addEventListener('rank-checker-status', handleStatus);
    return () => window.removeEventListener('rank-checker-status', handleStatus);
  }, []);

  useEffect(() => {
    const handleResultReady = async () => {
      const token = await getToken().catch(() => null);
      if (token && selectedProjectId) fetchRankings(token, selectedProjectId, true);
    };
    window.addEventListener('rank-checker-result-ready', handleResultReady);
    return () => window.removeEventListener('rank-checker-result-ready', handleResultReady);
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedBrandId) {
      setSelectedProjectId(null);
      setKeywords([]);
      setRankings([]);
      setSelectedKeywords(new Set());
      fetchProjects();
    }
  }, [selectedBrandId]);

  // Đồng bộ brand/project đang chọn lên extension popup ngay lập tức
  // (không cần chờ bấm Check — popup luôn biết user đang xem gì)
  useEffect(() => {
    if (!selectedBrandId) return;
    window.dispatchEvent(new CustomEvent('rank-checker-context', {
      detail: {
        brandId:     selectedBrandId,
        brandName:   selectedBrand?.name    || '',
        projectId:   selectedProjectId      || null,
        projectName: selectedProject?.name  || '',
        domain:      selectedProject?.domain || selectedBrand?.domain || '',
      }
    }));
  }, [selectedBrandId, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setKeywords([]);
      setRankings([]);
    }
    setSelectedKeywords(new Set());
  }, [selectedProjectId]);

  useEffect(() => {
    let interval: any;
    if (isChecking && jobId) interval = setInterval(fetchJobStatus, 1500);
    return () => clearInterval(interval);
  }, [isChecking, jobId]);

  useEffect(() => {
    if (isCreatingProject) setTimeout(() => newProjectInputRef.current?.focus(), 50);
  }, [isCreatingProject]);

  // ─── API calls ───
  const fetchProjects = async () => {
    if (!selectedBrandId) return;
    setProjectsLoading(true);
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/rank-checker?action=get-brand-data&brandId=${selectedBrandId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setProjects(data.projects || []);
        if (data.firstProjectId) {
          setSelectedProjectId(data.firstProjectId);
          setKeywords(data.keywords || []);
          setRankings(data.rankings || []);
        }
      }
    } catch (err) { console.error(err); }
    finally { setProjectsLoading(false); setLoading(false); }
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name || !selectedBrandId) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BASE_URL}/rank-checker?action=manage-projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ subAction: 'add-project', name, domain: selectedBrand?.domain || '', brandId: selectedBrandId })
      });
      const data = await res.json();
      if (res.ok) {
        setNewProjectName(''); setIsCreatingProject(false);
        await fetchProjects();
        setSelectedProjectId(data.id);
        if (setToast) setToast({ type: 'success', message: `Project "${name}" đã được tạo` });
      }
    } catch (err) { console.error(err); }
  };

  const handleRenameProject = async (id: string) => {
    const name = editingProjectName.trim();
    if (!name) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const proj = projects.find(p => p.id === id);
      await fetch(`${BASE_URL}/rank-checker?action=manage-projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ subAction: 'update-project', id, name, domain: proj?.domain || '' })
      });
      setEditingProjectId(null);
      fetchProjects();
    } catch (err) { console.error(err); }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!window.confirm(`Xóa project "${name}"? Tất cả từ khóa sẽ bị xóa.`)) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`${BASE_URL}/rank-checker?action=manage-projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ subAction: 'delete-project', id })
      });
      if (selectedProjectId === id) setSelectedProjectId(null);
      fetchProjects();
      if (setToast) setToast({ type: 'success', message: `Đã xóa "${name}"` });
    } catch (err) { console.error(err); }
  };

  const getToken = async () => (await auth.currentUser?.getIdToken()) ?? '';

  const fetchKeywords = async (token: string, projectId: string) => {
    try {
      const res = await fetch(`${BASE_URL}/rank-checker?action=get-keywords&projectId=${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setKeywords(data);
    } catch (err) { console.error(err); }
  };

  const fetchRankings = async (token: string, projectId: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/rank-checker?action=get-rankings&projectId=${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setRankings(data);
    } catch (err) { console.error(err); }
    finally { if (!silent) setLoading(false); }
  };

  const fetchKeywordsAndRankings = async (projectId?: string) => {
    const pid = projectId ?? selectedProjectId;
    if (!pid) return;
    setLoading(true);
    try {
      const token = await getToken();
      await Promise.all([fetchKeywords(token, pid), fetchRankings(token, pid, true)]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchJobStatus = async () => {
    if (!jobId) return;
    try {
      const [statusRes, token] = await Promise.all([
        fetch(`${BASE_URL}/rank-checker?action=get-job-status&jobId=${jobId}`),
        getToken(),
      ]);
      const data = await statusRes.json();
      if (statusRes.ok) {
        setJobProgress(data);
        if (selectedProjectId) fetchRankings(token, selectedProjectId, true);
        if (data.done) {
          setIsChecking(false); setIsCaptchaDetected(false); setJobKeywordIds(new Set());
          if (setToast) setToast({ type: 'success', message: t('rank_checker.toast_check_complete') });
        }
      }
    } catch (err) { console.error(err); }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newKeyword.trim();
    if (!trimmed || !selectedProjectId) return;
    if (keywords.some(k => k.keyword.toLowerCase() === trimmed.toLowerCase())) {
      if (setToast) setToast({ type: 'error', message: t('rank_checker.toast_keyword_duplicate', { keyword: trimmed }) });
      return;
    }
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BASE_URL}/rank-checker?action=manage-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'add', projectId: selectedProjectId, keyword: trimmed })
      });
      if (res.ok) {
        setNewKeyword(''); fetchKeywords(token!, selectedProjectId);
        if (setToast) setToast({ type: 'success', message: t('rank_checker.toast_keyword_added') });
      }
    } catch (err) {}
  };

  const handleBulkAdd = async () => {
    if (!bulkKeywords.trim() || !selectedProjectId) return;
    const raw = bulkKeywords.split('\n').map(k => k.trim()).filter(Boolean);
    const seen = new Set<string>();
    const unique = raw.filter(k => { const key = k.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
    const existing = new Set(keywords.map(k => k.keyword.toLowerCase()));
    const toAdd = unique.filter(k => !existing.has(k.toLowerCase()));
    const skipped = unique.length - toAdd.length;
    if (!toAdd.length) { if (setToast) setToast({ type: 'error', message: t('rank_checker.toast_keywords_added_with_skipped', { count: 0, skipped }) }); return; }
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BASE_URL}/rank-checker?action=manage-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'bulk-add', projectId: selectedProjectId, keywords: toAdd })
      });
      if (res.ok) {
        setBulkKeywords(''); setShowBulkAdd(false); fetchKeywords(token!, selectedProjectId);
        const msg = skipped > 0 ? t('rank_checker.toast_keywords_added_with_skipped', { count: toAdd.length, skipped }) : t('rank_checker.toast_keywords_added', { count: toAdd.length });
        if (setToast) setToast({ type: 'success', message: msg });
      }
    } catch (err) {}
  };

  const handleDeleteKeyword = async (id: string) => {
    if (!window.confirm(t('rank_checker.confirm_delete_keyword'))) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`${BASE_URL}/rank-checker?action=manage-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete', keywordId: id })
      });
      fetchKeywordsAndRankings();
    } catch (err) {}
  };

  const handleBulkDelete = async () => {
    if (!selectedKeywords.size || !window.confirm(t('rank_checker.confirm_delete_keywords', { count: selectedKeywords.size }))) return;
    const token = await getToken();
    await Promise.all([...selectedKeywords].map(id =>
      fetch(`${BASE_URL}/rank-checker?action=manage-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete', keywordId: id }),
      })
    ));
    setSelectedKeywords(new Set()); fetchKeywordsAndRankings();
    if (setToast) setToast({ type: 'success', message: t('rank_checker.toast_keywords_deleted', { count: selectedKeywords.size }) });
  };

  const startChecking = async () => {
    if (!selectedKeywords.size || !selectedProjectId) return;
    setJobId(null);
    setIsChecking(true); setJobProgress(null); setCurrentKeyword('');
    setPreviousRankings(rankings); setJobStartTime(Date.now());
    setJobKeywordIds(new Set(selectedKeywords));
    try {
      const token = await auth.currentUser?.getIdToken();
      // Build position hints so extension can start near the last known rank
      const positionHints: Record<string, { previousPosition: number | null; bestPosition: number | null }> = {};
      for (const r of rankings) {
        if (selectedKeywords.has(r.keywordId)) {
          positionHints[r.keywordId] = {
            previousPosition: r.position ?? null,
            bestPosition: r.bestPosition ?? null,
          };
        }
      }
      const res = await fetch(`${BASE_URL}/rank-checker?action=create-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ projectId: selectedProjectId, keywordIds: [...selectedKeywords], positionHints })
      });
      const data = await res.json();
      if (res.ok && data.jobId) {
        setJobId(data.jobId);

        // Lắng nghe một lần — content-bridge sẽ gửi ack sau khi thử gửi đến background
        const ackHandler = (e: Event) => {
          const detail = (e as CustomEvent).detail;
          if (!detail?.ok) {
            setIsChecking(false);
            const isCtxDead = detail?.error === 'context_invalidated';
            if (setToast) setToast({
              type: 'error',
              message: isCtxDead
                ? '⚠️ Extension bị reload — hãy reload lại trang (F5) rồi thử lại.'
                : detail?.message || t('rank_checker.error_init_job'),
            });
          }
        };
        window.addEventListener('rank-checker-ack', ackHandler, { once: true });

        window.dispatchEvent(new CustomEvent('rank-checker-trigger', {
          detail: {
            jobId: data.jobId,
            token,
            brandName: selectedBrand?.name || '',
            projectName: selectedProject?.name || '',
            domain: selectedProject?.domain || selectedBrand?.domain || '',
          }
        }));
      } else { setIsChecking(false); alert(data.message || t('rank_checker.error_init_job')); }
    } catch (err) { setIsChecking(false); }
  };

  const copyAll = async () => {
    const header = [t('rank_checker.col_stt'), t('rank_checker.col_keyword'), t('rank_checker.col_position'), t('rank_checker.col_change'), t('rank_checker.col_best'), t('rank_checker.col_updated'), t('rank_checker.col_link')].join('\t');
    const rows = tableRows.map((r, i) => {
      const delta = (r.position != null && r.bestPosition != null) ? (r.bestPosition - r.position) : null;
      return [i + 1, r.keyword, r.position ? `#${r.position}` : 'N/A', delta != null ? (delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '=') : '—', r.bestPosition ? `#${r.bestPosition}` : '—', r.checkedAt ? new Date(r.checkedAt).toLocaleDateString('vi-VN') : '—', r.url || '—'].join('\t');
    });
    await navigator.clipboard.writeText([header, ...rows].join('\n'));
    if (setToast) setToast({ type: 'success', message: t('rank_checker.toast_content_copied', { count: tableRows.length }) });
  };

  const exportExcel = () => {
    const rows = tableRows.map((r, i) => ({
      [t('rank_checker.col_stt')]: i + 1, [t('rank_checker.col_keyword')]: r.keyword,
      [t('rank_checker.col_position')]: r.position ?? '', [t('rank_checker.col_best')]: r.bestPosition ?? '',
      [t('rank_checker.col_updated')]: r.checkedAt ? new Date(r.checkedAt).toLocaleDateString('vi-VN') : '', [t('rank_checker.col_link')]: r.url ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rankings');
    XLSX.writeFile(wb, `rank_${(selectedProject?.name || 'export').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const toggleSelect = (id: string) => setSelectedKeywords(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const isRowPending = (r: RankingResult) => isChecking && jobKeywordIds.has(r.keywordId) && (!r.checkedAt || !jobStartTime || new Date(r.checkedAt).getTime() < jobStartTime);
  const getPrevPos = (kw: string) => previousRankings.find(r => r.keyword === kw)?.position ?? null;

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('asc'); }
  };

  const rankingMap = new Map(rankings.map(r => [r.keywordId, r]));
  const allRows: RankingResult[] = keywords.map(kw => rankingMap.get(kw.id) ?? { keywordId: kw.id, keyword: kw.keyword, position: null, url: null, checkedAt: null });
  const tableRows = isChecking ? allRows : allRows.filter(r => {
    if (filter === 'top3') return r.position != null && r.position <= 3;
    if (filter === 'top5') return r.position != null && r.position <= 5;
    if (filter === 'top10') return r.position != null && r.position <= 10;
    if (filter === 'outside10') return !r.position || r.position > 10;
    if (filter === 'outside100') return !r.position || r.position > 100;
    return true;
  });

  const top3 = rankings.filter(r => r.position && r.position <= 3).length;
  const top5 = rankings.filter(r => r.position && r.position <= 5).length;
  const top10 = rankings.filter(r => r.position && r.position <= 10).length;
  const out10 = rankings.filter(r => !r.position || r.position > 10).length;
  const out100 = rankings.filter(r => !r.position || r.position > 100).length;
  const sortedRows = sortBy === 'original' ? [...tableRows] : [...tableRows].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'keyword') return a.keyword.localeCompare(b.keyword) * dir;
    if (sortBy === 'position') return ((a.position ?? 999) - (b.position ?? 999)) * dir;
    if (sortBy === 'bestPosition') return (((a as any).bestPosition ?? 999) - ((b as any).bestPosition ?? 999)) * dir;
    if (sortBy === 'checkedAt') return ((a.checkedAt ?? '') < (b.checkedAt ?? '') ? -1 : 1) * dir;
    return 0;
  });
  const allSelected = sortedRows.length > 0 && sortedRows.every(r => selectedKeywords.has(r.keywordId));

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700 gap-6 pb-12">

      {/* ── Brand header ── */}
      <SectionHeader title="Google Rank Checker" subtitle={t('rank_checker.subtitle')}>
        <div className="flex flex-wrap gap-2">
          {availableBrands.map(brand => (
            <div key={brand.id} className={`group relative flex items-center rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-200 ${selectedBrandId === brand.id ? 'bg-navy text-white shadow-premium scale-105' : 'bg-white text-slate-400 border border-slate-200 hover:border-cyan hover:text-navy'}`}>
              <button onClick={() => setSelectedBrandId(brand.id)} className="px-5 py-2.5">{brand.name}</button>
              {(currentUser?.role === 'admin' || currentUser?.role === 'brand_owner') && handleDeleteBrand && (
                <button onClick={e => { e.stopPropagation(); handleDeleteBrand(brand.id); }} className={`opacity-0 group-hover:opacity-100 pr-2.5 transition-all ${selectedBrandId === brand.id ? 'text-white/60 hover:text-white' : 'text-slate-300 hover:text-rose-500'}`}><Trash2 size={11} /></button>
              )}
            </div>
          ))}
          {(currentUser?.role === 'admin' || currentUser?.role === 'brand_owner') && setEditingBrand && setIsBrandModalOpen && (
            <button onClick={() => { setEditingBrand(null); setIsBrandModalOpen(true); }} className="group px-5 py-2.5 bg-white border border-dashed border-slate-300 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-cyan hover:text-cyan transition-all flex items-center gap-2">
              <PlusCircle size={14} className="group-hover:rotate-90 transition-transform" />
              <span>{t('admin.brands.add_btn')}</span>
            </button>
          )}
        </div>
      </SectionHeader>

      {/* ── Two-panel layout ── */}
      {selectedBrandId && (
        <div className="flex gap-4 min-h-0 flex-1">

          {/* ── Left: Project sidebar ── */}
          <div className="w-56 shrink-0 flex flex-col gap-3">

            {/* Project list card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden flex-1">
              <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Projects</div>
                  <div className="text-xs font-black text-navy mt-0.5">{selectedBrand?.name}</div>
                </div>
                <button
                  onClick={() => { setIsCreatingProject(true); }}
                  className="w-7 h-7 rounded-xl bg-slate-50 hover:bg-cyan/10 border border-slate-200 hover:border-cyan/40 flex items-center justify-center text-slate-400 hover:text-cyan transition-all"
                  title="Tạo project mới"
                >
                  <Plus size={13} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {projectsLoading ? (
                  <div className="flex items-center gap-2 p-3 text-slate-400 text-xs">
                    <Loader2 size={13} className="animate-spin" /> Đang tải...
                  </div>
                ) : (
                  <>
                    {projects.map(project => (
                      <div key={project.id} className="relative group/item">
                        {editingProjectId === project.id ? (
                          <div className="flex items-center gap-1 p-2 rounded-xl border-2 border-cyan bg-cyan/5">
                            <input
                              autoFocus
                              value={editingProjectName}
                              onChange={e => setEditingProjectName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRenameProject(project.id); if (e.key === 'Escape') setEditingProjectId(null); }}
                              className="flex-1 text-xs font-bold text-navy bg-transparent outline-none min-w-0"
                            />
                            <button onClick={() => handleRenameProject(project.id)} className="text-emerald-500 hover:text-emerald-600"><Check size={12} /></button>
                            <button onClick={() => setEditingProjectId(null)} className="text-slate-300 hover:text-slate-500"><X size={12} /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedProjectId(selectedProjectId === project.id ? null : project.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                              selectedProjectId === project.id
                                ? 'bg-navy text-white'
                                : 'hover:bg-slate-50 text-slate-600'
                            }`}
                          >
                            {selectedProjectId === project.id
                              ? <FolderOpen size={13} className="text-cyan shrink-0" />
                              : <Folder size={13} className="text-slate-300 shrink-0" />
                            }
                            <span className="text-[11px] font-black truncate flex-1">{project.name}</span>
                          </button>
                        )}
                        {/* Hover actions */}
                        {editingProjectId !== project.id && (
                          <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity ${selectedProjectId === project.id ? 'text-white/50' : 'text-slate-300'}`}>
                            <button onClick={e => { e.stopPropagation(); setEditingProjectId(project.id); setEditingProjectName(project.name); }} className="p-1 rounded-lg hover:bg-white/20 transition-colors" title="Đổi tên"><Pencil size={10} /></button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteProject(project.id, project.name); }} className="p-1 rounded-lg hover:bg-rose-500/20 hover:text-rose-400 transition-colors" title="Xóa"><Trash2 size={10} /></button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Inline new project input */}
                    {isCreatingProject && (
                      <div className="flex items-center gap-1 p-2 rounded-xl border-2 border-cyan bg-cyan/5 mt-1">
                        <Folder size={13} className="text-cyan shrink-0" />
                        <input
                          ref={newProjectInputRef}
                          value={newProjectName}
                          onChange={e => setNewProjectName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleCreateProject(); if (e.key === 'Escape') { setIsCreatingProject(false); setNewProjectName(''); } }}
                          placeholder="Tên project..."
                          className="flex-1 text-xs font-bold text-navy bg-transparent outline-none placeholder:text-slate-300 placeholder:font-normal min-w-0"
                        />
                        <button onClick={handleCreateProject} className="text-emerald-500 hover:text-emerald-600"><Check size={12} /></button>
                        <button onClick={() => { setIsCreatingProject(false); setNewProjectName(''); }} className="text-slate-300 hover:text-slate-500"><X size={12} /></button>
                      </div>
                    )}

                    {projects.length === 0 && !isCreatingProject && (
                      <div className="p-4 text-center">
                        <Folder className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-[10px] font-bold text-slate-300 leading-relaxed">Chưa có project.<br />Nhấn + để tạo mới.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Extension status */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className={`w-2 h-2 rounded-full shrink-0 ${isExtensionReady ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Extension</div>
                <div className={`text-[10px] font-bold ${isExtensionReady ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {isExtensionReady ? 'Ready' : 'Not detected'}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Main content ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">

            {!selectedProjectId ? (
              /* Empty state: no project selected */
              projectsLoading ? (
                <div className="flex-1" />
              ) : (
                <div className="flex-1 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center mb-4">
                    <FolderOpen className="w-8 h-8 text-slate-200" />
                  </div>
                  <p className="text-sm font-black text-slate-300 uppercase tracking-widest mb-2">Chọn project</p>
                  <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
                    Chọn project từ danh sách bên trái hoặc tạo project mới để bắt đầu
                  </p>
                  <button onClick={() => setIsCreatingProject(true)} className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-cyan transition-all shadow-glow">
                    <Plus size={13} /> Tạo project mới
                  </button>
                </div>
              )
            ) : (
              <>
                {/* Stats + actions row */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Stat pills */}
                  {[
                    { label: 'Top 3',  val: top3,   key: 'top3' as const,       activeClass: 'border-emerald-400 bg-emerald-50',  numClass: 'text-emerald-500' },
                    { label: 'Top 5',  val: top5,   key: 'top5' as const,       activeClass: 'border-cyan-400 bg-cyan-50',        numClass: 'text-cyan-500' },
                    { label: 'Top 10', val: top10,  key: 'top10' as const,      activeClass: 'border-blue-500 bg-blue-50',        numClass: 'text-blue-600' },
                    { label: '>10',    val: out10,  key: 'outside10' as const,  activeClass: 'border-orange-400 bg-orange-50',    numClass: 'text-orange-500' },
                    { label: '>100',   val: out100, key: 'outside100' as const, activeClass: 'border-rose-400 bg-rose-50',        numClass: 'text-rose-500' },
                  ].map(({ label, val, key, activeClass, numClass }) => (
                    <button
                      key={key}
                      onClick={() => setFilter(filter === key ? 'all' : key)}
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border transition-all ${
                        filter === key ? `${activeClass} shadow-sm` : 'border-slate-100 bg-white shadow-sm hover:border-slate-200'
                      }`}
                    >
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                      <span className={`text-lg font-black tabular-nums ${numClass}`}>{val}</span>
                    </button>
                  ))}

                  <div className="flex-1" />

                  {/* Check button */}
                  <button
                    onClick={startChecking}
                    disabled={loading || (isChecking && !jobProgress?.done) || selectedKeywords.size === 0}
                    className="flex items-center gap-2 px-6 py-2.5 bg-navy hover:bg-cyan text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-glow hover:shadow-[0_0_20px_rgba(45,212,191,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isChecking && !jobProgress?.done
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('rank_checker.checking')}</>
                      : selectedKeywords.size > 0
                        ? <><RefreshCw className="w-3.5 h-3.5" /> Check {selectedKeywords.size} từ khóa</>
                        : <><RefreshCw className="w-3.5 h-3.5" /> Check (chọn từ khóa)</>
                    }
                  </button>
                </div>

                {/* CAPTCHA banner */}
                {isCaptchaDetected && (
                  <div className="flex items-start gap-3 px-5 py-4 bg-amber-50 border border-amber-300 rounded-2xl">
                    <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-amber-700 text-xs uppercase tracking-widest">CAPTCHA detected — {currentKeyword}</p>
                      <p className="text-amber-600 text-xs mt-0.5">Giải CAPTCHA trong cửa sổ ẩn danh, hệ thống tự tiếp tục sau đó.</p>
                    </div>
                  </div>
                )}

                {/* Main table card */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col flex-1 overflow-hidden">

                  {/* Table toolbar */}
                  <div className="px-5 py-3 border-b border-slate-50 flex items-center gap-3">
                    {/* Add keyword form */}
                    <form onSubmit={handleAddKeyword} className="flex items-center gap-2 flex-1 max-w-xs">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                        <input
                          type="text"
                          value={newKeyword}
                          onChange={e => setNewKeyword(e.target.value)}
                          placeholder={t('rank_checker.keyword_placeholder')}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-navy placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan/40 transition-all"
                        />
                      </div>
                      <button type="submit" className="px-3 py-2 bg-navy hover:bg-cyan text-white rounded-xl transition-all text-xs font-black flex items-center gap-1">
                        <Plus size={13} /> Thêm
                      </button>
                    </form>

                    <button onClick={() => setShowBulkAdd(!showBulkAdd)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${showBulkAdd ? 'border-cyan bg-cyan/5 text-cyan' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                      <List size={12} /> Hàng loạt
                    </button>

                    {selectedKeywords.size > 0 && (
                      <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-500 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-rose-100">
                        <Trash2 size={12} /> Xóa {selectedKeywords.size}
                      </button>
                    )}

                    <div className="flex-1" />

                    <div className="text-[10px] font-black text-slate-400 flex items-center gap-1.5">
                      <Globe size={11} className="text-cyan" />
                      {selectedProject?.domain || selectedBrand?.domain || '—'}
                    </div>

                    <button onClick={copyAll} disabled={!tableRows.length} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:border-navy hover:text-navy transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                      <Copy size={12} /> Copy
                    </button>
                    <button onClick={exportExcel} disabled={!tableRows.length} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm">
                      <Download size={12} /> Excel
                    </button>
                  </div>

                  {/* Bulk add panel */}
                  {showBulkAdd && (
                    <div className="px-5 py-3 border-b border-slate-50 bg-slate-50/50 flex gap-3 animate-in slide-in-from-top-2">
                      <textarea value={bulkKeywords} onChange={e => setBulkKeywords(e.target.value)} placeholder={t('rank_checker.bulk_placeholder')} rows={3} className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs font-medium text-navy placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan/20 resize-none" />
                      <button onClick={handleBulkAdd} className="px-4 py-2 bg-navy text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-cyan transition-all shadow-glow self-end">{t('rank_checker.bulk_confirm')}</button>
                    </div>
                  )}

                  {/* Table */}
                  <div className="flex-1 overflow-auto custom-scrollbar">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
                        <Loader2 className="w-8 h-8 text-cyan animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">{t('rank_checker.loading')}</p>
                      </div>
                    ) : tableRows.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center mb-4">
                          <Search className="w-7 h-7 text-slate-200" />
                        </div>
                        <p className="text-xs font-black text-slate-300 uppercase tracking-widest">
                          {keywords.length === 0 ? 'Chưa có từ khóa' : t('rank_checker.no_data')}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-[180px] leading-relaxed">
                          {keywords.length === 0 ? 'Thêm từ khóa ở trên để bắt đầu' : t('rank_checker.no_data_desc')}
                        </p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-100 sticky top-0 z-10">
                            <th className="px-5 py-3 w-10">
                              <input type="checkbox" checked={allSelected} onChange={() => allSelected ? setSelectedKeywords(new Set()) : setSelectedKeywords(new Set(sortedRows.map(r => r.keywordId)))} className="w-4 h-4 rounded accent-navy cursor-pointer" />
                            </th>
                            <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-10">#</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {t('rank_checker.col_keyword')}
                            </th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-28">{t('rank_checker.col_position')}</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24 text-center">Vị trí cũ</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-28">{t('rank_checker.col_best')}</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">{t('rank_checker.col_updated')}</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('rank_checker.col_link')}</th>
                            <th className="w-16" />
                          </tr>
                        </thead>
                        <tbody>
                          {sortedRows.map((rank, idx) => {
                            const pending = isRowPending(rank);
                            const isActive = isChecking && currentKeyword === rank.keyword;
                            const prevPos = getPrevPos(rank.keyword);
                            const isSelected = selectedKeywords.has(rank.keywordId);
                            const delta = rank.position != null && prevPos != null ? prevPos - rank.position : null;
                            return (
                              <tr key={rank.keywordId || idx} className={`border-b border-slate-50 last:border-0 transition-colors group ${pending ? 'bg-amber-50/50' : isSelected ? 'bg-yellow-50' : 'hover:bg-slate-50/40'}`}>
                                <td className="px-5 py-3.5">
                                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(rank.keywordId)} className="w-4 h-4 rounded accent-navy cursor-pointer" />
                                </td>
                                <td className="px-3 py-3.5 text-xs font-bold text-slate-300 tabular-nums">{idx + 1}</td>
                                <td className="px-4 py-3.5">
                                  <span className="text-sm font-bold text-navy">{rank.keyword}</span>
                                </td>
                                {/* Vị trí hiện tại + delta inline */}
                                <td className="px-4 py-3.5">
                                  {isActive ? (
                                    <div className="flex items-center gap-1 text-rose-500">
                                      <Loader2 size={13} className="animate-spin" />
                                      <span className="text-xs font-bold">...</span>
                                    </div>
                                  ) : pending ? (
                                    <span className="text-slate-300 text-xs">Đang chờ</span>
                                  ) : rank.position ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-sm font-black tabular-nums ${rank.position <= 3 ? 'text-emerald-500' : rank.position <= 5 ? 'text-cyan-500' : rank.position <= 10 ? 'text-blue-600' : rank.position <= 100 ? 'text-orange-500' : 'text-rose-500'}`}>{rank.position}</span>
                                      {delta != null && delta !== 0 && (
                                        delta > 0
                                          ? <span className="flex items-center text-[11px] font-black text-emerald-500 leading-none"><ArrowUp size={11} strokeWidth={3} />{delta}</span>
                                          : <span className="flex items-center text-[11px] font-black text-rose-500 leading-none"><ArrowDown size={11} strokeWidth={3} />{Math.abs(delta)}</span>
                                      )}
                                    </div>
                                  ) : <span className="text-slate-300 text-sm italic">N/A</span>}
                                </td>
                                {/* Vị trí cũ */}
                                <td className="px-4 py-3.5 text-center">
                                  {prevPos != null
                                    ? <span className="text-sm font-bold text-slate-400 tabular-nums">{prevPos}</span>
                                    : <span className="text-slate-200">—</span>}
                                </td>
                                {/* Vị trí tốt nhất */}
                                <td className="px-4 py-3.5">
                                  {rank.bestPosition != null
                                    ? <span className="text-sm font-black text-emerald-600 tabular-nums">{rank.bestPosition}</span>
                                    : <span className="text-slate-200">—</span>}
                                </td>
                                {/* Cập nhật */}
                                <td className="px-4 py-3.5 text-xs font-bold text-slate-400 whitespace-nowrap">
                                  {rank.checkedAt ? new Date(rank.checkedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : <span className="text-slate-300 italic">{t('rank_checker.not_checked')}</span>}
                                </td>
                                {/* Liên kết — full URL */}
                                <td className="px-4 py-3.5 max-w-[220px]">
                                  {rank.url ? (
                                    <a href={rank.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-cyan hover:text-navy hover:underline transition-colors max-w-full">
                                      <span className="truncate">{rank.url}</span>
                                      <ExternalLink size={10} className="shrink-0" />
                                    </a>
                                  ) : <span className="text-slate-200">—</span>}
                                </td>
                                {/* Actions */}
                                <td className="px-3 py-3.5">
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-1.5 rounded-lg text-slate-300 hover:text-navy hover:bg-slate-100 transition-all" title={t('rank_checker.view_history')}>
                                      <BarChart2 size={13} />
                                    </button>
                                    <button onClick={() => handleDeleteKeyword(rank.keywordId)} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all">
                                      <Trash2 size={13} />
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RankCheckerTab;
