
// ==================
// User & Domain Types
// ==================

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'admin' | 'brand_owner' | 'content_creator' | 'viewer';
  ownedBrandIds?: string[];
  assignedBrandIds?: string[];
  featurePermissions?: string[];
  avatar?: string;
  name?: string;
  id?: string;
  // New field for tracking AI usage
  usageStats?: {
    totalTokens: number;
    requestCount: number;
    lastActiveAt?: any; // Firestore Timestamp
    breakdown?: Record<string, number>;
  };
}

export interface AuditRule {
  id: string;
  type: 'language' | 'ai_logic' | 'brand' | 'product' | 'legal';
  code: string;
  label: string;
  content: string;
  updated_at: any;
  apply_to_language?: 'all' | 'vi' | 'en' | 'ja'; // New field for language specific rules
}

export interface Brand {
  id: string;
  name: string;
  /** Canonical site host for RBAC (e.g. example.com). Paths on this host are allowed in SEO Inspector. */
  domain?: string;
  /** Optional extra hosts (e.g. blog.example.com or second-domain.com). */
  alternateDomains?: string[];
  slug?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_colors?: string[];
  slogan?: string;
  tagline?: string;
  industry?: string;
  category?: string;
  country?: string;
  positioning_statement?: string;
  core_values?: string[];
  usp?: string[];
  target_segments?: string[];
  personality: string;
  brand_personality?: string[];
  voice: string;
  tone_of_voice?: string;
  do_words?: string[];
  dont_words?: string[];
  style_rules?: string;
  visual_rules?: string;
  auditCriteria?: string;
  summary?: string;
  last_guideline_updated_at?: any;
}

export interface Generation {
  id: string;
  brand_id: string;
  user_id: string;
  user_name: string;
  input_data: {
    platform: string;
    topic: string;
    language: string;
    product_id?: string;
    product_ids?: string[]; // Added for multi-select support
    persona_id?: string;
  };
  output_data: string;
  citations?: string[];
  timestamp: any;
  last_updated?: any;
}

export interface Auditor {
  id: string;
  type: string;
  brand_id: string;
  brand_name?: string;
  user_id: string;
  user_name: string;
  input_data: {
    rawText: string;
    text: string;
    url?: string;
    language?: string;   // bạn có thể đổi sang LanguageCode nếu muốn chuẩn hóa luôn
    platform?: string;
  };
  output_data: any;
  timestamp: any;
}

export interface Guideline {
  id: string;
  brand_id: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected';
  file_name: string;
  is_primary?: boolean;
  description?: string;
  guideline_text?: string;
  file_url?: string;
  uploaded_by?: string;
  uploaded_role?: string;
  created_at?: any;
}

export interface SystemPrompts {
  generator: Record<string, string>;
  auditor: Record<string, string>;
}

export interface Product {
  id: string;
  brand_id: string;
  name: string;
  type: 'good' | 'service';
  category: string;
  status: 'Active' | 'Paused';
  target_audience: string;
  benefits: string;
  usp: string;
  description: string;
}

export interface Market {
  id: string;
  brand_id: string;
  name: string;
  region: string;
  status: 'Active' | 'Inactive';
  description: string;
  competitors: string;
  market_trends: string;
  growth_potential: string;
}

// Added AnalysisResult to fix import errors in services/api.ts and BrandModal.tsx
export interface AnalysisResult {
  brandName: string;
  industry: string;
  targetAudience: string;
  tone: string;
  coreValues: string[];
  keywords: string[];
  visualStyle: string;
  dos: string[];
  donts: string[];
  summary: string;
}

// Added Persona to fix import error in PersonasTab.tsx
export interface Persona {
  id: string;
  brand_id: string;
  name: string;
  jobTitle: string;
  industry: string;
  goals: string;
  painPoints: string;
  preferredLanguage: string;
}

export interface ContentTemplate {
  id: string;
  brand_id: string;
  name: string;
  structure: 'AIDA' | 'PAS' | 'Storytelling' | 'H-P-I-S-C';
  description: string;
  prompt_skeleton: string;
}

// ==================
// NLP Module Interfaces
// ==================

export type LanguageCode = 'vi' | 'en' | 'ja';

export type IssueDimension = 'language' | 'ai_logic' | 'brand' | 'product' | 'legal';
export type IssueSeverity = 'low' | 'medium' | 'high';

export interface NlpIssue {
  dimension: IssueDimension;
  severity: IssueSeverity;
  message: string;
  problematic_text?: string;
  sentence_idx?: number; // để mapping highlight / JSON Gemini
}

export interface NlpStats {
  word_count: number;
  sentence_count: number;
  paragraph_count: number;
}

export interface NlpResponse {
  language: LanguageCode;
  stats: NlpStats;
  potential_issues: NlpIssue[];
  processed_text: string;
}

// ==================
// SEO & Research Interfaces
// ==================

export interface SeoMetadata {
  title: string;
  description: string;
  keywords: string;
  author: string;
  ogImage: string;
  favicon: string;
  lang: string;
  stats: {
    links: number;
    internalLinks: number;
    externalLinks: number;
    images: number;
    schemaCount: number;
  };
}

export interface SeoAuditCategory {
  score: number;
  issues: string[];
}

export interface SeoAudit {
  score: number;
  categories: {
    url: SeoAuditCategory;
    metadata: SeoAuditCategory;
    semantic: SeoAuditCategory;
    headings: SeoAuditCategory;
    links: SeoAuditCategory;
    images: SeoAuditCategory;
    schema: SeoAuditCategory;
  };
  recommendations: string[];
}

export interface ScrapeResponse {
  success: boolean;
  text: string;
  metadata: SeoMetadata;
  audit: SeoAudit;
  url: string;
  cleaningLevel: string;
}

// ==================
// Rank Checker Interfaces
// ==================

export interface RankGroup {
  id: string;
  name: string;
  userId: string;
  createdAt: any;
}

export interface RankProject {
  id: string;
  name: string;
  domain: string;
  groupId?: string | null;
  userId: string;
  createdAt: any;
}

export interface RankKeyword {
  id: string;
  projectId?: string;
  brandId?: string;
  keyword: string;
  createdAt: any;
}

export interface RankHistory {
  id: string;
  keywordId: string;
  keyword: string;
  brandId: string;
  position: number | null;
  url: string | null;
  checkedAt: any;
}

export interface RankJob {
  id: string;
  brandId: string;
  domain: string;
  total: number;
  pendingKeywords: string[]; 
  completedResults: any[];
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: any;
}
export interface RankingResult {
  keywordId: string;
  keyword: string;
  position: number | null;
  url: string | null;
  checkedAt: string | null;
  bestPosition?: number | null;
  previousPosition?: number | null;
}
