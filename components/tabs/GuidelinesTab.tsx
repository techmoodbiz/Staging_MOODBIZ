import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Shield, Database, Search, ArrowUpRight, Copy, CheckCircle2, AlertCircle, Trash2, Clock, Fingerprint, Lock, Layers, X, FileText, Star, ChevronDown } from 'lucide-react';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import SectionHeader from '../SectionHeader';
import { BrandSelector } from '../UIComponents';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

import { Guideline, Brand, User } from '../../types';

interface GuidelinesTabProps {
  guidelines: Guideline[];
  availableBrands: Brand[];
  currentUser: User;
  setToast: (toast: any) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, type?: any) => void;
}

const GuidelinesTab: React.FC<GuidelinesTabProps> = ({
  guidelines: docs,
  availableBrands,
  currentUser,
  setToast,
  showConfirm
}) => {
  const { t } = useTranslation();

  // Role-based filtering for brands and guidelines
  const filteredBrands = availableBrands.filter(brand => {
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'brand_owner') return currentUser.ownedBrandIds?.includes(brand.id);
    return currentUser.assignedBrandIds?.includes(brand.id);
  });

  // Use already filtered availableBrands as source of truth for accessible guidelines
  const accessibleGuidelines = docs.filter(g =>
    availableBrands.some(brand => brand.id === g.brand_id)
  );

  const guidelines = accessibleGuidelines;
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Guideline | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState('all');

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const fetchGuidelines = async () => {
    // Data is provided via props from App.tsx (brand_guidelines collection)
    // This function is kept for compatibility with approve/delete/setMaster callbacks
  };

  const approveGuideline = async (id: string) => {
    try {
      const res = await axios.post('https://hook.us2.make.com/6ms9a6vj54m9j868gq7yvub1t33mxt9j', {
        guideline_id: id,
        action: 're-ingest'
      });

      if (res.status === 200) {
        alert(t('guidelines.toast.ingest_start'));
        await updateDoc(doc(db, 'brand_guidelines', id), { status: 'approved' });
        fetchGuidelines();
      }
    } catch (error) {
      console.error('Error approving guideline:', error);
      alert(t('guidelines.toast.request_sent'));
    }
  };

  const setMasterGuideline = async (id: string) => {
    try {
      const currentMaster = guidelines.find(g => g.is_primary);
      if (currentMaster) {
        await updateDoc(doc(db, 'brand_guidelines', currentMaster.id), { is_primary: false });
      }
      await updateDoc(doc(db, 'brand_guidelines', id), { is_primary: true });
      alert(t('guidelines.toast.primary_set'));
      fetchGuidelines();
    } catch (error) {
      console.error('Error setting master guideline:', error);
    }
  };

  const deleteGuideline = async (id: string) => {
    if (window.confirm(t('guidelines.confirm.delete_msg'))) {
      try {
        await deleteDoc(doc(db, 'brand_guidelines', id));
        fetchGuidelines();
      } catch (error) {
        console.error('Error deleting guideline:', error);
      }
    }
  };

  const getBrandName = (brandId: string) => {
    return availableBrands.find(b => b.id === brandId)?.name || t('history.central_intel');
  };

  const filteredGuidelines = guidelines.filter(g => {
    const matchesBrand = !selectedBrandId || selectedBrandId === 'all' || g.brand_id === selectedBrandId;
    const matchesSearch = getBrandName(g.brand_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.file_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesBrand && matchesSearch;
  });

  const stats = [
    { label: t('guidelines.all_guidelines'), value: guidelines.length, sub: 'TOTAL DOCUMENTS', color: 'text-navy' },
    { label: t('guidelines.active_guidelines'), value: guidelines.filter(g => g.status === 'approved').length, sub: 'APPROVED LAYER', color: 'text-emerald-500' },
    { label: t('guidelines.pending_guidelines'), value: guidelines.filter(g => g.status === 'pending').length, sub: 'INGESTION QUEUE', color: 'text-amber-500' },
    { label: t('guidelines.rejected_guidelines'), value: guidelines.filter(g => g.status === 'rejected').length, sub: 'DEACTIVATED LAYER', color: 'text-red-500' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <SectionHeader
        title={t('guidelines.title')}
        subtitle={t('guidelines.subtitle')}
      />

      {/* Hero Banner - Navy */}
      <div className="bg-navy rounded-[2rem] p-10 relative overflow-hidden shadow-xl shadow-navy/10">
        <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy to-blue-900/80" />
        <div className="relative flex items-start gap-6">
          <div className="w-16 h-16 rounded-[1.5rem] bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 shrink-0">
            <Database className="w-8 h-8 text-blue-300" />
          </div>
          <div className="flex-1">
            <div className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full mb-3 border border-white/10">
              <div className="text-label-caps !text-white/80 flex items-center gap-2">
                <Shield className="w-3 h-3" />
                {t('guidelines.knowledge_base')}
              </div>
            </div>
            <h3 className="text-h2-premium !text-white mb-3">
              {t('guidelines.unified_arch')}
            </h3>
            <p className="text-white/50 text-sm leading-relaxed max-w-2xl">
              {t('guidelines.desc')}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all">
            <div className="text-label-caps mb-3">
              {stat.label}
            </div>
            <div className={`text-4xl font-black ${stat.color} tracking-tight mb-1`}>
              {stat.value}
            </div>
            <div className="text-subtitle-italic opacity-40 ml-1">
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Directory Section */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {/* Directory Header */}
        <div className="p-8 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-block px-3 py-1 bg-slate-100 rounded-full mb-2">
              <span className="text-label-caps">REGISTRY V4.2</span>
            </div>
            <h3 className="text-h2-premium">{t('guidelines.directory_title')}</h3>
            <p className="text-subtitle-italic opacity-60 ml-1 mt-1">{t('guidelines.governance_layer')}</p>
          </div>
          <div className="w-full sm:w-64">
            <BrandSelector
              availableBrands={filteredBrands}
              selectedBrandId={selectedBrandId}
              onChange={setSelectedBrandId}
              showAllOption={true}
            />
          </div>
        </div>

        {/* Table Header */}
        <div className="px-8">
          <div className="grid grid-cols-12 gap-4 py-4 border-b border-slate-100">
            <div className="col-span-2 text-label-caps">{t('guidelines.table.brand')}</div>
            <div className="col-span-4 text-label-caps">{t('guidelines.table.name')}</div>
            <div className="col-span-3 text-label-caps">{t('guidelines.table.category')}</div>
            <div className="col-span-1 text-label-caps">{t('guidelines.table.status')}</div>
            <div className="col-span-2 text-label-caps text-right">{t('guidelines.table.actions')}</div>
          </div>
        </div>

        {/* Table Rows */}
        <div className="px-8 divide-y divide-slate-50">
          {filteredGuidelines.map((guideline) => (
            <div key={guideline.id} className="grid grid-cols-12 gap-4 py-6 items-center group hover:bg-slate-50/50 -mx-8 px-8 transition-colors">
              {/* Brand */}
              <div className="col-span-2">
                <span className="text-label-caps">
                  {getBrandName(guideline.brand_id)}
                </span>
              </div>

              {/* Guideline Name */}
              <div className="col-span-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:border-blue-500/20 transition-colors">
                    <FileText className="w-5 h-5 text-navy/30 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-black text-navy tracking-tight cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => setSelectedDoc(guideline)}
                      >
                        {guideline.file_name}
                      </span>
                      {guideline.is_primary && (
                        <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-label-caps !text-emerald-600 rounded-full">
                          {t('guidelines.master_protocol')}
                        </span>
                      )}
                    </div>
                    {guideline.description && (
                      <p className="text-subtitle-italic opacity-60 mt-0.5">{guideline.description}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Vector Category */}
              <div className="col-span-3">
                <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-label-caps">
                  {guideline.type || t('guidelines.auto_signature')}
                </span>
              </div>

              {/* Status Toggle */}
              <div className="col-span-1">
                <button
                  disabled={currentUser.role === 'content_creator'}
                  onClick={() => guideline.status === 'pending' ? approveGuideline(guideline.id) : null}
                  className={`w-10 h-6 rounded-full relative transition-colors ${guideline.status === 'approved' ? 'bg-cyan-400' : 'bg-slate-200'} ${currentUser.role === 'content_creator' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${guideline.status === 'approved' ? 'left-5' : 'left-1'}`} />
                </button>
              </div>

              {/* Actions */}
              <div className="col-span-2">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => setSelectedDoc(guideline)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-300 hover:text-navy transition-all"
                    title="View"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  {currentUser.role !== 'content_creator' && (
                    <>
                      <button
                        onClick={() => setMasterGuideline(guideline.id)}
                        className={`p-2 rounded-xl transition-all ${guideline.is_primary ? 'bg-amber-50 text-amber-500' : 'text-slate-300 hover:bg-slate-100 hover:text-amber-500'}`}
                        title="Set as Master"
                      >
                        <StarIcon className={`w-4 h-4 ${guideline.is_primary ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => deleteGuideline(guideline.id)}
                        className="p-2 hover:bg-rose-50 rounded-xl text-slate-300 hover:text-rose-500 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredGuidelines.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <BookOpen className="w-8 h-8 text-slate-200" />
            </div>
            <p className="text-slate-300 font-black uppercase tracking-[0.3em] text-sm">{t('guidelines.empty_text')}</p>
          </div>
        )}
      </div>

      {/* Doc Detail Modal */}
      {mounted && selectedDoc && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedDoc(null)} />
          <div className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-10 pb-6 flex items-start justify-between shrink-0">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-[1.5rem] bg-navy flex items-center justify-center shadow-lg shadow-navy/20">
                  <BookOpen className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <div className="inline-block px-4 py-1.5 bg-slate-100/80 rounded-full mb-2">
                    <div className="text-label-caps">
                      {t('guidelines.master_protocol')}
                    </div>
                  </div>
                  <h2 className="text-h1-premium mb-2">
                    {selectedDoc.file_name}
                  </h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-subtitle-italic flex items-center gap-1.5">
                      <Fingerprint className="w-3 h-3 text-blue-500" />
                      {getBrandName(selectedDoc.brand_id)}
                    </span>
                    <span className={`text-label-caps flex items-center gap-1.5 ${selectedDoc.status === 'approved' ? 'text-emerald-500' : selectedDoc.status === 'pending' ? 'text-amber-500' : 'text-red-500'}`}>
                      <Lock className="w-3 h-3" />
                      {selectedDoc.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedDoc.guideline_text || '');
                    alert(t('guidelines.toast.copy_success'));
                  }}
                  className="p-3 hover:bg-slate-50 rounded-xl text-slate-300 hover:text-navy transition-all border border-slate-100"
                >
                  <Copy className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="p-2 hover:bg-slate-50 rounded-full text-slate-300 hover:text-navy transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pb-10">
              <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                <div className="w-1 h-10 rounded-full bg-blue-500" />
                <div>
                  <div className="text-label-caps !text-blue-500 mb-0.5">{t('guidelines.metadata_indexing')}</div>
                  <div className="text-subtitle-italic opacity-100">"{t('guidelines.dna_extract_desc')}"</div>
                </div>
              </div>
              <pre className="text-slate-600 leading-relaxed font-mono text-sm whitespace-pre-wrap bg-slate-50 p-6 rounded-2xl border border-slate-100">
                {selectedDoc.guideline_text}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="p-6 px-10 border-t border-slate-100 shrink-0 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.02)] flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase font-black text-slate-300 tracking-widest">{t('guidelines.signature')}</span>
                  <span className="font-mono text-[9px] text-blue-400">MB-RAG-882-XQ</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase font-black text-slate-300 tracking-widest">ENCRYPTION</span>
                  <span className="font-mono text-[9px] text-emerald-400">SHA-256 SECURED</span>
                </div>
              </div>
              <div className="text-[9px] font-black tracking-tighter text-slate-200">{t('guidelines.infra_footer')}</div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// Simple Star Icon for Master Guideline
const StarIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export default GuidelinesTab;