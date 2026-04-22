import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { LogOut, Lock, Save, X, Loader2 } from 'lucide-react';
import { auth } from './firebase';
import { User } from './types';
import { NAV_ITEMS } from './constants';
import { MenuToggle } from './components/UIComponents';
import LanguageSelector from './components/LanguageSelector';
import { useTranslation } from 'react-i18next';

interface MainLayoutProps {
    currentUser: User;
    setToast: (toast: any) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ currentUser, setToast }) => {
    const location = useLocation();
    const { t } = useTranslation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to top on route change
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo(0, 0);
        }
    }, [location.pathname]);

    // Change Password State
    const [isChangePassModalOpen, setIsChangePassModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            setToast({ type: 'error', message: 'Mật khẩu xác nhận không trùng khớp' });
            return;
        }
        if (newPassword.length < 6) {
            setToast({ type: 'error', message: 'Mật khẩu phải từ 6 ký tự trở lên' });
            return;
        }

        setIsChangingPassword(true);
        try {
            await auth.currentUser?.updatePassword(newPassword);
            setToast({ type: 'success', message: t('common.password_success', 'Đổi mật khẩu thành công!') });
            setIsChangePassModalOpen(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            if (err.code === 'auth/requires-recent-login') {
                setToast({ type: 'error', message: t('common.session_expired', 'Phiên đăng nhập hết hạn. Vui lòng đăng xuất và đăng nhập lại để đổi mật khẩu.') });
            } else {
                setToast({ type: 'error', message: t('common.error', 'Lỗi: ') + err.message });
            }
        } finally {
            setIsChangingPassword(false);
        }
    };

    const hasAccess = (roles?: string[]) => {
        if (!roles) return true;
        return roles.includes(currentUser.role);
    };

    return (
        <div className="h-screen bg-[#fcfdfe] flex overflow-hidden relative font-sans selection:bg-cyan/10 selection:text-cyan">
            {/* Ambient Background Glows - Reduced Opacity for darker Navy feel */}
            <div className="fixed top-0 right-0 w-[1000px] h-[1000px] bg-cyan/2 rounded-full blur-[150px] -mr-[400px] -mt-[400px] pointer-events-none z-0 animate-pulse transition-all duration-[5000ms]" />
            <div className="fixed bottom-0 left-0 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[120px] -ml-[300px] -mb-[300px] pointer-events-none z-0" />

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-navy/60 backdrop-blur-xl z-[45] md:hidden transition-all duration-500"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Actual Sidebar Navigation */}
            <aside className={`
                w-72 bg-navy text-white flex flex-col shrink-0 border-r border-white/5
                fixed inset-y-0 left-0 z-50
                transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                shadow-[10px_0_60px_-15px_rgba(0,0,0,0.3)]
            `}>
                <div className="p-10 border-b border-white/5 shrink-0 flex items-center justify-between">
                    <h1 className="text-2xl font-black tracking-tighter uppercase flex items-center gap-2 group cursor-default">
                        MOODBIZ <span className="text-cyan drop-shadow-glow group-hover:drop-shadow-[0_0_15px_rgba(14,165,233,0.8)] transition-all duration-500">AI</span>
                    </h1>
                    <div className="w-2 h-2 rounded-full bg-cyan shadow-glow animate-pulse" />
                </div>

                <nav className="flex-1 p-8 space-y-2 overflow-y-auto custom-scrollbar relative z-10">
                    <div className="absolute top-0 right-0 w-32 h-64 bg-cyan/5 blur-3xl rounded-full pointer-events-none" />

                    {NAV_ITEMS.map((item: any, idx) => {
                        if (item.type === 'header') {
                            if (item.roles && !hasAccess(item.roles)) return null;
                            return <div key={idx} className="px-5 pt-10 pb-4 text-[10px] font-black uppercase text-white/20 tracking-[0.3em]">{t(`nav.${item.id || item.label.toLowerCase()}`)}</div>;
                        }
                        if (item.roles && !hasAccess(item.roles)) return null;
                        const Icon = item.icon!;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.id}
                                to={item.path!}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`
                                    w-full flex items-center gap-4 px-5 py-4 rounded-[1.25rem] transition-all duration-500 group relative overflow-hidden border
                                    ${isActive
                                        ? 'bg-white/10 border-white/20 text-white font-black shadow-glow translate-x-2 backdrop-blur-md'
                                        : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-2'}
                                `}
                            >
                                {isActive && (
                                    <>
                                        <div className="absolute inset-0 bg-white/5 skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan rounded-r-full shadow-[0_0_10px_rgba(14,165,233,0.8)]" />
                                    </>
                                )}
                                <Icon size={20} className={`${isActive ? 'opacity-100 scale-110 text-cyan' : 'opacity-60 group-hover:opacity-100 group-hover:scale-110'} transition-all duration-500`} />
                                <span className={`text-[13px] uppercase tracking-widest font-black ${isActive ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}>{t(`nav.${item.id}`)}</span>
                            </Link>
                        );
                    })}

                    <div className="pt-20 mt-auto space-y-3">
                        <button
                            onClick={() => setIsChangePassModalOpen(true)}
                            className="w-full flex items-center gap-4 px-5 py-4 rounded-[1.25rem] text-white/30 hover:bg-white/[0.03] hover:text-white transition-all duration-500 text-[11px] font-black uppercase tracking-widest group"
                        >
                            <Lock size={18} className="opacity-40 group-hover:opacity-100 group-hover:text-cyan transition-all" />
                            <span>{t('common.change_password')}</span>
                        </button>
                        <button
                            onClick={() => {
                                auth.signOut();
                                localStorage.removeItem('moodbiz_selected_brand_id');
                                localStorage.removeItem('moodbiz_tab_states');
                                sessionStorage.removeItem('moodbiz_session_active');
                                window.location.hash = '#/';
                            }}
                            className="w-full flex items-center gap-4 px-5 py-4 rounded-[1.25rem] text-rose-400/50 hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-500 text-[11px] font-black uppercase tracking-widest group"
                        >
                            <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
                            <span>{t('common.logout')}</span>
                        </button>
                    </div>
                </nav>

                <div className="p-8 border-t border-white/5 bg-white/[0.02] flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-cyan/10 border border-cyan/20 flex items-center justify-center text-cyan font-black text-xs shadow-glow">
                        {(currentUser.name || currentUser.displayName || currentUser.email || 'U').substring(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-widest truncate">{currentUser.name || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Unknown')}</p>
                        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1">{currentUser.role.replace('_', ' ')}</p>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full min-w-0 bg-[#f8f9fa] relative z-10 md:ml-72 transition-all duration-500">
                {/* Mobile Header */}
                <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100/50 px-8 py-5 flex items-center justify-between md:hidden shrink-0 z-20">
                    <MenuToggle isOpen={isSidebarOpen} toggle={() => setIsSidebarOpen(!isSidebarOpen)} />
                    <div className="flex items-center gap-4">
                        <LanguageSelector />
                        <div className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center text-[10px] font-black uppercase shadow-glow">
                            {(currentUser.name || currentUser.displayName || currentUser.email || 'U').substring(0, 1).toUpperCase()}
                        </div>
                    </div>
                </header>

                {/* Global Top Right Actions - Hidden on mobile, moved to mobile header */}
                <div className="fixed top-4 right-12 z-[60] hidden md:flex items-center gap-4">
                    <LanguageSelector />
                </div>

                {/* Scrollable Content */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto custom-scrollbar bg-transparent scroll-smooth"
                >
                    <div className="p-8 pb-12 md:p-10 md:pb-12 lg:pt-14 lg:px-12 lg:pb-12 max-w-[1800px] mx-auto w-full">
                        <Outlet />
                    </div>
                </div>
            </main>

            {/* Change Password Modal */}
            {isChangePassModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/80 backdrop-blur-md p-6 animate-in fade-in duration-500">
                    <div className="bg-white w-full max-w-lg rounded-[4rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20">
                        <div className="px-12 py-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-navy text-white rounded-[1.5rem] shadow-glow transform -rotate-6 transition-transform hover:rotate-0 duration-500">
                                    <Lock size={28} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-navy tracking-tighter uppercase leading-none">{t('common.security_access')}</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-2">{t('common.change_password')}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsChangePassModalOpen(false)}
                                className="p-4 hover:bg-rose-50 rounded-[1.5rem] text-slate-300 hover:text-rose-500 transition-all active:scale-95"
                            >
                                <X size={32} />
                            </button>
                        </div>

                        <div className="p-12 space-y-10">
                            <div className="space-y-8">
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">{t('common.new_password')}</label>
                                    <div className="relative group/input">
                                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-cyan transition-colors">
                                            <Lock size={20} />
                                        </div>
                                        <input
                                            type="password"
                                            className="w-full pl-16 pr-8 py-5 bg-slate-50 border-none rounded-[1.75rem] text-sm font-black text-navy outline-none focus:ring-8 focus:ring-cyan/5 transition-all shadow-inner-soft placeholder:text-slate-200"
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder="••••••••••••"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">{t('common.confirm_password')}</label>
                                    <div className="relative group/input">
                                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-cyan transition-colors">
                                            <Lock size={20} />
                                        </div>
                                        <input
                                            type="password"
                                            className="w-full pl-16 pr-8 py-5 bg-slate-50 border-none rounded-[1.75rem] text-sm font-black text-navy outline-none focus:ring-8 focus:ring-cyan/5 transition-all shadow-inner-soft placeholder:text-slate-200"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-10 flex gap-4">
                                <button
                                    onClick={() => setIsChangePassModalOpen(false)}
                                    className="px-10 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-navy transition-all"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={handleChangePassword}
                                    disabled={isChangingPassword}
                                    className="flex-1 py-5 bg-navy text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 shadow-glow"
                                >
                                    {isChangingPassword ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} className="text-cyan shrink-0" />}
                                    {t('common.save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainLayout;
