import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Plus, Search, Edit2, Trash2, MapPin, Activity, X, ShieldCheck, ChevronDown } from 'lucide-react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import SectionHeader from '../SectionHeader';
import { BrandSelector } from '../UIComponents';
import { useTranslation } from 'react-i18next';
import { Market, Brand, User } from '../../types';

interface MarketsTabProps {
    availableBrands: Brand[];
    selectedBrandId: string;
    setSelectedBrandId: (id: string) => void;
    currentUser: User;
}

const MarketsTab: React.FC<MarketsTabProps> = ({ availableBrands, selectedBrandId, setSelectedBrandId, currentUser }) => {
    const { t } = useTranslation();
    const [markets, setMarkets] = useState<Market[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingMarket, setEditingMarket] = useState<Market | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        region: '',
        status: 'Active' as 'Active' | 'Inactive',
        competitors: '',
        market_trends: '',
        brand_id: ''
    });

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        fetchMarkets();
        return () => setMounted(false);
    }, []);

    const fetchMarkets = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'markets'));
            const marketsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Market[];
            setMarkets(marketsData);
        } catch (error) {
            console.error('Error fetching markets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingMarket) {
                await updateDoc(doc(db, 'markets', editingMarket.id), formData);
            } else {
                await addDoc(collection(db, 'markets'), formData);
            }
            setIsModalOpen(false);
            setEditingMarket(null);
            setFormData({
                name: '',
                region: '',
                status: 'Active',
                competitors: '',
                market_trends: '',
                brand_id: ''
            });
            fetchMarkets();
        } catch (error) {
            console.error('Error saving market:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Delete this market analysis?')) {
            try {
                await deleteDoc(doc(db, 'markets', id));
                fetchMarkets();
            } catch (error) {
                console.error('Error deleting market:', error);
            }
        }
    };

    const filteredMarkets = markets.filter(market => {
        // Role-based brand access check
        const isAccessible = availableBrands.some(b => b.id === market.brand_id);
        if (!isAccessible) return false;

        const matchesBrand = !selectedBrandId || market.brand_id === selectedBrandId;
        const matchesSearch = market.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesBrand && matchesSearch;
    });

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <SectionHeader
                title={t('markets.title')}
                subtitle={t('markets.subtitle')}
            >
                <button
                    onClick={() => {
                        setFormData({
                            name: '',
                            region: '',
                            status: 'Active',
                            competitors: '',
                            market_trends: '',
                            brand_id: selectedBrandId
                        });
                        setIsModalOpen(true);
                    }}
                    className="group px-10 py-5 bg-navy text-white rounded-[2rem] hover:bg-slate-800 shadow-2xl flex items-center gap-4 transition-all hover:-translate-y-1 active:scale-95 text-[11px] uppercase tracking-[0.3em] relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan/20 via-transparent to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                    {t('markets.add_btn')}
                </button>
            </SectionHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">
                        {t('common.brand_label')}
                    </label>
                    <BrandSelector
                        availableBrands={availableBrands}
                        selectedBrandId={selectedBrandId}
                        onChange={setSelectedBrandId}
                        className="!rounded-2xl shadow-soft"
                    />
                </div>
            </div>

            <div className="relative group w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-400 transition-colors" />
                <input
                    type="text"
                    placeholder={t('markets.search_placeholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-navy font-medium shadow-sm transition-all placeholder:text-slate-300"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredMarkets.map((market) => (
                    <div
                        key={market.id}
                        className="bg-white rounded-[2rem] border border-slate-100 p-8 hover:border-blue-500/20 transition-all group relative shadow-sm hover:shadow-md"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:border-blue-500/20 transition-colors">
                                    <Globe className="w-8 h-8 text-navy/40 group-hover:text-blue-500 transition-colors" />
                                </div>
                                <div>
                                    <h3 className="text-h2-premium group-hover:text-blue-600 transition-colors">
                                        {market.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="px-3 py-1 bg-slate-100 rounded-full text-label-caps">
                                            {market.region}
                                        </span>
                                        <span className={`px-3 py-1 rounded-full text-label-caps ${market.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                            {market.status === 'Active' ? t('markets.modal.status_active') : t('markets.modal.status_inactive')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setEditingMarket(market);
                                        setFormData({
                                            name: market.name,
                                            region: market.region,
                                            status: market.status,
                                            competitors: market.competitors,
                                            market_trends: market.market_trends,
                                            brand_id: market.brand_id
                                        });
                                        setIsModalOpen(true);
                                    }}
                                    className="p-3 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-navy transition-all border border-transparent hover:border-slate-100"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(market.id)}
                                    className="p-3 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-500 transition-all border border-transparent hover:border-rose-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 py-6 border-t border-slate-50">
                            <div className="space-y-2">
                                <div className="text-label-caps">{t('markets.competitors')}</div>
                                <p className="text-subtitle-italic opacity-100 line-clamp-2">{market.competitors}</p>
                            </div>
                            <div className="space-y-2">
                                <div className="text-label-caps">{t('markets.trends')}</div>
                                <p className="text-subtitle-italic opacity-100 line-clamp-2">{market.market_trends}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredMarkets.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[3rem] border border-dashed border-slate-200 shadow-sm animate-in fade-in duration-1000">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 border border-slate-100">
                        <Globe className="w-10 h-10 text-slate-200" />
                    </div>
                    <p className="text-label-caps opacity-50">{t('markets.empty_text')}</p>
                </div>
            )}

            {mounted && isModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-10 pb-6 flex items-start justify-between shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-[1.5rem] bg-navy flex items-center justify-center shadow-lg shadow-navy/20">
                                    <Activity className="w-8 h-8 text-blue-400" />
                                </div>
                                <div>
                                    <div className="inline-block px-4 py-1.5 bg-slate-100/80 rounded-full mb-2">
                                        <div className="text-label-caps">
                                            {t('markets.analysis')}
                                        </div>
                                    </div>
                                    <h2 className="text-h2-premium">
                                        {editingMarket ? t('common.update') : t('common.add_new')}
                                    </h2>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-slate-50 rounded-full text-slate-300 hover:text-navy transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-10 pt-0 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="col-span-2">
                                        <label className="block text-label-caps mb-3 ml-1">
                                            {t('markets.modal.name_label')}
                                        </label>
                                        <input
                                            required
                                            className="w-full px-6 py-5 bg-white border border-slate-100 rounded-[2rem] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all text-navy font-bold text-lg placeholder:text-slate-300 shadow-sm"
                                            placeholder={t('markets.modal.name_placeholder')}
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-label-caps mb-3 ml-1">
                                            {t('markets.modal.region_label')}
                                        </label>
                                        <input
                                            required
                                            className="w-full px-6 py-5 bg-white border border-slate-100 rounded-[2rem] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all text-navy font-bold text-lg placeholder:text-slate-300 shadow-sm"
                                            placeholder={t('markets.modal.region_placeholder')}
                                            value={formData.region}
                                            onChange={e => setFormData({ ...formData, region: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-label-caps mb-3 ml-1">
                                            {t('markets.modal.status_label')}
                                        </label>
                                        <div className="relative">
                                            <select
                                                className="w-full px-6 py-5 bg-white border border-slate-100 rounded-[2rem] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all text-navy font-bold text-lg appearance-none shadow-sm"
                                                value={formData.status}
                                                onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                            >
                                                <option value="Active">{t('markets.modal.status_active')}</option>
                                                <option value="Inactive">{t('markets.modal.status_inactive')}</option>
                                            </select>
                                            <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>

                                    <div className="hidden">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('common.brand_label')} *</label>
                                        <select
                                            required
                                            value={formData.brand_id}
                                            onChange={e => setFormData({ ...formData, brand_id: e.target.value })}
                                        >
                                            <option value="">{t('auditor.select_brand_error')}</option>
                                            {availableBrands.map(brand => (
                                                <option key={brand.id} value={brand.id}>{brand.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-label-caps mb-3 ml-1">
                                            {t('markets.modal.competitors_label')}
                                        </label>
                                        <textarea
                                            className="w-full px-6 py-5 bg-white border border-slate-100 rounded-[2rem] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all text-navy font-bold text-lg placeholder:text-slate-300 h-32 resize-none shadow-sm"
                                            placeholder={t('markets.modal.competitors_placeholder')}
                                            value={formData.competitors}
                                            onChange={e => setFormData({ ...formData, competitors: e.target.value })}
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-label-caps mb-3 ml-1">
                                            {t('markets.modal.trends_label')}
                                        </label>
                                        <textarea
                                            className="w-full px-6 py-5 bg-white border border-slate-100 rounded-[2rem] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all text-navy font-bold text-lg placeholder:text-slate-300 h-32 resize-none shadow-sm"
                                            placeholder={t('markets.modal.trends_placeholder')}
                                            value={formData.market_trends}
                                            onChange={e => setFormData({ ...formData, market_trends: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-10 p-6 px-10 border-t border-slate-100 shrink-0 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-label-caps font-bold text-slate-400 hover:text-navy"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="px-10 py-5 bg-navy hover:bg-navy/90 text-white rounded-[1.5rem] transition-all shadow-xl shadow-navy/20 flex items-center gap-3 group text-label-caps !text-white"
                                >
                                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                                    <span>
                                        {editingMarket ? t('common.save_changes') : t('common.add_new')}
                                    </span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default MarketsTab;
