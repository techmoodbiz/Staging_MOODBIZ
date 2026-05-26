import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Package, Plus, Search, Edit2, Trash2, ShoppingBag, X, ShieldCheck, ChevronDown, Tag } from 'lucide-react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import SectionHeader from '../SectionHeader';
import { BrandSelector } from '../UIComponents';
import { useTranslation } from 'react-i18next';
import { Product, Brand, User } from '../../types';

interface ProductsTabProps {
  availableBrands: Brand[];
  selectedBrandId: string;
  setSelectedBrandId: (id: string) => void;
  currentUser: User;
}

const TYPE_META: Record<string, { color: string; label: string; bg: string; text: string }> = {
  service: { color: '#3b82f6', label: 'Service', bg: 'bg-blue-50', text: 'text-blue-600' },
  good: { color: '#8b5cf6', label: 'Product', bg: 'bg-violet-50', text: 'text-violet-600' },
};

const ProductsTab: React.FC<ProductsTabProps> = ({ availableBrands, selectedBrandId, setSelectedBrandId, currentUser }) => {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'service' as 'service' | 'good',
    category: '',
    target_audience: '',
    benefits: '',
    usp: '',
    brand_id: ''
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchData();
    return () => setMounted(false);
  }, []);

  const fetchData = async () => {
    try {
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData = productsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), formData);
      } else {
        await addDoc(collection(db, 'products'), formData);
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ name: '', type: 'service', category: '', target_audience: '', benefits: '', usp: '', brand_id: '' });
      fetchData();
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('products.confirm_delete'))) {
      try {
        await deleteDoc(doc(db, 'products', id));
        fetchData();
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  const filteredProducts = useMemo(() => products.filter(product => {
    const isAccessible = availableBrands.some(b => b.id === product.brand_id);
    if (!isAccessible) return false;
    const matchesBrand = !selectedBrandId || product.brand_id === selectedBrandId;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesBrand && matchesSearch;
  }), [products, availableBrands, selectedBrandId, searchTerm]);

  const stats = useMemo(() => ({
    total: filteredProducts.length,
    services: filteredProducts.filter(p => p.type === 'service').length,
    goods: filteredProducts.filter(p => p.type === 'good').length,
    categories: new Set(filteredProducts.map(p => p.category).filter(Boolean)).size,
  }), [filteredProducts]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <SectionHeader title={t('products.title')} subtitle={t('products.subtitle')}>
        <button
          onClick={() => {
            setFormData({ name: '', type: 'service', category: '', target_audience: '', benefits: '', usp: '', brand_id: selectedBrandId });
            setIsModalOpen(true);
          }}
          className="group px-10 py-5 bg-navy text-white rounded-[2rem] font-black hover:bg-slate-800 shadow-2xl flex items-center gap-4 transition-all hover:-translate-y-1 active:scale-95 text-[11px] uppercase tracking-[0.3em] relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan/20 via-transparent to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          {t('products.add_btn')}
        </button>
      </SectionHeader>

      {/* Stats pills */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2.5 px-5 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-navy" />
          <span className="text-label-caps">{stats.total} SẢN PHẨM</span>
        </div>
        <div className="flex items-center gap-2.5 px-5 py-3 bg-blue-50 rounded-2xl border border-blue-100">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-label-caps !text-blue-600">{stats.services} DỊCH VỤ</span>
        </div>
        <div className="flex items-center gap-2.5 px-5 py-3 bg-violet-50 rounded-2xl border border-violet-100">
          <div className="w-2 h-2 rounded-full bg-violet-500" />
          <span className="text-label-caps !text-violet-600">{stats.goods} HÀNG HÓA</span>
        </div>
        <div className="flex items-center gap-2.5 px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100">
          <Tag className="w-3 h-3 text-slate-400" />
          <span className="text-label-caps">{stats.categories} DANH MỤC</span>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex gap-4">
        <div className="w-64 shrink-0">
          <BrandSelector availableBrands={availableBrands} selectedBrandId={selectedBrandId} onChange={setSelectedBrandId} className="!rounded-2xl shadow-soft" />
        </div>
        <div className="relative group flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-400 transition-colors" />
          <input
            type="text"
            placeholder={t('products.search_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-navy transition-all font-medium placeholder:text-slate-300 shadow-sm text-sm"
          />
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredProducts.map((product, idx) => {
          const meta = TYPE_META[product.type] || TYPE_META.service;
          return (
            <div
              key={product.id}
              className="bg-white rounded-2xl border border-slate-100 hover:border-slate-200 transition-all group relative shadow-sm hover:shadow-xl overflow-hidden"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Left accent strip */}
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: meta.color }} />

              <div className="p-6 pl-7">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: meta.color + '18' }}>
                      <ShoppingBag className="w-5 h-5" style={{ color: meta.color }} />
                    </div>
                    <div>
                      <h3 className="font-black text-navy text-sm tracking-tight leading-tight group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${meta.bg} ${meta.text}`}>
                          {meta.label}
                        </span>
                        {product.category && (
                          <span className="px-2.5 py-0.5 bg-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500">
                            {product.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => {
                        setEditingProduct(product);
                        setFormData({ name: product.name, category: product.category, type: product.type, target_audience: product.target_audience, benefits: product.benefits, usp: product.usp, brand_id: product.brand_id });
                        setIsModalOpen(true);
                      }}
                      className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-navy transition-all border border-transparent hover:border-slate-100"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-500 transition-all border border-transparent hover:border-rose-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Target Audience</div>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{product.target_audience}</p>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Unique Value</div>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{product.usp}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
            <ShoppingBag className="w-8 h-8 text-slate-200" />
          </div>
          <p className="text-label-caps opacity-40">CHƯA CÓ SẢN PHẨM</p>
        </div>
      )}

      {mounted && isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-10 pb-6 flex items-start justify-between shrink-0">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-[1.5rem] bg-navy flex items-center justify-center shadow-lg shadow-navy/20">
                  <Package className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <div className="inline-block px-4 py-1.5 bg-slate-100/80 rounded-full mb-2">
                    <div className="text-label-caps">{t('products.modal.subtitle') || 'QUẢN LÝ SẢN PHẨM/DỊCH VỤ'}</div>
                  </div>
                  <h2 className="text-h2-premium">
                    {editingProduct ? (t('products.modal.edit_title') || 'CẬP NHẬT') : (t('products.modal.add_title') || 'THÊM MỚI')}
                  </h2>
                </div>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full text-slate-300 hover:text-navy transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-10 pt-0 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                <div className="grid grid-cols-2 gap-8">
                  <div className="col-span-2">
                    <label className="block text-label-caps mb-3 ml-1">{t('products.modal.name_label')} *</label>
                    <input required className="w-full px-6 py-5 bg-white border border-slate-100 rounded-[2rem] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all text-navy font-bold text-lg placeholder:text-slate-300 shadow-sm" placeholder={t('products.modal.name_placeholder') || 'VD: Gói Marketing Tổng Thể'} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-label-caps mb-3 ml-1">{t('products.modal.type_label')} *</label>
                    <div className="relative">
                      <select className="w-full px-6 py-5 bg-white border border-slate-100 rounded-[2rem] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all text-navy font-bold text-lg appearance-none shadow-sm" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                        <option value="service">{t('products.modal.type_service_opt')}</option>
                        <option value="good">{t('products.modal.type_good_opt')}</option>
                      </select>
                      <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-label-caps mb-3 ml-1">{t('products.modal.category_label')} *</label>
                    <input required className="w-full px-6 py-5 bg-white border border-slate-100 rounded-[2rem] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all text-navy font-bold text-lg placeholder:text-slate-300 shadow-sm" placeholder={t('products.modal.category_placeholder') || 'VD: Digital Marketing'} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-label-caps mb-3 ml-1">{t('products.modal.audience_label')} *</label>
                    <input required className="w-full px-6 py-5 bg-white border border-slate-100 rounded-[2rem] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all text-navy font-bold text-lg placeholder:text-slate-300 shadow-sm" placeholder={t('products.modal.audience_placeholder') || 'VD: Doanh nghiệp SME ngành F&B tại Việt Nam'} value={formData.target_audience} onChange={e => setFormData({ ...formData, target_audience: e.target.value })} />
                  </div>
                  <div className="hidden">
                    <select required value={formData.brand_id} onChange={e => setFormData({ ...formData, brand_id: e.target.value })}>
                      <option value="">Select Brand</option>
                      {availableBrands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-label-caps mb-3 ml-1">{t('products.modal.benefits_label')}</label>
                    <textarea className="w-full px-6 py-5 bg-white border border-slate-100 rounded-[2rem] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all text-navy font-bold text-lg placeholder:text-slate-300 h-32 resize-none shadow-sm" placeholder={t('products.modal.benefits_placeholder')} value={formData.benefits} onChange={e => setFormData({ ...formData, benefits: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-label-caps mb-3 ml-1">{t('products.modal.usp_label')}</label>
                    <textarea className="w-full px-6 py-5 bg-white border border-slate-100 rounded-[2rem] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all text-navy font-bold text-lg placeholder:text-slate-300 h-32 resize-none shadow-sm" placeholder={t('products.modal.usp_placeholder')} value={formData.usp} onChange={e => setFormData({ ...formData, usp: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-10 p-6 px-10 border-t border-slate-100 shrink-0 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-label-caps font-bold text-slate-400 hover:text-navy">{t('products.modal.cancel') || 'HỦY'}</button>
                <button type="submit" className="px-10 py-5 bg-navy hover:bg-navy/90 text-white rounded-[1.5rem] transition-all shadow-xl shadow-navy/20 flex items-center gap-3 group text-label-caps !text-white">
                  <ShieldCheck className="w-5 h-5 text-blue-400" />
                  <span>{editingProduct ? (t('products.modal.save') || 'CẬP NHẬT') : (t('products.modal.add_btn') || 'THÊM MỚI')}</span>
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

export default ProductsTab;
