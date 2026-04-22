
import React, { useState, useEffect, useRef } from 'react';
import {
  Building2, ChevronDown, LucideIcon, X, Menu, Check, Search, Filter,
  PenTool, Activity, MessageSquare, Zap, CheckCircle, AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { Brand, User } from '../types';
import { db } from '../firebase';
import { useTranslation } from 'react-i18next';

// --- Mobile Menu Toggle ---
export const MenuToggle: React.FC<{ isOpen: boolean; toggle: () => void }> = ({ isOpen, toggle }) => (
  <button
    onClick={toggle}
    className="md:hidden p-2 text-navy hover:bg-slate-50 rounded-lg transition-all active:scale-95"
  >
    {isOpen ? <X size={24} /> : <Menu size={24} />}
  </button>
);


// --- Stat Card ---
export const StatCard: React.FC<{ label: string; value: string; delay?: number; icon: any }> = ({ label, value, delay, icon: Icon }) => (
  <div
    className="premium-card p-10 group hover:scale-[1.02] transition-all duration-700 glow border-none shadow-premium animate-in"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex flex-col gap-8">
      <div className="p-4 bg-slate-50 text-navy rounded-[1.25rem] w-fit group-hover:bg-navy group-hover:text-white transition-all duration-700 group-hover:rotate-12 shadow-inner-soft group-hover:shadow-glow">
        <Icon size={24} strokeWidth={2.5} />
      </div>
      <div className="space-y-1">
        <p className="text-label-caps ml-1">{label}</p>
        <p className="text-h1-premium group-hover:text-cyan transition-colors duration-500">{value}</p>
      </div>
    </div>
  </div>
);

// --- Feature Card ---
export const FeatureCard: React.FC<{ title: string; desc: string; icon: any; delay?: number }> = ({ title, desc, icon: Icon, delay }) => (
  <div
    className="premium-card p-12 flex flex-col items-start gap-10 animate-in glow border-none shadow-premium transition-all duration-700 hover:-translate-y-2"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="p-5 bg-navy/5 text-cyan rounded-[1.5rem] shadow-inner-soft group-hover:rotate-6 transition-transform">
      <Icon size={36} strokeWidth={2.5} />
    </div>
    <div className="space-y-4">
      <h3 className="text-h2-premium">{title}</h3>
      <p className="text-subtitle-italic opacity-100">{desc}</p>
    </div>
  </div>
);

// --- Quick Action Card ---
export const QuickActionCard: React.FC<{ title: string; desc: string; icon: any; onClick: () => void; color: 'blue' | 'cyan' | 'emerald' | 'indigo' }> = ({ title, desc, icon: Icon, onClick, color }) => (
  <button
    onClick={onClick}
    className="text-left p-10 rounded-[2.5rem] border border-slate-100 bg-white shadow-soft transition-all duration-500 hover:shadow-premium hover:-translate-y-2 group relative overflow-hidden glow premium-card"
  >
    <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-700 ${color === 'blue' ? 'bg-navy' : color === 'emerald' ? 'bg-emerald-500' : color === 'indigo' ? 'bg-indigo-500' : 'bg-cyan'}`} />

    <div className={`p-4 rounded-2xl w-fit mb-8 shadow-soft transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${color === 'blue' ? 'bg-navy text-white' : color === 'emerald' ? 'bg-emerald-500 text-white' : color === 'indigo' ? 'bg-indigo-500 text-white' : 'bg-cyan text-white shadow-glow'}`}>
      <Icon size={32} strokeWidth={2.5} />
    </div>
    <div className="space-y-2">
      <h3 className="text-h2-premium group-hover:text-cyan transition-colors">{title}</h3>
      <p className="text-slate-500 text-[15px] font-medium leading-relaxed tracking-tight">{desc}</p>
    </div>
  </button>
);



// --- REUSABLE PREMIUM CUSTOM SELECT ---
interface SelectOption {
  value: string;
  label: string;
  icon?: LucideIcon | string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Chọn một tùy chọn",
  icon: MainIcon,
  disabled,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-2.5 pl-3 pr-8 py-3 bg-white border rounded-2xl transition-all text-left shadow-sm group ${isOpen ? 'border-cyan ring-4 ring-cyan/10 shadow-md' : 'border-slate-400 hover:border-cyan/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {MainIcon && (
          <div className={`shrink-0 transition-colors ${isOpen ? 'text-[#01ccff]' : 'text-slate-400 group-hover:text-slate-600'}`}>
            <MainIcon size={16} strokeWidth={2.5} />
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <span className={`block font-bold text-[12px] tracking-tight truncate ${selectedOption ? 'text-[#102d62]' : 'text-slate-400'}`}>
            {selectedOption ? (
              <div className="flex items-center gap-2 truncate">
                {selectedOption.icon && (
                  typeof selectedOption.icon === 'string'
                    ? <span className="text-base leading-none shrink-0">{selectedOption.icon}</span>
                    : <selectedOption.icon size={13} className="text-[#01ccff] shrink-0" />
                )}
                <span className="truncate">{selectedOption.label}</span>
              </div>
            ) : placeholder}
          </span>
        </div>

        <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#01ccff]' : ''}`}>
          <ChevronDown size={16} strokeWidth={2.5} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
          <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-1.5 space-y-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${value === opt.value
                  ? 'bg-blue-50 text-[#102d62] font-black'
                  : 'hover:bg-slate-50 text-slate-600 hover:text-[#102d62] font-medium'
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {opt.icon && (
                    typeof opt.icon === 'string'
                      ? <span className="text-base leading-none shrink-0">{opt.icon}</span>
                      : <opt.icon size={14} className={value === opt.value ? 'text-[#102d62] shrink-0' : 'text-slate-400 group-hover:text-blue-500 shrink-0'} />
                  )}
                  <span className="text-[12.5px] truncate">{opt.label}</span>
                </div>
                {value === opt.value && <Check size={13} strokeWidth={3} className="text-[#102d62] shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- MULTI SELECT ---
export const MultiSelect: React.FC<{
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
}> = ({ options, value, onChange, placeholder = "Chọn tùy chọn", icon: MainIcon, disabled, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter(v => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const selectedOptions = options.filter(opt => value.includes(opt.value));

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-2.5 pl-3 pr-8 py-3 bg-white border rounded-2xl transition-all text-left shadow-sm group ${isOpen ? 'border-[#01ccff] ring-4 ring-[#01ccff]/5' : 'border-slate-400 hover:border-slate-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {MainIcon && (
          <div className={`shrink-0 transition-colors ${isOpen ? 'text-[#01ccff]' : 'text-slate-400 group-hover:text-slate-600'}`}>
            <MainIcon size={16} strokeWidth={2.5} />
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {selectedOptions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedOptions.map(opt => (
                <span key={opt.value} className="px-2.5 py-1 bg-[#102d62]/5 text-[#102d62] rounded-lg text-[11px] font-black border border-[#102d62]/10 truncate max-w-[150px]">
                  {opt.label}
                </span>
              ))}
            </div>
          ) : (
            <span className="block font-bold text-[12px] tracking-tight truncate text-[#102d62]">
              {placeholder}
            </span>
          )}
        </div>

        <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#01ccff]' : ''}`}>
          <ChevronDown size={16} strokeWidth={2.5} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
          <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-1.5 space-y-1">
            {options.map((opt) => {
              const isSelected = value.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleToggle(opt.value)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${isSelected
                    ? 'bg-blue-50 text-[#102d62] font-black'
                    : 'hover:bg-slate-50 text-[#102d62] font-bold'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {opt.icon && (
                      typeof opt.icon === 'string'
                        ? <span className="text-base leading-none shrink-0">{opt.icon}</span>
                        : <opt.icon size={14} className={isSelected ? 'text-[#102d62] shrink-0' : 'text-slate-400 group-hover:text-blue-500 shrink-0'} />
                    )}
                    <span className="text-[12.5px] truncate">{opt.label}</span>
                  </div>
                  {isSelected && <Check size={13} strokeWidth={3} className="text-[#102d62] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Brand Selector ---
export const BrandSelector: React.FC<{
  availableBrands: Brand[];
  selectedBrandId: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  showAllOption?: boolean;
  className?: string;
}> = ({ availableBrands, selectedBrandId, onChange, disabled, showAllOption, className }) => {
  const { t } = useTranslation();
  const options: SelectOption[] = [];
  if (showAllOption) options.push({ value: 'all', label: t('common.all_brands'), icon: Building2 });
  availableBrands.forEach(b => options.push({ value: b.id, label: b.name, icon: Building2 }));

  return (
    <CustomSelect
      options={options}
      value={selectedBrandId}
      onChange={onChange}
      placeholder={t('auditor.brand')}
      disabled={disabled}
      className={className}
    />
  );
};

// --- Confirmation Modal ---
export const ConfirmationModal: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  type?: 'danger' | 'warning' | 'info';
}> = ({ isOpen, title, message, onConfirm, onClose, type = 'danger' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className={`p-3 rounded-2xl ${type === 'danger' ? 'bg-red-50 text-red-500' :
              type === 'warning' ? 'bg-amber-50 text-amber-500' :
                'bg-blue-50 text-blue-500'
              }`}>
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-2xl font-black text-[#102d62]">{title}</h3>
          </div>
          <p className="text-slate-500 font-medium leading-relaxed mb-8">{message}</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95 ${type === 'danger' ? 'bg-red-500 hover:bg-red-600' :
                type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                  'bg-[#102d62] hover:bg-blue-900'
                }`}
            >
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Skeleton Card ---
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`bg-slate-100 animate-pulse rounded-3xl ${className}`}></div>
);

// --- Activity Item ---
export const ActivityItem: React.FC<{ type: 'generator' | 'auditor'; title: string; subtitle: string; time: any }> = ({ type, title, subtitle, time }) => {
  const date = time?.toDate ? time.toDate() : new Date(time);
  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors group">
      <div className="flex items-center gap-4">
        <div className={`p-2.5 rounded-xl ${type === 'generator' ? 'bg-blue-50 text-blue-600' : 'bg-cyan-50 text-cyan-600'} group-hover:scale-110 transition-transform`}>
          {type === 'generator' ? <PenTool size={18} /> : <Activity size={18} />}
        </div>
        <div>
          <h4 className="text-sm font-bold text-[#102d62] line-clamp-1">{title}</h4>
          <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
        </div>
      </div>
      <span className="text-[10px] font-black text-slate-300 uppercase">
        {date instanceof Date && !isNaN(date.getTime()) ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
      </span>
    </div>
  );
};

// --- Comment Section ---
export const CommentSection: React.FC<{ parentId: string; currentUser: User; onAddComment: (content: string) => Promise<any> }> = ({ parentId, currentUser, onAddComment }) => {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return db.collection('generations').doc(parentId).collection('comments').orderBy('timestamp', 'asc').onSnapshot(snap => {
      setComments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [parentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddComment(newComment);
      setNewComment('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 border-b border-slate-100 flex items-center gap-2">
        <MessageSquare size={18} className="text-[#01ccff]" />
        <h3 className="text-sm font-black text-[#102d62] uppercase tracking-widest">Feedback Workspace</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {comments.map((c, i) => (
          <div key={c.id || i} className="animate-in slide-in-from-right-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-slate-100 text-[#102d62] flex items-center justify-center text-[10px] font-black border border-slate-200 uppercase">{c.userName?.charAt(0)}</div>
              <span className="text-[11px] font-black text-[#102d62]">{c.userName}</span>
              <span className="text-[9px] font-bold text-slate-300 uppercase ml-auto">
                {c.timestamp?.toDate ? c.timestamp.toDate().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none border border-slate-100 text-xs text-slate-600 leading-relaxed font-medium">
              {c.content}
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10 opacity-50">
            <MessageSquare size={40} strokeWidth={1} className="mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest">No feedback yet</p>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="p-6 border-t border-slate-100 bg-slate-50/50">
        <div className="relative group">
          <textarea
            className="w-full p-4 pr-12 bg-white border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:ring-4 focus:ring-[#01ccff]/5 focus:border-[#01ccff]/30 transition-all shadow-sm resize-none custom-scrollbar"
            placeholder="Add internal feedback..."
            rows={2}
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="absolute right-3 bottom-3 p-2 bg-[#102d62] text-white rounded-xl hover:bg-blue-900 transition-all disabled:opacity-70"
          >
            {isSubmitting ? <PenTool size={14} className="animate-spin" /> : <Zap size={14} />}
          </button>
        </div>
      </form>
    </div>
  );
};

// --- KPI Stat Card ---
export const KPIStatCard: React.FC<{ label: string; value: string; subValue?: string; color?: string }> = ({ label, value, subValue, color = 'blue' }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
    <div className="text-2xl font-black text-[#102d62]">{value}</div>
    {subValue && <div className="text-[10px] font-bold text-slate-500 mt-1">{subValue}</div>}
  </div>
);

// --- Simple Bar Chart ---
export const SimpleBarChart: React.FC = () => (
  <div className="h-32 flex items-end gap-1 px-2">
    {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
      <div key={i} className="flex-1 bg-slate-200 rounded-t-sm hover:bg-[#01ccff] transition-colors" style={{ height: `${h}%` }}></div>
    ))}
  </div>
);
