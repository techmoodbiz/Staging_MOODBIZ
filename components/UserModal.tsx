
import React, { useState, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { User, Brand } from '../types';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void> | void;
  user: User | null;
  brands: Brand[];
  currentUserRole: string;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onSave, user, brands, currentUserRole }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(user?.name || user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState<User['role']>(user?.role || 'content_creator');
  const [password, setPassword] = useState('');
  const [ownedBrandIds, setOwnedBrandIds] = useState<string[]>(user?.ownedBrandIds || []);
  const [assignedBrandIds, setAssignedBrandIds] = useState<string[]>(user?.assignedBrandIds || []);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || user.displayName || '');
      setEmail(user.email || '');
      setRole(user.role || 'content_creator');
      setOwnedBrandIds(user.ownedBrandIds || []);
      setAssignedBrandIds(user.assignedBrandIds || []);
      setPassword('');
    } else {
      setName('');
      setEmail('');
      setRole('content_creator');
      setPassword('');
      setOwnedBrandIds([]);
      setAssignedBrandIds([]);
    }
    setIsSaving(false);
  }, [user, isOpen]);

  const handleToggleBrand = (brandId: string) => {
    if (assignedBrandIds.includes(brandId)) {
      setAssignedBrandIds(assignedBrandIds.filter(id => id !== brandId));
    } else {
      setAssignedBrandIds([...assignedBrandIds, brandId]);
    }
  };
  const handleToggleOwnedBrand = (brandId: string) => {
    if (ownedBrandIds.includes(brandId)) {
      setOwnedBrandIds(ownedBrandIds.filter(id => id !== brandId));
    } else {
      setOwnedBrandIds([...ownedBrandIds, brandId]);
    }
  };

  const handleSubmit = async () => {
    if (!name || !email) { alert(t('admin.users.modal.fill_error')); return; }
    if (!user && !password) { alert(t('admin.users.modal.password_error')); return; }

    // Removed validation for Brand Owner needing at least 1 brand.

    setIsSaving(true);
    try {
      await onSave({
        name, email, password, role,
        ownedBrandIds: role === "brand_owner" ? ownedBrandIds : [],
        assignedBrandIds: role === "content_creator" ? assignedBrandIds : [],
      });
    } catch (e) {
      console.error(e);
    } finally {
      // Nếu component chưa unmount (ví dụ khi lỗi), tắt loading
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = "w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-[#102d62] placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#01ccff]/20 focus:border-[#01ccff] outline-none transition-all";
  const labelClass = "block text-xs font-bold text-[#102d62] uppercase tracking-wide mb-1.5 ml-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white z-10">
          <h2 className="text-xl font-bold text-[#102d62]">{user ? t('admin.users.modal.edit_title') : t('admin.users.modal.add_title')}</h2>
          <button onClick={onClose} disabled={isSaving} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-slate-50 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>{t('admin.users.modal.name_label')}</label>
              <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="VD: Nguyễn Văn A" disabled={isSaving} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" className={`${inputClass} ${user ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`} value={email} onChange={e => setEmail(e.target.value)} placeholder="user@moodbiz.vn" disabled={!!user || isSaving} />
            </div>
          </div>

          {!user && (
            <div>
              <label className={labelClass}>{t('admin.users.modal.password_label')}</label>
              <input type="password" className={inputClass} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" disabled={isSaving} />
            </div>
          )}

          <div>
            <label className={labelClass}>{t('admin.users.modal.role_label')}</label>
            <div className="relative">
              <select className={`${inputClass} appearance-none cursor-pointer`} value={role} onChange={e => setRole(e.target.value as User['role'])} disabled={currentUserRole === 'brand_owner' || isSaving}>
                {/* Hiển thị option Admin nếu người dùng hiện tại là Admin HOẶC user đang sửa là Admin */}
                {(currentUserRole === 'admin' || role === 'admin') && <option value="admin">Admin System</option>}

                {/* Hiển thị option Brand Owner nếu người dùng hiện tại là Admin HOẶC user đang sửa là Brand Owner */}
                {(currentUserRole === 'admin' || role === 'brand_owner') && <option value="brand_owner">Brand Owner</option>}

                <option value="content_creator">Content Creator</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
          </div>

          {role === "brand_owner" && (
            <div>
              <label className={labelClass}>{t('admin.users.modal.owned_brands')}</label>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto custom-scrollbar">
                {brands.length === 0 ? <p className="text-sm text-slate-400 p-3 italic">{t('admin.users.modal.no_brands')}</p> : brands.map(brand => (
                  <label key={brand.id} className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg transition-colors ${ownedBrandIds.includes(brand.id) ? 'bg-white shadow-sm border border-slate-100' : 'hover:bg-white hover:shadow-sm'}`}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${ownedBrandIds.includes(brand.id) ? 'bg-[#01ccff] border-[#01ccff]' : 'bg-white border-slate-300'}`}>
                      {ownedBrandIds.includes(brand.id) && <Check size={14} className="text-white" />}
                    </div>
                    <input type="checkbox" checked={ownedBrandIds.includes(brand.id)} onChange={() => handleToggleOwnedBrand(brand.id)} className="hidden" disabled={isSaving} />
                    <span className={`text-sm font-medium ${ownedBrandIds.includes(brand.id) ? 'text-[#102d62]' : 'text-slate-600'}`}>{brand.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {role === 'content_creator' && (
            <div>
              <label className={labelClass}>{t('admin.users.modal.assigned_brands')}</label>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto custom-scrollbar">
                {brands.length === 0 ? <p className="text-sm text-slate-400 p-3 italic">{t('admin.users.modal.no_brands')}</p> : brands.map(brand => (
                  <label key={brand.id} className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg transition-colors ${assignedBrandIds.includes(brand.id) ? 'bg-white shadow-sm border border-slate-100' : 'hover:bg-white hover:shadow-sm'}`}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${assignedBrandIds.includes(brand.id) ? 'bg-[#01ccff] border-[#01ccff]' : 'bg-white border-slate-300'}`}>
                      {assignedBrandIds.includes(brand.id) && <Check size={14} className="text-white" />}
                    </div>
                    <input type="checkbox" checked={assignedBrandIds.includes(brand.id)} onChange={() => handleToggleBrand(brand.id)} className="hidden" disabled={isSaving} />
                    <span className={`text-sm font-medium ${assignedBrandIds.includes(brand.id) ? 'text-[#102d62]' : 'text-slate-600'}`}>{brand.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 z-10">
          <button onClick={onClose} disabled={isSaving} className="px-5 py-2.5 text-sm font-bold rounded-xl text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50">{t('admin.users.modal.cancel')}</button>
          <button onClick={handleSubmit} disabled={isSaving} className="px-6 py-2.5 text-sm font-bold rounded-xl bg-[#102d62] text-white hover:bg-blue-900 shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed min-w-[120px] justify-center">
            {isSaving ? (
              <><Loader2 className="animate-spin" size={18} /> {t('admin.users.modal.saving')}</>
            ) : (
              user ? t('admin.users.modal.update_btn') : t('admin.users.modal.create_btn')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserModal;
