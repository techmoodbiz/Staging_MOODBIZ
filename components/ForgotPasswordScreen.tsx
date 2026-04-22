
import React, { useState } from 'react';
import { Mail, AlertTriangle, ArrowLeft, Loader2, ShieldCheck, Zap, Fingerprint, CheckCircle } from 'lucide-react';
import { auth } from '../firebase';

interface ForgotPasswordScreenProps {
    onBackToLogin: () => void;
}

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ onBackToLogin }) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        setIsLoading(true);

        try {
            await auth.sendPasswordResetEmail(email);
            setSuccess(true);
        } catch (err: any) {
            console.error('Lỗi gửi mail reset mật khẩu', err);
            if (err.code === 'auth/user-not-found') {
                setError('Email này chưa được đăng ký trong hệ thống.');
            } else if (err.code === 'auth/invalid-email') {
                setError('Định dạng email không hợp lệ.');
            } else {
                setError('Đã có lỗi xảy ra. Vui lòng thử lại sau.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-[#f1f5f9] flex items-center justify-center p-6 font-sans overflow-hidden">

            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-50/50 to-transparent pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-1/3 h-2/3 bg-gradient-to-tr from-cyan-50/30 to-transparent pointer-events-none"></div>

            <div className="w-full max-w-[460px] relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Main Card */}
                <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(16,45,98,0.15)] border border-slate-200 overflow-hidden">

                    {/* Top accent bar */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-[#102d62] via-[#01ccff] to-[#102d62]"></div>

                    <div className="p-10 md:p-12">
                        {/* Header / Logo */}
                        <div className="flex flex-col items-center mb-10">
                            <div className="w-14 h-14 bg-[#102d62] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20 mb-6 focus-within:ring-4 ring-blue-500/20 transition-all">
                                <Fingerprint size={32} className="text-[#01ccff]" />
                            </div>
                            <h1 className="text-2xl font-black text-[#102d62] tracking-tight uppercase font-head">
                                FORGOT <span className="text-[#01ccff]">PASSWORD</span>
                            </h1>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">
                                Digital Growth Partnership
                            </p>
                        </div>

                        {/* Success Message */}
                        {success ? (
                            <div className="space-y-8 animate-in zoom-in-95">
                                <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex flex-col items-center text-center gap-4">
                                    <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                        <CheckCircle size={24} />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-emerald-900 font-black uppercase text-sm tracking-wider">Gửi thành công!</h3>
                                        <p className="text-emerald-700/70 text-[12px] font-bold leading-relaxed px-4">
                                            Vui lòng kiểm tra hộp thư đến của email <span className="text-emerald-900 font-black">{email}</span> để thực hiện đặt lại mật khẩu.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={onBackToLogin}
                                    className="w-full h-14 bg-[#102d62] text-white rounded-xl font-black hover:bg-[#1a3e7d] active:scale-[0.98] transition-all shadow-lg shadow-blue-900/10 flex items-center justify-center gap-3 text-sm uppercase tracking-[0.1em]"
                                >
                                    <ArrowLeft size={18} /> Quay lại Đăng nhập
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Info text */}
                                <p className="text-slate-500 text-[13px] font-bold leading-relaxed text-center mb-8 px-4">
                                    Nhập email của bạn để nhận hướng dẫn khôi phục mật khẩu truy cập hệ thống.
                                </p>

                                {/* Error Message */}
                                {error && (
                                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-[12px] font-bold animate-in zoom-in-95">
                                        <AlertTriangle size={18} className="shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Forgot Password Form */}
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-2.5">
                                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                            Email công việc
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#102d62] transition-colors">
                                                <Mail size={20} />
                                            </div>
                                            <input
                                                type="email"
                                                className="w-full pl-12 pr-4 h-14 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#102d62]/30 outline-none font-bold text-[#102d62] text-sm transition-all"
                                                placeholder="example@moodbiz.vn"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                required
                                                disabled={isLoading}
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-2 space-y-4">
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full h-14 bg-[#102d62] text-white rounded-xl font-black hover:bg-[#1a3e7d] active:scale-[0.98] transition-all shadow-lg shadow-blue-900/10 flex items-center justify-center gap-3 disabled:opacity-70 text-sm uppercase tracking-[0.1em]"
                                        >
                                            {isLoading ? (
                                                <Loader2 className="animate-spin" size={20} />
                                            ) : (
                                                <>
                                                    Gửi yêu cầu reset <Zap size={18} className="fill-white" />
                                                </>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={onBackToLogin}
                                            disabled={isLoading}
                                            className="w-full h-14 bg-white text-slate-500 border border-slate-200 rounded-xl font-black hover:bg-slate-50 hover:text-[#102d62] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-[0.1em]"
                                        >
                                            <ArrowLeft size={18} /> Quay lại Đăng nhập
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}

                        {/* Bottom info */}
                        <div className="mt-10 pt-8 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                <ShieldCheck size={14} className="text-emerald-500" /> Secure SSL
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                <Zap size={14} className="text-[#01ccff]" /> Gen-AI v2.0
                            </div>
                        </div>
                    </div>
                </div>

                <p className="mt-8 text-center text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    Copyright © 2024 MOODBIZ TECHNOLOGY
                </p>
            </div>
        </div>
    );
};

export default ForgotPasswordScreen;
