import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { X, CheckCircle, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { auth, db } from './firebase';
import LoginScreen from './components/LoginScreen';
import ForgotPasswordScreen from './components/ForgotPasswordScreen';
import ResetPasswordScreen from './components/ResetPasswordScreen';
import MainLayout from './MainLayout';
import BrandModal from './components/BrandModal';
import UserModal from './components/UserModal';
import { ConfirmationModal } from './components/UIComponents';
import { User, Brand, Generation, Auditor, Guideline, SystemPrompts, AuditRule } from './types';
import { GEN_PROMPTS_DEFAULTS, AUDIT_PROMPTS_DEFAULTS } from './constants';
import { createUserApi, deleteUserApi } from './services/api';

// TABS
import DashboardTab from './components/tabs/DashboardTab';
import GeneratorTab from './components/tabs/GeneratorTab';
import AuditorTab from './components/tabs/AuditorTab';
import HistoryGenerationsTab from './components/tabs/HistoryGenerationsTab';
import HistoryAuditsTab from './components/tabs/HistoryAuditsTab';
import AnalyticsTab from './components/tabs/AnalyticsTab';
import UsersTab from './components/tabs/UsersTab';
import BrandsTab from './components/tabs/BrandsTab';
import GuidelinesTab from './components/tabs/GuidelinesTab';
import SettingsTab from './components/tabs/SettingsTab';
import ProductsTab from './components/tabs/ProductsTab';
import PersonasTab from './components/tabs/PersonasTab';
import ResearchTab from './components/tabs/ResearchTab';
import MarketsTab from './components/tabs/MarketsTab';
import SeoUrlInspectorTab from './components/tabs/SeoUrlInspectorTab';
import RankCheckerTab from './components/tabs/RankCheckerTab';
import firebase from './firebase';

const App = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'forgot-password' | 'reset-password'>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'resetPassword' && params.get('oobCode')) {
      return 'reset-password';
    }
    return 'login';
  });
  const [oobCode, setOobCode] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('oobCode');
  });

  // Centralized State for Auditor & Generator (Keyed by Brand ID)
  const [persistentTabStates, setPersistentTabStates] = useState<Record<string, any>>(() => {
    const saved = localStorage.getItem('moodbiz_tab_states');
    return saved ? JSON.parse(saved) : {};
  });

  const updatePersistentTabState = (brandId: string, tab: 'auditor' | 'generator', data: any) => {
    if (!brandId) return;
    setPersistentTabStates(prev => {
      const brandKey = `brand_${brandId}`;
      const newState = {
        ...prev,
        [brandKey]: {
          ...(prev[brandKey] || {}),
          [tab]: {
            ...((prev[brandKey] && prev[brandKey][tab]) || {}),
            ...data
          }
        }
      };
      localStorage.setItem('moodbiz_tab_states', JSON.stringify(newState));
      return newState;
    });
  };

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'danger' as 'danger' | 'warning' | 'info'
  });

  const [systemPrompts, setSystemPrompts] = useState<SystemPrompts>(() => {
    const saved = localStorage.getItem('moodbiz_prompts');
    let initial = { generator: GEN_PROMPTS_DEFAULTS, auditor: AUDIT_PROMPTS_DEFAULTS };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        initial = {
          generator: { ...GEN_PROMPTS_DEFAULTS, ...(parsed.generator || {}) },
          auditor: { ...AUDIT_PROMPTS_DEFAULTS, ...(parsed.auditor || {}) }
        };
      } catch (e) {
        console.error("Error parsing saved prompts, resetting to defaults", e);
      }
    }
    return initial;
  });

  useEffect(() => {
    localStorage.setItem('moodbiz_prompts', JSON.stringify(systemPrompts));
  }, [systemPrompts]);

  // DATA
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoaded, setBrandsLoaded] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [auditRules, setAuditRules] = useState<AuditRule[]>([]);

  // MODALS
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' = 'danger') => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, type });
  };

  useEffect(() => {
    let unsubscribeUserDoc: () => void;

    const unsubscribeAuth = auth.onAuthStateChanged(async (fbUser) => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }

      if (fbUser) {
        // Clear all states on fresh session login
        if (!sessionStorage.getItem('moodbiz_session_active')) {
          setPersistentTabStates({});
          localStorage.removeItem('moodbiz_tab_states');
          localStorage.removeItem('moodbiz_selected_brand_id');
          setSelectedBrandId('');
          sessionStorage.setItem('moodbiz_session_active', 'true');
        }

        const initialUser: User = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || fbUser.email,
          role: 'viewer'
        };

        unsubscribeUserDoc = db.collection('users').doc(fbUser.uid).onSnapshot(
          (doc) => {
            if (doc.exists) {
              const data = doc.data();
              setCurrentUser({
                ...initialUser,
                ...data
              } as User);
            } else {
              setCurrentUser(initialUser);
            }
            setAuthReady(true);
          },
          (err) => {
            console.error("User doc listen error", err);
            setCurrentUser(initialUser);
            setAuthReady(true);
          }
        );

      } else {
        setCurrentUser(null);
        setAuthReady(true);
        // Only default to login if not in reset-password flow
        setAuthView(prev => prev === 'reset-password' ? 'reset-password' : 'login');
        sessionStorage.removeItem('moodbiz_session_active');
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const unsubRules = db.collection("audit_rules").onSnapshot(snap => {
      setAuditRules(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditRule)));
    });

    const unsubBrands = db.collection("brands").onSnapshot(snapshot => {
      setBrands(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)));
      setBrandsLoaded(true);
    });

    return () => {
      unsubRules();
      unsubBrands();
    }
  }, [currentUser]);

  // --- FETCH GENERATIONS HISTORY ---
  useEffect(() => {
    if (!currentUser) return;

    let qGen: firebase.firestore.Query<firebase.firestore.DocumentData>;

    if (currentUser.role === 'content_creator') {
      // Content Creator: Only query own history (Indexed Query)
      qGen = db.collection('generations').where('user_id', '==', currentUser.uid);
    } else {
      // Admin & Brand Owner: Query all (Sorted)
      qGen = db.collection('generations').orderBy('timestamp', 'desc');
    }

    const unsub = qGen.onSnapshot(snap => {
      let docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Generation));

      // Brand Owner: Filter specifically for owned brands
      if (currentUser.role === 'brand_owner') {
        const ownedIds = currentUser.ownedBrandIds || [];
        docs = docs.filter(g => ownedIds.includes(g.brand_id));
      }

      // Content Creator: Client-side Sort (Since simple 'where' query returns unordered)
      if (currentUser.role === 'content_creator') {
        docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      }

      setGenerations(docs);
    }, err => {
      console.error("Gen fetch error", err);
    });

    return () => unsub();
  }, [currentUser]);

  // --- FETCH AUDITORS HISTORY ---
  useEffect(() => {
    if (!currentUser) return;

    let qAudit: firebase.firestore.Query<firebase.firestore.DocumentData>;

    if (currentUser.role === 'content_creator') {
      qAudit = db.collection('auditors').where('user_id', '==', currentUser.uid);
    } else {
      qAudit = db.collection("auditors").orderBy("timestamp", "desc");
    }

    const unsub = qAudit.onSnapshot(snap => {
      let docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Auditor));

      if (currentUser.role === 'brand_owner') {
        const ownedIds = currentUser.ownedBrandIds || [];
        docs = docs.filter(a => ownedIds.includes(a.brand_id));
      }

      if (currentUser.role === 'content_creator') {
        docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      }

      setAuditors(docs);
    }, err => {
      console.error("Audit fetch error", err);
    });

    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    return db.collection("brand_guidelines").orderBy("created_at", "desc").onSnapshot(snap => {
      setGuidelines(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guideline)));
    });
  }, [currentUser]);

  // --- FETCH USERS (Restricted to Admin & Brand Owner) ---
  useEffect(() => {
    // SECURITY FIX: Content Creator causes Permission Denied if querying full user list
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'brand_owner')) {
      setUsers([]);
      return;
    }

    const unsubUsers = db.collection("users").onSnapshot(snap => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    }, err => {
      console.error("User list fetch error", err);
    });

    return () => {
      unsubUsers();
    };
  }, [currentUser]);

  const availableBrands = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return brands;
    if (currentUser.role === 'brand_owner') return brands.filter(b => currentUser.ownedBrandIds?.includes(b.id));
    if (currentUser.role === 'content_creator') return brands.filter(b => currentUser.assignedBrandIds?.includes(b.id));
    return [];
  }, [currentUser, brands]);

  const [selectedBrandId, setSelectedBrandId] = useState(() => {
    return localStorage.getItem('moodbiz_selected_brand_id') || '';
  });

  useEffect(() => {
    if (selectedBrandId) localStorage.setItem('moodbiz_selected_brand_id', selectedBrandId);
  }, [selectedBrandId]);

  useEffect(() => {
    if (availableBrands.length > 0 && !selectedBrandId) setSelectedBrandId(availableBrands[0].id);
  }, [availableBrands, selectedBrandId]);

  const handleSaveUser = async (data: any) => {
    try {
      if (editingUser) {
        await db.collection("users").doc(editingUser.id).update(data);
        setToast({ type: 'success', message: 'Cập nhật thành công' });
      } else {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("No auth token");

        // Call API and capture response
        const response = await createUserApi(data, token);

        // Handle Fallback if SMTP failed (Manual Link)
        if (response.verificationLink && (!response.message.includes('sent') || response.message.includes('skipped'))) {
          // Hiển thị prompt để Admin copy link ngay lập tức
          window.prompt("Đã tạo User! Do chưa cấu hình SMTP, vui lòng COPY link xác thực dưới đây gửi cho user:", response.verificationLink);
          setToast({ type: 'success', message: 'Tạo tài khoản thành công (Manual Verify)' });
        } else {
          setToast({ type: 'success', message: 'Tạo tài khoản & gửi email thành công' });
        }
      }
      setIsUserModalOpen(false);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi lưu user' });
    }
  };

  const handleDeleteUser = async (id: string) => {
    showConfirm("Xóa người dùng", "Hành động này sẽ xóa vĩnh viễn tài khoản khỏi hệ thống.", async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Authentication required");

        await deleteUserApi(id, token);
        setToast({ type: 'success', message: 'Đã xóa người dùng và tài khoản đăng nhập' });
      } catch (err: any) {
        setToast({ type: 'error', message: 'Lỗi khi xóa: ' + err.message });
      }
    });
  };

  const handleDeleteBrand = async (id: string) => {
    showConfirm("Xóa thương hiệu", "Xác nhận xóa thương hiệu này và toàn bộ dữ liệu liên quan?", async () => {
      try {
        await db.collection("brands").doc(id).delete();
        setToast({ type: 'success', message: 'Đã xóa thương hiệu' });
      } catch (err: any) {
        setToast({ type: 'error', message: 'Lỗi khi xóa: ' + err.message });
      }
    });
  };

  if (!authReady) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan/5 rounded-full blur-[120px] -mr-96 -mt-96 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px] -ml-72 -mb-72" />

        <div className="relative flex flex-col items-center gap-10 animate-in">
          <div className="w-24 h-24 rounded-[2.5rem] bg-navy flex items-center justify-center shadow-glow animate-float">
            <h1 className="text-3xl font-black text-white tracking-widest">M<span className="text-cyan">A</span></h1>
          </div>
          <div className="space-y-4 text-center">
            <h2 className="text-xl font-black text-navy uppercase tracking-[0.3em]">Initializing Core</h2>
            <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden relative mx-auto">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan to-blue-600 animate-[loading_2s_infinite]" />
            </div>
          </div>
        </div>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  if (!currentUser) {
    if (authView === 'reset-password' && oobCode) {
      return <ResetPasswordScreen oobCode={oobCode} onBackToLogin={() => setAuthView('login')} />;
    }
    if (authView === 'forgot-password') {
      return <ForgotPasswordScreen onBackToLogin={() => setAuthView('login')} />;
    }
    return <LoginScreen
      onLogin={(user) => {
        setCurrentUser(user);
        window.location.hash = '#/dashboard';
      }}
      onShowForgotPassword={() => setAuthView('forgot-password')}
    />;
  }

  // Access Check Helper
  const hasAccess = (roles?: string[]) => {
    if (!roles) return true;
    return roles.includes(currentUser.role);
  };

  // Restricted Access Screen Component
  const RestrictedAccess = () => (
    <div className="flex flex-col items-center justify-center h-[70vh] animate-in slide-in-from-bottom-5">
      <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner-soft shadow-glow-hover transform transition-transform hover:scale-110">
        <ShieldAlert size={48} strokeWidth={1.5} />
      </div>
      <h2 className="text-3xl font-black text-navy uppercase mb-3 tracking-tighter italic">Access Restricted</h2>
      <p className="text-slate-400 font-bold text-center max-w-sm uppercase text-[10px] tracking-[0.2em] leading-relaxed opacity-60">Neural clearance level insufficient. Protocol denied for your current role signature.</p>
    </div>
  );

  return (
    <HashRouter>
      {/* Shared Modals */}
      <BrandModal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
        brand={editingBrand}
        currentUser={currentUser}
        setToast={setToast}
      />
      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        user={editingUser}
        brands={availableBrands}
        currentUserRole={currentUser.role}
        onSave={handleSaveUser}
      />
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        type={confirmModal.type}
      />

      {/* Global Notifications (Toast) */}
      {toast && (
        <div className={`fixed bottom-12 right-12 z-[1000] px-10 py-6 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] backdrop-blur-3xl animate-in slide-in-from-right-10 flex items-center gap-6 border-none ring-1 ring-white/20 ${toast.type === 'success' ? 'bg-navy/95 text-white' : toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-navy/95 text-white'}`}>
          <div className={`p-2.5 rounded-xl ${toast.type === 'success' ? 'bg-cyan text-white shadow-glow' : toast.type === 'error' ? 'bg-white/10 text-white' : 'bg-cyan text-white'}`}>
            {toast.type === 'success' ? <CheckCircle size={22} strokeWidth={2.5} /> : <AlertTriangle size={22} strokeWidth={2.5} />}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1 leading-none">{toast.type} Node</span>
            <span className="text-[13px] font-black tracking-tight uppercase">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="ml-4 p-2 hover:bg-white/10 rounded-lg transition-colors border border-white/10"><X size={18} /></button>
        </div>
      )}

      <Routes>
        <Route path="/" element={<MainLayout currentUser={currentUser} setToast={setToast} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={
            <DashboardTab currentUser={currentUser} showLoading={!brandsLoaded} availableBrands={availableBrands} generations={generations} auditors={auditors} />
          } />
          <Route path="generator" element={
            hasAccess(['admin', 'brand_owner', 'content_creator']) ?
              <GeneratorTab
                availableBrands={availableBrands}
                selectedBrandId={selectedBrandId}
                setSelectedBrandId={setSelectedBrandId}
                systemPrompts={systemPrompts}
                currentUser={currentUser}
                setToast={setToast}
                auditors={auditors}
                guidelines={guidelines}
                persistentState={persistentTabStates[`brand_${selectedBrandId}`]?.generator || {}}
                updatePersistentState={(data: any) => updatePersistentTabState(selectedBrandId, 'generator', data)}
              />
              : <RestrictedAccess />
          } />
          <Route path="research" element={
            hasAccess(['admin', 'brand_owner', 'content_creator']) ?
              <ResearchTab
                currentUser={currentUser}
                setToast={setToast}
              />
              : <RestrictedAccess />
          } />
          <Route path="auditor" element={
            hasAccess(['admin', 'brand_owner', 'content_creator']) ?
              <AuditorTab
                availableBrands={availableBrands}
                selectedBrandId={selectedBrandId}
                setSelectedBrandId={setSelectedBrandId}
                systemPrompts={systemPrompts}
                currentUser={currentUser}
                setToast={setToast}
                guidelines={guidelines}
                auditors={auditors}
                auditRules={auditRules}
                persistentState={persistentTabStates[`brand_${selectedBrandId}`]?.auditor || {}}
                updatePersistentState={(data: any) => updatePersistentTabState(selectedBrandId, 'auditor', data)}
              />
              : <RestrictedAccess />
          } />
          <Route path="generations" element={
            <HistoryGenerationsTab generations={generations} brands={brands} availableBrands={availableBrands} setToast={setToast} currentUser={currentUser} systemPrompts={systemPrompts} auditors={auditors} guidelines={guidelines} auditRules={auditRules} />
          } />
          <Route path="audits" element={
            <HistoryAuditsTab auditors={auditors} brands={brands} availableBrands={availableBrands} />
          } />
          <Route path="analytics" element={
            hasAccess(['admin', 'brand_owner', 'content_creator']) ?
              <AnalyticsTab
                availableBrands={availableBrands}
                auditors={auditors}
                selectedBrandId={selectedBrandId}
                setSelectedBrandId={setSelectedBrandId}
              />
              : <RestrictedAccess />
          } />
          <Route path="users" element={
            hasAccess(['admin', 'brand_owner']) ?
              <UsersTab users={users} brands={availableBrands} currentUser={currentUser} setEditingUser={setEditingUser} setIsUserModalOpen={setIsUserModalOpen} handleDeleteUser={handleDeleteUser} />
              : <RestrictedAccess />
          } />
          <Route path="brands" element={
            hasAccess(['admin', 'brand_owner']) ?
              <BrandsTab availableBrands={availableBrands} currentUser={currentUser} setEditingBrand={setEditingBrand} setIsBrandModalOpen={setIsBrandModalOpen} handleDeleteBrand={handleDeleteBrand} />
              : <RestrictedAccess />
          } />
          <Route path="guidelines" element={
            hasAccess(['admin', 'brand_owner', 'content_creator']) ?
              <GuidelinesTab
                guidelines={guidelines}
                availableBrands={availableBrands}
                currentUser={currentUser}
                setToast={setToast}
                showConfirm={showConfirm}
              />
              : <RestrictedAccess />
          } />
          <Route path="settings" element={
            hasAccess(['admin']) ?
              <SettingsTab systemPrompts={systemPrompts} setSystemPrompts={setSystemPrompts} showConfirm={showConfirm} setToast={setToast} auditRules={auditRules} />
              : <RestrictedAccess />
          } />
          <Route path="products" element={
            hasAccess(['admin', 'brand_owner', 'content_creator']) ?
              <ProductsTab availableBrands={availableBrands} selectedBrandId={selectedBrandId} setSelectedBrandId={setSelectedBrandId} currentUser={currentUser} />
              : <RestrictedAccess />
          } />
          <Route path="markets" element={
            hasAccess(['admin', 'brand_owner', 'content_creator']) ?
              <MarketsTab availableBrands={availableBrands} selectedBrandId={selectedBrandId} setSelectedBrandId={setSelectedBrandId} currentUser={currentUser} />
              : <RestrictedAccess />
          } />
          <Route path="personas" element={
            hasAccess(['admin', 'brand_owner', 'content_creator']) ?
              <PersonasTab availableBrands={availableBrands} selectedBrandId={selectedBrandId} setSelectedBrandId={setSelectedBrandId} currentUser={currentUser} />
              : <RestrictedAccess />
          } />
          <Route path="seo-inspector" element={
            hasAccess(['admin', 'brand_owner', 'content_creator']) ?
              <SeoUrlInspectorTab currentUser={currentUser} />
              : <RestrictedAccess />
          } />
          <Route path="rank-checker" element={
            hasAccess(['admin', 'brand_owner']) ?
              <RankCheckerTab
                currentUser={currentUser}
                availableBrands={availableBrands}
                selectedBrandId={selectedBrandId}
                setSelectedBrandId={setSelectedBrandId}
                setToast={setToast}
                setEditingBrand={setEditingBrand}
                setIsBrandModalOpen={setIsBrandModalOpen}
                handleDeleteBrand={handleDeleteBrand}
              />
              : <RestrictedAccess />
          } />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;