import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, AlertTriangle, Link as LinkIcon, CheckCircle2, ShieldAlert, Code2, Copy, ExternalLink, RefreshCw, Zap, Link2, FileCode, TrendingUp, TrendingDown, ClipboardList, AlertCircle, XCircle } from 'lucide-react';
import SectionHeader from '../SectionHeader';
import { auth } from '../../firebase';
import type { User } from '../../types';

interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscDeviceRow {
  device: string;
  clicks: number;
  impressions: number;
}

interface DateRange {
  start: string;
  end: string;
}

interface DeltaMap {
  [key: string]: number | null | undefined;
}

interface TrendMap {
  [key: string]: 'up' | 'down' | 'flat' | 'insufficient_data' | undefined;
}

interface AnalyticsGroup<TCurrent> {
  current: TCurrent;
  previous: TCurrent;
  deltaPct: DeltaMap;
  trend: TrendMap;
}

interface AuditAction {
  priority: 'high' | 'medium' | 'low';
  key: string;
  title: string;
  why: string;
  action: string;
}

interface AiSummary {
  enabled: boolean;
  source: string;
  topPriorities: string[];
  expectedImpact: string;
  quickWins48h: string[];
}

interface AnalyticsData {
  compareWindow?: string;
  dateRanges?: {
    current: DateRange;
    previous: DateRange;
  };
  ga4?: AnalyticsGroup<{
    pageviews: number;
    totalUsers: number;
    sessions: number;
    engagementSeconds: number;
    eventCount: number;
  }>;
  gsc?: AnalyticsGroup<{
    clicks: number;
    impressions: number;
    ctr: number;
    avgPosition: number;
  }>;
  healthFlags?: string[];
  auditActions?: AuditAction[];
  aiSummary?: AiSummary;
  pageviews: number;
  totalUsers?: number;
  sessions?: number;
  engagementSeconds?: number;
  eventCount?: number;
  clicks: number;
  impressions: number;
  avgPosition: number;
  ctr?: number;
  topQueries?: GscQueryRow[];
  clicksByDevice?: GscDeviceRow[];
}

interface SiteInsightsPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
  previousClicks: number;
  deltaPctClicks: number | null;
}

interface SiteInsightsData {
  compareWindow?: string;
  dateRanges?: {
    current: DateRange;
    previous: DateRange;
  };
  gscSite?: {
    current: { clicks: number; impressions: number; ctr: number; avgPosition: number };
    previous: { clicks: number; impressions: number; ctr: number; avgPosition: number };
    deltaPct: DeltaMap;
  };
  ga4Site?: {
    current: { pageviews: number; totalUsers: number; sessions: number };
    previous: { pageviews: number; totalUsers: number; sessions: number };
    deltaPct: DeltaMap;
  };
  topPages?: SiteInsightsPageRow[];
  trendingUp?: SiteInsightsPageRow[];
  trendingDown?: SiteInsightsPageRow[];
  gscPropertyFound?: boolean;
  gscSiteUrl?: string;
  gscError?: string;
}

function formatGa4Engagement(seconds?: number): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0.5) return '—';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function isLikelyHomepage(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const path = u.pathname.replace(/\/$/, '') || '/';
    return path === '/' || path === '';
  } catch {
    return false;
  }
}

function formatDelta(delta?: number | null, reverseMeaning = false): { label: string; cls: string } {
  if (delta == null || Number.isNaN(delta)) return { label: 'N/A', cls: 'text-slate-400' };
  if (Math.abs(delta) < 0.01) return { label: '0%', cls: 'text-slate-400' };
  const isUp = delta > 0;
  const positive = reverseMeaning ? !isUp : isUp;
  return {
    label: `${isUp ? '+' : ''}${delta.toFixed(2)}%`,
    cls: positive ? 'text-emerald-600' : 'text-rose-600',
  };
}

function OwnerDeltaChip({
  label,
  deltaPct,
  valueLine,
  reverse,
}: {
  label: string;
  deltaPct?: number | null;
  valueLine?: string;
  reverse?: boolean;
}) {
  const { label: dLabel, cls } = formatDelta(deltaPct, reverse);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-inner-soft">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{label}</div>
      <div className={`text-xl font-black tabular-nums ${cls}`}>{dLabel}</div>
      {valueLine && <div className="text-[10px] text-slate-500 mt-1 font-medium">{valueLine}</div>}
    </div>
  );
}

interface SEOData {
  url: string;
  statusCode: number;
  title: string;
  metaDescription: string;
  h1: string;
  canonical: string;
  wordCount: number;
  indexability: string;
  rawProviderResponse?: any;
}

type CreatorCheckStatus = 'ok' | 'warn' | 'bad';

interface CreatorOnpageRow {
  key: string;
  label: string;
  status: CreatorCheckStatus;
  hint: string;
}

function buildCreatorOnpageChecks(seo: SEOData, t: (key: string) => string): CreatorOnpageRow[] {
  const out: CreatorOnpageRow[] = [];
  const title = (seo.title || '').trim();
  const titleLen = title.length;
  if (!title) {
    out.push({
      key: 'title',
      label: t('seo_inspector.creator_check_title'),
      status: 'bad',
      hint: t('seo_inspector.creator_hint_title_missing'),
    });
  } else if (titleLen < 15 || titleLen > 60) {
    out.push({
      key: 'title',
      label: t('seo_inspector.creator_check_title'),
      status: 'warn',
      hint: t('seo_inspector.creator_hint_title_length'),
    });
  } else {
    out.push({
      key: 'title',
      label: t('seo_inspector.creator_check_title'),
      status: 'ok',
      hint: t('seo_inspector.creator_hint_title_ok'),
    });
  }

  const meta = (seo.metaDescription || '').trim();
  const metaLen = meta.length;
  if (!meta) {
    out.push({
      key: 'meta',
      label: t('seo_inspector.creator_check_meta'),
      status: 'warn',
      hint: t('seo_inspector.creator_hint_meta_missing'),
    });
  } else if (metaLen > 160) {
    out.push({
      key: 'meta',
      label: t('seo_inspector.creator_check_meta'),
      status: 'warn',
      hint: t('seo_inspector.creator_hint_meta_long'),
    });
  } else if (metaLen < 70) {
    out.push({
      key: 'meta',
      label: t('seo_inspector.creator_check_meta'),
      status: 'warn',
      hint: t('seo_inspector.creator_hint_meta_short'),
    });
  } else {
    out.push({
      key: 'meta',
      label: t('seo_inspector.creator_check_meta'),
      status: 'ok',
      hint: t('seo_inspector.creator_hint_meta_ok'),
    });
  }

  const h1 = (seo.h1 || '').trim();
  if (!h1) {
    out.push({
      key: 'h1',
      label: t('seo_inspector.creator_check_h1'),
      status: 'bad',
      hint: t('seo_inspector.creator_hint_h1_missing'),
    });
  } else {
    out.push({
      key: 'h1',
      label: t('seo_inspector.creator_check_h1'),
      status: 'ok',
      hint: t('seo_inspector.creator_hint_h1_ok'),
    });
  }

  const canon = (seo.canonical || '').trim();
  if (!canon) {
    out.push({
      key: 'canonical',
      label: t('seo_inspector.creator_check_canonical'),
      status: 'warn',
      hint: t('seo_inspector.creator_hint_canon_missing'),
    });
  } else {
    try {
      const pageU = new URL(seo.url);
      const cU = new URL(canon);
      const norm = (u: URL) => `${u.origin}${(u.pathname.replace(/\/$/, '') || '/')}`;
      if (norm(pageU) !== norm(cU)) {
        out.push({
          key: 'canonical',
          label: t('seo_inspector.creator_check_canonical'),
          status: 'warn',
          hint: t('seo_inspector.creator_hint_canon_mismatch'),
        });
      } else {
        out.push({
          key: 'canonical',
          label: t('seo_inspector.creator_check_canonical'),
          status: 'ok',
          hint: t('seo_inspector.creator_hint_canon_ok'),
        });
      }
    } catch {
      out.push({
        key: 'canonical',
        label: t('seo_inspector.creator_check_canonical'),
        status: 'warn',
        hint: t('seo_inspector.creator_hint_canon_mismatch'),
      });
    }
  }

  const idx = (seo.indexability || '').toLowerCase();
  if (idx !== 'index') {
    out.push({
      key: 'index',
      label: t('seo_inspector.creator_check_index'),
      status: 'bad',
      hint: t('seo_inspector.creator_hint_index_bad'),
    });
  } else {
    out.push({
      key: 'index',
      label: t('seo_inspector.creator_check_index'),
      status: 'ok',
      hint: t('seo_inspector.creator_hint_index_ok'),
    });
  }

  const wc = seo.wordCount || 0;
  if (wc < 300) {
    out.push({
      key: 'words',
      label: t('seo_inspector.creator_check_words'),
      status: 'warn',
      hint: t('seo_inspector.creator_hint_words_low'),
    });
  } else {
    out.push({
      key: 'words',
      label: t('seo_inspector.creator_check_words'),
      status: 'ok',
      hint: t('seo_inspector.creator_hint_words_ok'),
    });
  }

  return out;
}

function healthFlagLabel(flag: string, t: (key: string) => string): string {
  const k = `seo_inspector.health_flag_${flag}`;
  const translated = t(k);
  return translated !== k ? translated : flag;
}

function AnalyticsPrioritySection({ data, t }: { data: AnalyticsData; t: (key: string) => string }) {
  return (
    <>
      {data.healthFlags && data.healthFlags.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">{t('seo_inspector.creator_signal_label')}</div>
          <div className="flex flex-wrap gap-2">
            {data.healthFlags.map((f) => (
              <span
                key={f}
                className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-navy"
                title={healthFlagLabel(f, t)}
              >
                {healthFlagLabel(f, t)}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.auditActions && data.auditActions.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 mb-4">{t('seo_inspector.audit_priorities')}</div>
          <div className="space-y-3">
            {data.auditActions.slice(0, 5).map((item, idx) => (
              <div key={`${item.key}-${idx}`} className="rounded-xl border border-amber-100 bg-white p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-bold text-navy">{item.title}</div>
                  <span className="text-[10px] uppercase tracking-wider font-black text-amber-700">{item.priority}</span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{t('seo_inspector.creator_why')}</p>
                <p className="text-sm text-slate-600">{item.why}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/80 mt-2 mb-0.5">{t('seo_inspector.creator_suggested_step')}</p>
                <p className="text-sm text-emerald-800 font-medium">{item.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.aiSummary && (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/40 p-5">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-700 mb-3">{t('seo_inspector.ai_audit_summary')}</div>
          {data.aiSummary.topPriorities && data.aiSummary.topPriorities.length > 0 && (
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700 mb-3">
              {data.aiSummary.topPriorities.slice(0, 5).map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          )}
          {data.aiSummary.expectedImpact && (
            <p className="text-sm text-slate-700 mb-2">
              <span className="font-bold text-navy">{t('seo_inspector.expected_impact')}: </span>
              {data.aiSummary.expectedImpact}
            </p>
          )}
          {data.aiSummary.quickWins48h && data.aiSummary.quickWins48h.length > 0 && (
            <p className="text-sm text-slate-700">
              <span className="font-bold text-navy">{t('seo_inspector.quick_wins_48h')}: </span>
              {data.aiSummary.quickWins48h.slice(0, 5).join(' · ')}
            </p>
          )}
        </div>
      )}
    </>
  );
}

const getEnvVar = (key: string) => {
  try {
    // @ts-ignore
    return import.meta?.env?.[key];
  } catch (e) {
    return undefined;
  }
};

const BASE_URL = getEnvVar('VITE_API_URL') || "https://staging-backend-one.vercel.app/api";

interface SeoUrlInspectorTabProps {
  currentUser?: User | null;
}

const SeoUrlInspectorTab: React.FC<SeoUrlInspectorTabProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const isBrandOwner = currentUser?.role === 'brand_owner';
  const isAdmin = currentUser?.role === 'admin';
  const isContentCreator = currentUser?.role === 'content_creator';
  const showCompactTrend = isAdmin || isBrandOwner;
  const showFullTechnical = !isBrandOwner || isAdmin;
  const [urlInput, setUrlInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [seoData, setSeoData] = useState<SEOData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [siteInsightsData, setSiteInsightsData] = useState<SiteInsightsData | null>(null);
  const [siteInsightsTab, setSiteInsightsTab] = useState<'top' | 'up' | 'down'>('top');
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSeoData(null);
    setShowRaw(false);

    if (!urlInput.trim()) {
      setErrorMsg('Vui lòng nhập URL cần phân tích.');
      return;
    }
    
    let targetUrl = urlInput.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl; // Mặc định thêm https
    }

    try {
      new URL(targetUrl);
    } catch {
      setErrorMsg('Định dạng URL không hợp lệ (ví dụ: https://moodbiz.com)');
      return;
    }

    setLoading(true);
    setUrlInput(targetUrl); // Cập nhật lại input với https

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Chưa xác thực người dùng. Vui lòng đăng nhập lại.");
      }

       // Thử gọi proxy trên cùng express backend hiện tại
      const res = await fetch(`${BASE_URL}/seo`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url: targetUrl, action: 'technical' })
      });

      const responseData = await res.json();

      if (!res.ok || !responseData.success) {
        throw new Error(responseData.error || 'Server error occurred during SEO analysis.');
      }

      setSeoData(responseData.data as SEOData);

      // --- PHASE 3: Site insights (homepage) + / or analytics ---
      setLoadingAnalytics(true);
      setAnalyticsData(null);
      setSiteInsightsData(null);
      setSiteInsightsTab('top');

      const isHomepage = isLikelyHomepage(targetUrl);
      const wantsSiteInsights = isHomepage && (isBrandOwner || isAdmin);
      const wantsAnalytics = !isBrandOwner || isAdmin || !isHomepage;

      try {
        if (wantsSiteInsights) {
          try {
            const insightsRes = await fetch(`${BASE_URL}/seo`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ url: targetUrl, action: 'site-insights' }),
            });
            const iData = await insightsRes.json();
            if (insightsRes.ok && iData.success) {
              setSiteInsightsData(iData.data as SiteInsightsData);
            }
          } catch (e) {
            console.warn('Failed to fetch site insights:', e);
          }
        }

        if (wantsAnalytics) {
          try {
            const analyticsRes = await fetch(`${BASE_URL}/seo`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ url: targetUrl, action: 'analytics' }),
            });

            const aData = await analyticsRes.json();
            if (analyticsRes.ok && aData.success) {
              setAnalyticsData(aData.data);
            }
          } catch (aErr) {
            console.warn('Failed to fetch analytics:', aErr);
          }
        }
      } finally {
        setLoadingAnalytics(false);
      }

    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi mạng khi gọi server API. Vui lòng kiểm tra lại cấu hình.');
    } finally {
      setLoadingAnalytics(false);
      setLoading(false);
    }
  };

  const handleCopyRaw = () => {
    if (seoData?.rawProviderResponse) {
        navigator.clipboard.writeText(JSON.stringify(seoData.rawProviderResponse, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-1000 space-y-8 pb-12">
      <SectionHeader 
        title={t('seo_inspector.title')} 
        subtitle={
          isAdmin
            ? t('seo_inspector.subtitle_admin')
            : isBrandOwner
              ? t('seo_inspector.subtitle_brand_owner')
              : isContentCreator
                ? t('seo_inspector.subtitle_creator')
                : t('seo_inspector.subtitle')
        } 
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column: Form & Guide */}
        <div className="lg:col-span-1 space-y-6">
             <div className="premium-card p-8 shadow-premium border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan/10 rounded-full blur-[40px] -mr-16 -mt-16 pointer-events-none group-hover:bg-cyan/20 transition-colors" />
                
                <h3 className="text-sm font-black text-navy uppercase tracking-[0.15em] mb-6 flex items-center gap-2">
                    <Search className="w-4 h-4 text-cyan" /> {t('seo_inspector.target_url')}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                    <div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-cyan transition-colors">
                                <LinkIcon size={18} strokeWidth={2.5} />
                            </div>
                            <input
                                type="text"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                placeholder={t('seo_inspector.placeholder_url')}
                                className="w-full pl-12 pr-4 py-4 bg-white/50 border border-slate-200 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/50 transition-all font-medium text-navy shadow-inner-soft placeholder:text-slate-300"
                                required
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 ml-2 font-medium italic">
                            {t('seo_inspector.calling_api')}
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-14 bg-navy hover:bg-cyan text-white rounded-[1.5rem] font-bold text-[13px] uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-3 shadow-glow hover:shadow-[0_0_30px_rgba(45,212,191,0.4)] disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>{t('seo_inspector.scanning')}</span>
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />
                                <span>{t('seo_inspector.analyze')}</span>
                            </>
                        )}
                    </button>
                </form>

                {errorMsg && (
                    <div className="mt-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-4 animate-in slide-in-from-bottom-2">
                        <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">{t('seo_inspector.analysis_failed')}</p>
                            <p className="text-sm text-rose-600/80 leading-relaxed font-medium">{errorMsg}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="premium-card p-6 border border-slate-200 shadow-soft bg-slate-50/50">
               <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                   <ShieldAlert className="w-4 h-4 text-slate-400" /> {t('seo_inspector.important_note')}
               </h4>
               {isAdmin ? (
                 <p className="text-[13px] text-slate-500 leading-relaxed">{t('seo_inspector.note_admin')}</p>
               ) : isBrandOwner ? (
                 <p className="text-[13px] text-slate-500 leading-relaxed">{t('seo_inspector.note_brand_owner_short')}</p>
               ) : isContentCreator ? (
                 <p className="text-[13px] text-slate-500 leading-relaxed">{t('seo_inspector.note_creator')}</p>
               ) : (
                 <>
                   <p className="text-[13px] text-slate-500 leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: `${t('seo_inspector.note_content_1')} <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">SEO_API_LOGIN</code> ${t('seo_inspector.note_content_2')} <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">PASSWORD</code>.` }} />
                   <p className="text-[13px] text-slate-500 leading-relaxed">
                       {t('seo_inspector.note_content_3')}
                   </p>
                 </>
               )}
            </div>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-2 space-y-6">
            {!seoData && !loading && (
                <div className="h-full min-h-[400px] rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                    <div className="w-20 h-20 bg-white rounded-full shadow-soft flex items-center justify-center mb-6">
                        <Search className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-navy mb-2">{t('seo_inspector.no_data')}</h3>
                    <p className="text-slate-400 max-w-sm leading-relaxed">{t('seo_inspector.no_data_desc')}</p>
                </div>
            )}

            {loading && (
                 <div className="h-full min-h-[400px] rounded-[2rem] border border-slate-100 shadow-soft flex flex-col items-center justify-center p-12 text-center bg-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 to-transparent pointer-events-none" />
                    <Loader2 className="w-12 h-12 text-cyan animate-spin mb-6 drop-shadow-glow" />
                    <h3 className="text-lg font-bold text-navy mb-2 uppercase tracking-wide">{t('seo_inspector.crawler_active')}</h3>
                    <p className="text-slate-400 max-w-xs text-sm leading-relaxed animate-pulse">{t('seo_inspector.crawler_desc')}</p>
                 </div>
            )}

            {seoData && !loading && showCompactTrend && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="premium-card p-6 border border-slate-200">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{t('seo_inspector.owner_url')}</div>
                                <p className="text-sm font-bold text-navy break-all leading-snug">{seoData.url}</p>
                            </div>
                            <a href={seoData.url} target="_blank" rel="noopener noreferrer" className="text-cyan hover:text-navy shrink-0 p-1" aria-label={t('seo_inspector.visit_url')}>
                                <ExternalLink className="w-5 h-5" />
                            </a>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center">
                                <div className="text-[9px] font-black uppercase text-slate-400">{t('seo_inspector.http_status')}</div>
                                <div className={`text-lg font-black ${seoData.statusCode >= 200 && seoData.statusCode < 300 ? 'text-emerald-600' : 'text-rose-600'}`}>{seoData.statusCode || '—'}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center">
                                <div className="text-[9px] font-black uppercase text-slate-400">{t('seo_inspector.indexability')}</div>
                                <div className="text-sm font-black text-navy capitalize truncate">{seoData.indexability || '—'}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center">
                                <div className="text-[9px] font-black uppercase text-slate-400">{t('seo_inspector.word_count')}</div>
                                <div className="text-lg font-black text-navy tabular-nums">{seoData.wordCount?.toLocaleString() ?? '0'}</div>
                            </div>
                        </div>
                    </div>

                    <div className="premium-card p-6 border border-slate-200 bg-gradient-to-br from-white to-emerald-50/30">
                        <h3 className="text-sm font-black text-navy uppercase tracking-[0.1em] mb-1 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            {siteInsightsData?.dateRanges
                                ? t('seo_inspector.site_insights_title')
                                : t('seo_inspector.analytics_title_owner')}
                        </h3>
                        {siteInsightsData?.dateRanges && (
                            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">{t('seo_inspector.site_insights_subtitle')}</p>
                        )}
                        {loadingAnalytics ? (
                            <div className="py-10 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
                                <p className="text-xs font-bold uppercase tracking-widest">{t('seo_inspector.loading_analytics')}</p>
                            </div>
                        ) : siteInsightsData?.dateRanges ? (
                            <div className="space-y-5">
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    <span className="font-bold text-navy">{t('seo_inspector.owner_period_current')}</span>
                                    {' '}
                                    {siteInsightsData.dateRanges.current.start} → {siteInsightsData.dateRanges.current.end}
                                    <span className="mx-2 text-slate-300">|</span>
                                    <span className="font-bold text-navy">{t('seo_inspector.owner_period_previous')}</span>
                                    {' '}
                                    {siteInsightsData.dateRanges.previous.start} → {siteInsightsData.dateRanges.previous.end}
                                </p>
                                {siteInsightsData.gscPropertyFound === false && (
                                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                                        {t('seo_inspector.site_no_gsc')}
                                        {siteInsightsData.gscError ? ` (${siteInsightsData.gscError})` : ''}
                                    </p>
                                )}
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                                        {t('seo_inspector.site_insights_gsc_totals')}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-inner-soft">
                                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">{t('seo_inspector.clicks')}</div>
                                            <div className="text-2xl font-black text-navy tabular-nums">
                                                {(siteInsightsData.gscSite?.current?.clicks ?? 0).toLocaleString()}
                                            </div>
                                            <div className={`text-sm font-black mt-1 ${formatDelta(siteInsightsData.gscSite?.deltaPct?.clicks).cls}`}>
                                                {formatDelta(siteInsightsData.gscSite?.deltaPct?.clicks).label}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-inner-soft">
                                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">{t('seo_inspector.impressions')}</div>
                                            <div className="text-2xl font-black text-navy tabular-nums">
                                                {(siteInsightsData.gscSite?.current?.impressions ?? 0).toLocaleString()}
                                            </div>
                                            <div className={`text-sm font-black mt-1 ${formatDelta(siteInsightsData.gscSite?.deltaPct?.impressions).cls}`}>
                                                {formatDelta(siteInsightsData.gscSite?.deltaPct?.impressions).label}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {(() => {
                                    const g = siteInsightsData.ga4Site;
                                    if (!g) return null;
                                    const cur =
                                        (g.current?.pageviews ?? 0) +
                                        (g.current?.totalUsers ?? 0) +
                                        (g.current?.sessions ?? 0);
                                    const prev =
                                        (g.previous?.pageviews ?? 0) +
                                        (g.previous?.totalUsers ?? 0) +
                                        (g.previous?.sessions ?? 0);
                                    if (cur + prev === 0) return null;
                                    return (
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                                            {t('seo_inspector.site_insights_ga4_totals')}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <OwnerDeltaChip
                                                label={t('seo_inspector.pageviews')}
                                                deltaPct={siteInsightsData.ga4Site?.deltaPct?.pageviews}
                                                valueLine={`${t('seo_inspector.owner_now')}: ${(siteInsightsData.ga4Site?.current?.pageviews ?? 0).toLocaleString()}`}
                                            />
                                            <OwnerDeltaChip
                                                label={t('seo_inspector.total_users')}
                                                deltaPct={siteInsightsData.ga4Site?.deltaPct?.totalUsers}
                                                valueLine={`${t('seo_inspector.owner_now')}: ${(siteInsightsData.ga4Site?.current?.totalUsers ?? 0).toLocaleString()}`}
                                            />
                                            <OwnerDeltaChip
                                                label={t('seo_inspector.sessions')}
                                                deltaPct={siteInsightsData.ga4Site?.deltaPct?.sessions}
                                                valueLine={`${t('seo_inspector.owner_now')}: ${(siteInsightsData.ga4Site?.current?.sessions ?? 0).toLocaleString()}`}
                                            />
                                        </div>
                                    </div>
                                    );
                                })()}
                                {siteInsightsData.gscPropertyFound !== false && (
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2">
                                            {(['top', 'up', 'down'] as const).map((tab) => (
                                                <button
                                                    key={tab}
                                                    type="button"
                                                    onClick={() => setSiteInsightsTab(tab)}
                                                    className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border transition-colors ${
                                                        siteInsightsTab === tab
                                                            ? 'bg-navy text-white border-navy'
                                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                                    }`}
                                                >
                                                    {tab === 'top' && t('seo_inspector.tab_top_pages')}
                                                    {tab === 'up' && t('seo_inspector.tab_trending_up')}
                                                    {tab === 'down' && t('seo_inspector.tab_trending_down')}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="rounded-xl border border-slate-100 overflow-hidden bg-white/80">
                                            <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-[9px] font-black uppercase text-slate-400 px-3 py-2 bg-slate-50 border-b border-slate-100">
                                                <span>{t('seo_inspector.site_col_page')}</span>
                                                <span className="text-right">{t('seo_inspector.site_col_delta')}</span>
                                                <span className="text-right">{t('seo_inspector.site_col_clicks')}</span>
                                            </div>
                                            {(() => {
                                                const list =
                                                    siteInsightsTab === 'top'
                                                        ? siteInsightsData.topPages
                                                        : siteInsightsTab === 'up'
                                                          ? siteInsightsData.trendingUp
                                                          : siteInsightsData.trendingDown;
                                                if (!list || list.length === 0) {
                                                    return (
                                                        <div className="px-3 py-6 text-center text-xs text-slate-400">
                                                            {t('seo_inspector.site_insights_empty')}
                                                        </div>
                                                    );
                                                }
                                                return list.map((row, idx) => {
                                                    const d = formatDelta(row.deltaPctClicks);
                                                    const isDownTab = siteInsightsTab === 'down';
                                                    return (
                                                        <div
                                                            key={`${row.page}-${idx}`}
                                                            className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2 border-b border-slate-50 last:border-0 text-xs"
                                                        >
                                                            <a
                                                                href={row.page}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-cyan hover:underline font-medium truncate min-w-0"
                                                                title={row.page}
                                                            >
                                                                {row.page.replace(/^https?:\/\//, '')}
                                                            </a>
                                                            <div
                                                                className={`text-right font-black tabular-nums flex items-center justify-end gap-0.5 ${
                                                                    row.deltaPctClicks == null
                                                                        ? 'text-emerald-600'
                                                                        : isDownTab
                                                                          ? 'text-rose-600'
                                                                          : d.cls
                                                                }`}
                                                            >
                                                                {row.deltaPctClicks == null && row.previousClicks === 0 && row.clicks > 0 ? (
                                                                    <span className="flex items-center gap-0.5">
                                                                        <TrendingUp className="w-3 h-3" />
                                                                        {t('seo_inspector.site_new_page')}
                                                                    </span>
                                                                ) : row.deltaPctClicks == null ? (
                                                                    '—'
                                                                ) : isDownTab ? (
                                                                    <span className="flex items-center gap-0.5">
                                                                        <TrendingDown className="w-3 h-3" />
                                                                        {d.label}
                                                                    </span>
                                                                ) : (
                                                                    <span className="flex items-center gap-0.5">
                                                                        <TrendingUp className="w-3 h-3" />
                                                                        {d.label}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-right font-bold text-navy tabular-nums">{row.clicks.toLocaleString()}</div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : analyticsData?.dateRanges ? (
                            <div className="space-y-5">
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    <span className="font-bold text-navy">{t('seo_inspector.owner_period_current')}</span>
                                    {' '}{analyticsData.dateRanges.current.start} → {analyticsData.dateRanges.current.end}
                                    <span className="mx-2 text-slate-300">|</span>
                                    <span className="font-bold text-navy">{t('seo_inspector.owner_period_previous')}</span>
                                    {' '}{analyticsData.dateRanges.previous.start} → {analyticsData.dateRanges.previous.end}
                                </p>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    <OwnerDeltaChip
                                        label={t('seo_inspector.pageviews')}
                                        deltaPct={analyticsData.ga4?.deltaPct?.pageviews}
                                        valueLine={`${t('seo_inspector.owner_now')}: ${analyticsData.pageviews.toLocaleString()}`}
                                    />
                                    <OwnerDeltaChip
                                        label={t('seo_inspector.total_users')}
                                        deltaPct={analyticsData.ga4?.deltaPct?.totalUsers}
                                        valueLine={`${t('seo_inspector.owner_now')}: ${(analyticsData.totalUsers ?? 0).toLocaleString()}`}
                                    />
                                    <OwnerDeltaChip
                                        label={t('seo_inspector.sessions')}
                                        deltaPct={analyticsData.ga4?.deltaPct?.sessions}
                                        valueLine={`${t('seo_inspector.owner_now')}: ${(analyticsData.sessions ?? 0).toLocaleString()}`}
                                    />
                                    <OwnerDeltaChip
                                        label={t('seo_inspector.engagement_time')}
                                        deltaPct={analyticsData.ga4?.deltaPct?.engagementSeconds}
                                        valueLine={`${t('seo_inspector.owner_now')}: ${formatGa4Engagement(analyticsData.engagementSeconds)}`}
                                    />
                                    <OwnerDeltaChip
                                        label={t('seo_inspector.clicks')}
                                        deltaPct={analyticsData.gsc?.deltaPct?.clicks}
                                        valueLine={`${t('seo_inspector.owner_now')}: ${analyticsData.clicks.toLocaleString()}`}
                                    />
                                    <OwnerDeltaChip
                                        label={t('seo_inspector.impressions')}
                                        deltaPct={analyticsData.gsc?.deltaPct?.impressions}
                                        valueLine={`${t('seo_inspector.owner_now')}: ${analyticsData.impressions.toLocaleString()}`}
                                    />
                                    <OwnerDeltaChip
                                        label={t('seo_inspector.ctr')}
                                        deltaPct={analyticsData.gsc?.deltaPct?.ctr}
                                        valueLine={`${t('seo_inspector.owner_now')}: ${analyticsData.ctr != null ? `${analyticsData.ctr.toFixed(2)}%` : '—'}`}
                                    />
                                    <OwnerDeltaChip
                                        label={t('seo_inspector.avg_position')}
                                        deltaPct={analyticsData.gsc?.deltaPct?.avgPosition}
                                        valueLine={`${t('seo_inspector.owner_now')}: ${analyticsData.avgPosition > 0 ? `#${analyticsData.avgPosition}` : '—'}`}
                                        reverse
                                    />
                                </div>
                                {analyticsData.healthFlags && analyticsData.healthFlags.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {analyticsData.healthFlags.map((f) => (
                                            <span key={f} className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                                {f}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {analyticsData.aiSummary?.expectedImpact && (
                                    <p className="text-sm text-slate-700 border-t border-slate-100 pt-4">
                                        <span className="font-bold text-navy">{t('seo_inspector.expected_impact')}: </span>
                                        {analyticsData.aiSummary.expectedImpact}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="py-6 text-center text-sm text-slate-400">{t('seo_inspector.no_analytics')}</div>
                        )}
                    </div>
                </div>
            )}

            {seoData && !loading && isAdmin && showFullTechnical && (
                <div className="pt-2 pb-3 mb-6 border-b border-slate-200">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-navy flex items-center gap-2">
                        {t('seo_inspector.admin_detail_heading')}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">{t('seo_inspector.admin_detail_sub')}</p>
                </div>
            )}

            {seoData && !loading && showFullTechnical && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {isContentCreator && (
                        <div className="premium-card p-6 border-2 border-navy/10 bg-gradient-to-br from-white to-cyan-50/20 shadow-soft">
                            <div className="flex items-start gap-3 mb-4">
                                <div className="rounded-xl bg-navy/10 p-2.5 shrink-0">
                                    <ClipboardList className="w-5 h-5 text-navy" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-black text-navy uppercase tracking-[0.1em]">{t('seo_inspector.creator_playbook_title')}</h3>
                                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t('seo_inspector.creator_playbook_sub')}</p>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-cyan-700 mt-3 mb-2">{t('seo_inspector.creator_section_onpage')}</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {buildCreatorOnpageChecks(seoData, t).map((row) => (
                                    <div
                                        key={row.key}
                                        className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 rounded-xl border border-slate-100 bg-white/90 px-3 py-2.5"
                                    >
                                        <div className="flex items-center gap-2 sm:w-40 shrink-0">
                                            {row.status === 'ok' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                                            {row.status === 'warn' && <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />}
                                            {row.status === 'bad' && <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                                            <span className="text-xs font-bold text-navy">{row.label}</span>
                                            <span
                                                className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                                    row.status === 'ok'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : row.status === 'warn'
                                                          ? 'bg-amber-100 text-amber-800'
                                                          : 'bg-rose-100 text-rose-800'
                                                }`}
                                            >
                                                {row.status === 'ok'
                                                    ? t('seo_inspector.creator_status_ok')
                                                    : row.status === 'warn'
                                                      ? t('seo_inspector.creator_status_warn')
                                                      : t('seo_inspector.creator_status_bad')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-snug flex-1 min-w-0">{row.hint}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-5 pt-4 border-t border-slate-100">
                                {t('seo_inspector.creator_section_traffic')}
                            </p>
                        </div>
                    )}

                    {/* Status Overview Card */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="premium-card p-6 bg-navy text-white relative overflow-hidden group">
                           <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-[20px] group-hover:bg-white/20 transition-colors" />
                           <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-4 text-cyan">{t('seo_inspector.http_status')}</div>
                           <div className="flex items-end gap-3">
                               <span className={`text-4xl font-black leading-none ${seoData.statusCode >= 200 && seoData.statusCode < 300 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                   {seoData.statusCode || 'N/A'}
                               </span>
                               {seoData.statusCode === 200 && <CheckCircle2 className="w-6 h-6 text-emerald-400 mb-1" />}
                           </div>
                        </div>
                        <div className="premium-card p-6 border border-slate-200">
                           <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">{t('seo_inspector.indexability')}</div>
                           <div className="text-3xl font-black text-navy leading-none capitalize">
                               {seoData.indexability || 'N/A'}
                           </div>
                        </div>
                        <div className="premium-card p-6 border border-slate-200">
                           <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">{t('seo_inspector.word_count')}</div>
                           <div className="text-3xl font-black text-navy leading-none tabular-nums">
                               {seoData.wordCount?.toLocaleString() || '0'}
                           </div>
                        </div>
                    </div>

                    {/* Meta Tags Panel */}
                    <div className="premium-card p-8 border border-slate-200">
                        <h3 className="text-sm font-black text-navy uppercase tracking-[0.1em] mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                            <span>{t('seo_inspector.meta_details')}</span>
                            <a href={seoData.url} target="_blank" rel="noopener noreferrer" className="text-cyan hover:text-navy transition-colors flex items-center gap-1.5 text-xs">
                                {t('seo_inspector.visit_url')} <ExternalLink className="w-3 h-3" />
                            </a>
                        </h3>

                        <div className="space-y-6">
                            <div>
                                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('seo_inspector.title_label')}</div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-800 font-medium leading-relaxed shadow-inner-soft">
                                    {seoData.title || <span className="text-slate-400 italic">{t('seo_inspector.no_title')}</span>}
                                </div>
                                {seoData.title && (
                                    <div className="text-[11px] text-right mt-1.5 font-medium">
                                        <span className={seoData.title.length > 60 ? "text-amber-500" : "text-emerald-500"}>{seoData.title.length} {t('seo_inspector.chars')}</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('seo_inspector.meta_desc_label')}</div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-800 font-medium leading-relaxed shadow-inner-soft">
                                    {seoData.metaDescription || <span className="text-slate-400 italic">{t('seo_inspector.no_meta_desc')}</span>}
                                </div>
                                {seoData.metaDescription && (
                                    <div className="text-[11px] text-right mt-1.5 font-medium">
                                        <span className={seoData.metaDescription.length > 160 ? "text-amber-500" : "text-emerald-500"}>{seoData.metaDescription.length} {t('seo_inspector.chars')}</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('seo_inspector.h1_header')}</div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-800 font-medium leading-relaxed shadow-inner-soft text-xl">
                                    {seoData.h1 || <span className="text-slate-400 italic text-base">{t('seo_inspector.no_h1')}</span>}
                                </div>
                            </div>

                            <div>
                                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('seo_inspector.canonical_link')}</div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-blue-600 font-medium leading-relaxed shadow-inner-soft truncate break-all">
                                    {seoData.canonical || <span className="text-slate-400 italic">{t('seo_inspector.no_canonical')}</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Performance & Resources */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="premium-card p-6 border border-slate-200">
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                             <Zap className="w-4 h-4 text-amber-500" /> {t('seo_inspector.page_timing')}
                          </h4>
                          <div className="space-y-4">
                              <div className="flex items-center justify-between border-b border-dashed border-slate-100 pb-2">
                                 <span className="text-sm text-slate-500 font-medium">{t('seo_inspector.dom_complete')}</span>
                                 <span className="text-sm font-black text-navy">{seoData.rawProviderResponse?.page_timing?.dom_complete || 'N/A'}</span>
                              </div>
                              <div className="flex items-center justify-between border-b border-dashed border-slate-100 pb-2">
                                 <span className="text-sm text-slate-500 font-medium">{t('seo_inspector.tti')}</span>
                                 <span className="text-sm font-black text-navy">{seoData.rawProviderResponse?.page_timing?.time_to_interactive || 'N/A'}</span>
                              </div>
                              <div className="flex items-center justify-between pb-2">
                                 <span className="text-sm text-slate-500 font-medium">{t('seo_inspector.total_duration')}</span>
                                 <span className="text-sm font-black text-navy">{seoData.rawProviderResponse?.page_timing?.duration_time || 'N/A'}</span>
                              </div>
                          </div>
                       </div>
                       
                       <div className="premium-card p-6 border border-slate-200">
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                             <Link2 className="w-4 h-4 text-blue-500" /> {t('seo_inspector.links_resources')}
                          </h4>
                          <div className="space-y-4">
                              <div className="flex items-center justify-between border-b border-dashed border-slate-100 pb-2">
                                 <span className="text-sm text-slate-500 font-medium">{t('seo_inspector.internal_links')}</span>
                                 <span className="text-sm font-black text-navy">{seoData.rawProviderResponse?.meta?.internal_links_count || '0'}</span>
                              </div>
                              <div className="flex items-center justify-between border-b border-dashed border-slate-100 pb-2">
                                 <span className="text-sm text-slate-500 font-medium">{t('seo_inspector.external_links')}</span>
                                 <span className="text-sm font-black text-navy">{seoData.rawProviderResponse?.meta?.external_links_count || '0'}</span>
                              </div>
                              <div className="flex items-center justify-between pb-2">
                                 <span className="text-sm text-slate-500 font-medium">{t('seo_inspector.images_scripts')}</span>
                                 <span className="text-sm font-black text-navy">
                                     {seoData.rawProviderResponse?.meta?.images_count || '0'} / {seoData.rawProviderResponse?.meta?.scripts_count || '0'}
                                 </span>
                              </div>
                          </div>
                       </div>
                    </div>

                    {/* Headings Hierarchy */}
                    <div className="premium-card p-6 border border-slate-200">
                         <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                             <FileCode className="w-4 h-4 text-purple-500" /> {t('seo_inspector.headings_breakdown')}
                         </h4>
                         <div className="flex flex-wrap gap-4">
                             {['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(tag => {
                                 const count = seoData.rawProviderResponse?.meta?.htags?.[tag]?.length || 0;
                                 return (
                                     <div key={tag} className="flex-1 min-w-[60px] bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                                         <div className="text-[10px] font-black uppercase text-slate-400 mb-1">{tag}</div>
                                         <div className="text-2xl font-black text-navy">{count}</div>
                                     </div>
                                 )
                             })}
                         </div>
                    </div>

                    {/* GA4 & GSC Analytics Section */}
                    <div className="premium-card p-8 border border-slate-200 bg-gradient-to-br from-white to-slate-50/30">
                        <h3 className="text-sm font-black text-navy uppercase tracking-[0.1em] mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                            <span className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                                {t('seo_inspector.analytics_title')}
                            </span>
                        </h3>

                        {loadingAnalytics ? (
                            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-4">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
                                <p className="text-xs font-bold uppercase tracking-widest animate-pulse">{t('seo_inspector.loading_analytics')}</p>
                            </div>
                        ) : analyticsData ? (
                            <div className="space-y-8">
                                {isContentCreator && (
                                    <div className="space-y-4">
                                        <AnalyticsPrioritySection data={analyticsData} t={t} />
                                        <p className="text-[11px] text-slate-500 leading-relaxed border-b border-slate-100 pb-4">
                                            {t('seo_inspector.creator_analytics_intro')}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700/80 mb-4">{t('seo_inspector.ga4_block')}</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                        <div className="space-y-1 rounded-2xl border border-slate-100 bg-white/80 p-4">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('seo_inspector.pageviews')}</div>
                                            <div className="text-xl font-black text-navy tabular-nums">{analyticsData.pageviews.toLocaleString()}</div>
                                        </div>
                                        <div className="space-y-1 rounded-2xl border border-slate-100 bg-white/80 p-4">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('seo_inspector.total_users')}</div>
                                            <div className="text-xl font-black text-navy tabular-nums">{(analyticsData.totalUsers ?? 0).toLocaleString()}</div>
                                        </div>
                                        <div className="space-y-1 rounded-2xl border border-slate-100 bg-white/80 p-4">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('seo_inspector.sessions')}</div>
                                            <div className="text-xl font-black text-navy tabular-nums">{(analyticsData.sessions ?? 0).toLocaleString()}</div>
                                        </div>
                                        <div className="space-y-1 rounded-2xl border border-slate-100 bg-white/80 p-4">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('seo_inspector.engagement_time')}</div>
                                            <div className="text-xl font-black text-navy tabular-nums">{formatGa4Engagement(analyticsData.engagementSeconds)}</div>
                                        </div>
                                        <div className="space-y-1 rounded-2xl border border-slate-100 bg-white/80 p-4 col-span-2 sm:col-span-1">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('seo_inspector.events')}</div>
                                            <div className="text-xl font-black text-navy tabular-nums">{(analyticsData.eventCount ?? 0).toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700/80 mb-4">{t('seo_inspector.gsc_block')}</h4>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="space-y-1 rounded-2xl border border-slate-100 bg-white/80 p-4">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('seo_inspector.clicks')}</div>
                                            <div className="text-xl font-black text-navy tabular-nums">{analyticsData.clicks.toLocaleString()}</div>
                                        </div>
                                        <div className="space-y-1 rounded-2xl border border-slate-100 bg-white/80 p-4">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('seo_inspector.impressions')}</div>
                                            <div className="text-xl font-black text-navy tabular-nums">{analyticsData.impressions.toLocaleString()}</div>
                                        </div>
                                        <div className="space-y-1 rounded-2xl border border-slate-100 bg-white/80 p-4">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('seo_inspector.ctr')}</div>
                                            <div className="text-xl font-black text-navy tabular-nums">
                                                {analyticsData.ctr != null ? `${analyticsData.ctr.toFixed(2)}%` : '—'}
                                            </div>
                                        </div>
                                        <div className="space-y-1 rounded-2xl border border-slate-100 bg-white/80 p-4">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('seo_inspector.avg_position')}</div>
                                            <div className="text-xl font-black text-emerald-600 tabular-nums">
                                                {analyticsData.avgPosition > 0 ? `#${analyticsData.avgPosition}` : '—'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {analyticsData.dateRanges && (
                                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">
                                            {t('seo_inspector.compare_window')}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('seo_inspector.current_7d')}</div>
                                                <div className="font-bold text-navy">{analyticsData.dateRanges.current.start} - {analyticsData.dateRanges.current.end}</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('seo_inspector.previous_7d')}</div>
                                                <div className="font-bold text-navy">{analyticsData.dateRanges.previous.start} - {analyticsData.dateRanges.previous.end}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(analyticsData.ga4?.deltaPct || analyticsData.gsc?.deltaPct) && (
                                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">
                                            {t('seo_inspector.delta_insight')}
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('seo_inspector.pageviews')}</div>
                                                <div className={`font-black ${formatDelta(analyticsData.ga4?.deltaPct?.pageviews).cls}`}>{formatDelta(analyticsData.ga4?.deltaPct?.pageviews).label}</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('seo_inspector.clicks')}</div>
                                                <div className={`font-black ${formatDelta(analyticsData.gsc?.deltaPct?.clicks).cls}`}>{formatDelta(analyticsData.gsc?.deltaPct?.clicks).label}</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('seo_inspector.ctr')}</div>
                                                <div className={`font-black ${formatDelta(analyticsData.gsc?.deltaPct?.ctr).cls}`}>{formatDelta(analyticsData.gsc?.deltaPct?.ctr).label}</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('seo_inspector.avg_position')}</div>
                                                <div className={`font-black ${formatDelta(analyticsData.gsc?.deltaPct?.avgPosition, true).cls}`}>{formatDelta(analyticsData.gsc?.deltaPct?.avgPosition, true).label}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!isContentCreator && <AnalyticsPrioritySection data={analyticsData} t={t} />}

                                {(analyticsData.topQueries && analyticsData.topQueries.length > 0) || (analyticsData.clicksByDevice && analyticsData.clicksByDevice.length > 0) ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {analyticsData.topQueries && analyticsData.topQueries.length > 0 && (
                                            <div className="rounded-2xl border border-slate-100 bg-white/80 overflow-hidden">
                                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-4 py-3 bg-slate-50 border-b border-slate-100">
                                                    {t('seo_inspector.top_queries')}
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="text-left text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                                                                <th className="px-4 py-2 font-black">{t('seo_inspector.query_col')}</th>
                                                                <th className="px-2 py-2 font-black text-right">{t('seo_inspector.clicks')}</th>
                                                                <th className="px-2 py-2 font-black text-right">{t('seo_inspector.impressions')}</th>
                                                                <th className="px-2 py-2 font-black text-right">{t('seo_inspector.ctr')}</th>
                                                                <th className="px-4 py-2 font-black text-right">{t('seo_inspector.pos')}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {analyticsData.topQueries.map((row, i) => (
                                                                <tr key={i} className="border-b border-slate-50 last:border-0">
                                                                    <td className="px-4 py-2.5 font-medium text-navy max-w-[200px] truncate" title={row.query}>{row.query || '—'}</td>
                                                                    <td className="px-2 py-2.5 text-right tabular-nums">{row.clicks.toLocaleString()}</td>
                                                                    <td className="px-2 py-2.5 text-right tabular-nums">{row.impressions.toLocaleString()}</td>
                                                                    <td className="px-2 py-2.5 text-right tabular-nums">{row.ctr.toFixed(2)}%</td>
                                                                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{row.position > 0 ? row.position.toFixed(1) : '—'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                        {analyticsData.clicksByDevice && analyticsData.clicksByDevice.length > 0 && (
                                            <div className="rounded-2xl border border-slate-100 bg-white/80 overflow-hidden">
                                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-4 py-3 bg-slate-50 border-b border-slate-100">
                                                    {t('seo_inspector.by_device')}
                                                </div>
                                                <div className="p-4 space-y-3">
                                                    {analyticsData.clicksByDevice.map((row, i) => (
                                                        <div key={i} className="flex items-center justify-between gap-3 border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                                                            <span className="text-sm font-bold text-navy capitalize">{row.device?.toLowerCase()}</span>
                                                            <span className="text-sm tabular-nums text-slate-600">
                                                                {row.clicks.toLocaleString()} <span className="text-slate-400 text-xs font-medium">{t('seo_inspector.clicks_short')}</span>
                                                                {' · '}
                                                                {row.impressions.toLocaleString()} <span className="text-slate-400 text-xs font-medium">{t('seo_inspector.impr_short')}</span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="py-8 text-center bg-slate-100/50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-sm text-slate-400 font-medium mb-1">{t('seo_inspector.no_analytics')}</p>
                                <p className="text-[10px] text-slate-300 font-bold uppercase tracking-tighter italic">{t('seo_inspector.configure_bigquery')}</p>
                            </div>
                        )}
                    </div>

                    {/* Dev/Debug Panel */}
                    <div className="premium-card overflow-hidden border border-slate-200 mt-6">
                        <div 
                          className="bg-slate-900 px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors"
                          onClick={() => setShowRaw(!showRaw)}
                        >
                            <div className="flex items-center gap-3">
                                <Code2 className="w-5 h-5 text-cyan" />
                                <span className="text-[13px] font-bold text-white uppercase tracking-widest">{t('seo_inspector.raw_response')}</span>
                            </div>
                            <span className="text-slate-400 text-xs font-mono">{showRaw ? t('seo_inspector.hide') : t('seo_inspector.view')}</span>
                        </div>
                        
                        {showRaw && (
                            <div className="relative bg-[#0f172a] border-t border-slate-700 p-6 pt-12">
                                <button 
                                   onClick={handleCopyRaw}
                                   className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-2 transition-colors border border-white/10"
                                >
                                   {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                   {copied ? t('seo_inspector.copied') : t('seo_inspector.copy_btn')}
                                </button>
                                <pre className="text-xs font-mono text-cyan/90 leading-relaxed overflow-x-auto custom-scrollbar pb-2">
                                    {JSON.stringify(seoData.rawProviderResponse, null, 2)}
                                </pre>
                                <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-slate-400 italic">
                                    {t('seo_inspector.raw_note')}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default SeoUrlInspectorTab;
