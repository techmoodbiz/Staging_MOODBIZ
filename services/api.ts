
import { Brand, AnalysisResult, User } from '../types';
import firebase, { db } from '../firebase';
import { safeJSONParse } from './geminiService';
import { assembleAuditPrompt } from './auditEngine';

// Safe environment variable access
const getEnvVar = (key: string) => {
  try {
    // @ts-ignore
    return import.meta?.env?.[key];
  } catch (e) {
    return undefined;
  }
};

const BASE_URL = getEnvVar('VITE_API_URL') || "https://staging-backend-one.vercel.app/api";

/**
 * Helper: Lấy ID Token từ Firebase Auth hiện tại
 */
async function getAuthHeaders() {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    throw new Error("Người dùng chưa đăng nhập. Vui lòng tải lại trang.");
  }
  const token = await currentUser.getIdToken();
  return {
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Phân tích thương hiệu từ nội dung Website thông qua Backend
 */
export async function analyzeWebsite(websiteUrl: string): Promise<AnalysisResult> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/brand-manager?action=analyze-website`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify({ websiteUrl }),
  });

  const result = await res.json();
  if (!res.ok || !result.success) {
    throw new Error(result.error || "Không thể phân tích website này");
  }

  return result.data;
}

/**
 * Phân tích thương hiệu từ File thông qua Backend
 */
export async function analyzeFile(file: File): Promise<AnalysisResult> {
  const authHeaders = await getAuthHeaders();
  const formData = new FormData();
  formData.append("file", file);

  // Lưu ý: Không set Content-Type thủ công khi dùng FormData, browser sẽ tự set boundary
  const res = await fetch(`${BASE_URL}/brand-manager?action=analyze-file`, {
    method: "POST",
    headers: {
      ...authHeaders
    },
    body: formData,
  });

  const result = await res.json();
  if (!res.ok || !result.success) {
    throw new Error(result.error || "Không thể phân tích file này");
  }

  return result.data;
}

/**
 * Tạo nội dung (Server-Side Call)
 * Sử dụng endpoint rag-generate hợp nhất
 */
export async function generateContent(payload: any) {
  try {
    const authHeaders = await getAuthHeaders();
    const endpoint = `${BASE_URL}/generateContent`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify({
        brand: payload.brand,
        topic: payload.topic,
        platform: payload.platform,
        language: payload.language,
        userText: payload.userText, // Mapping userText từ context cũ nếu có
        context: payload.context,
        systemPrompt: payload.systemPrompt
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Lỗi khi gọi Generate API");
    }

    return data; // { success: true, result: string, citations: [] }

  } catch (error) {
    console.error("Gen AI Error", error);
    throw new Error("Lỗi tạo nội dung: " + (error as Error).message);
  }
}

/**
 * Kiểm tra giọng văn (Audit - Server Side)
 */
export async function auditContent(payload: any) {
  try {
    const authHeaders = await getAuthHeaders();
    let finalPrompt = payload.prompt;

    if (!finalPrompt) {
      finalPrompt = assembleAuditPrompt({
        text: payload.text || payload.rawText || '',
        brand: payload.brand,
        product: payload.product,
        products: payload.products || (payload.product ? [payload.product] : []),
        rules: payload.rules || [],
        language: payload.language || 'Vietnamese',
        platform: payload.platform || 'General'
      });
    }

    const res = await fetch(`${BASE_URL}/auditContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify({
        constructedPrompt: finalPrompt,
        brand: payload.brand,
        text: payload.text,
        platform: payload.platform || 'General',
        language: payload.language || 'Vietnamese'
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Lỗi khi gọi Audit API");
    }

    const parsedResult = safeJSONParse(data.result);

    return { result: parsedResult };
  } catch (error) {
    console.error("Audit AI Error", error);
    throw new Error("Lỗi Audit: " + (error as Error).message);
  }
}

/**
 * Thực hiện nghiên cứu từ khóa (Research - Server Side)
 */
export async function runResearch(keyword: string, language: string, urls?: string[]) {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/research`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify({ keyword, language, urls }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Lỗi khi thực hiện nghiên cứu");
    }

    return data;
  } catch (error) {
    console.error("Research Error", error);
    throw new Error("Lỗi nghiên cứu: " + (error as Error).message);
  }
}

export async function createGuidelineFromFile(brandId: string, brandName: string, file: File, currentUser: any) {
  const authHeaders = await getAuthHeaders();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("brandId", brandId);
  formData.append("type", "guideline");
  formData.append("description", `Initial guideline for ${brandName}`);

  const res = await fetch(`${BASE_URL}/brand-manager?action=create-from-file`, {
    method: "POST",
    headers: {
      ...authHeaders
    },
    body: formData,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Upload guideline thất bại");
  }

  return data;
}

export async function scrapeWebsiteContent(url: string): Promise<any> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify({ url }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Không thể lấy nội dung từ link này");
  }
  return data; // Return full object: { success, text, metadata, audit, ... }
}

export async function createUserApi(payload: any, token: string) {
  // Token được truyền vào trực tiếp vì hàm này thường được gọi khi user context có thể đang được quản lý riêng
  const response = await fetch(`${BASE_URL}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...payload, action: 'create' }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Failed to create user");
  }
  return result;
}

export async function deleteUserApi(userId: string, token: string) {
  const response = await fetch(`${BASE_URL}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId, action: 'delete' }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Failed to delete user");
  }
  return result;
}

export async function approveGuideline(guidelineId: string, hasFile: boolean) {
  const authHeaders = await getAuthHeaders();
  const action = hasFile ? 'approve-and-ingest' : 'approve-text-and-ingest';
  const endpoint = `${BASE_URL}/brand-manager?action=${action}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify({ guidelineId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Approve thất bại");
  }
}

export async function addCommentToGeneration(generationId: string, user: any, content: string) {
  return db.collection('generations').doc(generationId).collection('comments').add({
    parentId: generationId,
    userId: user.uid,
    userName: user.name || user.displayName || user.email,
    userRole: user.role,
    content: content,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}
