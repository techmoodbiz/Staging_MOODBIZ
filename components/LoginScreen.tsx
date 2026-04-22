
import React, { useState } from 'react';
import { Sparkles, AlertTriangle, User as UserIcon, Lock, ArrowRight, Eye, EyeOff, Loader2, ShieldCheck, Zap, ChevronRight, Fingerprint } from 'lucide-react';
import { auth, db } from '../firebase';
import { User } from '../types';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  onShowForgotPassword: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onShowForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const fbUser = userCredential.user;

      if (!fbUser) throw new Error("No user returned");

      let userData: User = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || fbUser.email,
        role: 'viewer',
      };

      try {
        const docRef = db.collection('users').doc(fbUser.uid);
        const snap = await docRef.get();
        if (snap.exists) {
          userData = { ...userData, ...snap.data() as any };
        }
      } catch (innerErr) {
        console.error('Lỗi đọc user metadata từ Firestore', innerErr);
      }

      onLogin(userData);
    } catch (err: any) {
      console.error('Lỗi đăng nhập Firebase', err);
      setError('Thông tin đăng nhập không hợp lệ. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-[#f1f5f9] flex items-center justify-center p-6 font-sans overflow-hidden">

      {/* Background decoration - More subtle but defined */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-50/50 to-transparent pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-1/3 h-2/3 bg-gradient-to-tr from-cyan-50/30 to-transparent pointer-events-none"></div>

      <div className="w-full max-w-[460px] relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Main Login Card */}
        <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(16,45,98,0.15)] border border-slate-200 overflow-hidden">

          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#102d62] via-[#01ccff] to-[#102d62]"></div>

          <div className="p-10 md:p-12">
            {/* Header / Logo */}
            <div className="flex flex-col items-center mb-10">
              <div className="w-14 h-14 bg-[#102d62] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20 mb-6">
                <Fingerprint size={32} className="text-[#01ccff]" />
              </div>
              <h1 className="text-2xl font-black text-[#102d62] tracking-tight uppercase font-head">
                MOODBIZ <span className="text-[#01ccff]">PORTAL</span>
              </h1>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">
                Digital Growth Partnership
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-[12px] font-bold animate-in zoom-in-95">
                <AlertTriangle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Email công việc
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#102d62] transition-colors">
                    <UserIcon size={20} />
                  </div>
                  <input
                    type="email"
                    className="w-full pl-12 pr-4 h-14 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#102d62]/30 outline-none font-bold text-[#102d62] text-sm transition-all"
                    placeholder="example@moodbiz.vn"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Mật khẩu truy cập
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#102d62] transition-colors">
                    <Lock size={20} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full pl-12 pr-12 h-14 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-[#102d62]/30 outline-none font-bold text-[#102d62] text-sm transition-all"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-[#102d62] transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="flex justify-end px-1">
                  <button
                    type="button"
                    onClick={onShowForgotPassword}
                    className="text-[11px] font-black text-[#102d62]/60 hover:text-[#01ccff] uppercase tracking-wider transition-colors"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 bg-[#102d62] text-white rounded-xl font-black hover:bg-[#1a3e7d] active:scale-[0.98] transition-all shadow-lg shadow-blue-900/10 flex items-center justify-center gap-3 disabled:opacity-70 text-sm uppercase tracking-[0.1em]"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      Truy cập hệ thống <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </form>

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

export default LoginScreen;
