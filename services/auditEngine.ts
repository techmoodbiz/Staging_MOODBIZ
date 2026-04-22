
import { Brand, Product, AuditRule, NlpResponse } from '../types';
import { BrandService } from './brandService';
import { ProductService } from './productService';

export const assembleAuditPrompt = (payload: {
   text: string,
   brand: Brand,
   product?: Product,
   products?: Product[],
   rules: AuditRule[],
   language: string,
   platform: string,
   nlp?: NlpResponse,
   platformRules?: string
}) => {
   const { text, brand, product, products, rules, platformRules } = payload;
   const targetProducts = products || (product ? [product] : []);

   const safeText = text.replace(/"""/g, '"').trim();

   // --- BUILD CITATION WHITELIST ---
   const sopLabels = rules.map(r => r.label);

   const implicitLabels: string[] = [
      "Brand Voice Compliance",
      "Brand Personality Compliance",
      "Forbidden Words Violation",
      "Product Accuracy Violation",
      "Product USP Violation"
   ];
   const allowedCitations = [...sopLabels, ...implicitLabels];
   const whitelistJson = JSON.stringify(allowedCitations);

   // --- 1. PRODUCT & BRAND CONTEXT (From Services) ---
   const productInstructions = ProductService.getInstructions(targetProducts, rules);
   const brandInstructions = BrandService.getInstructions(brand);

   // --- 2. LOGIC MODULE (Module #3) ---
   const logicRules = rules.filter(r => r.type === 'ai_logic');
   const logicContent = logicRules.length > 0
      ? logicRules.map(r => `### MarkRule: ${r.label}\n${r.content}`).join('\n\n')
      : "No specific AI Logic SOPs provided. Check for internal contradictions and hallucinations.";

   const logicSection = `
=== MODULE 3: AI LOGIC (Reasoning & Hallucination) ===
Use this data to check for Reasoning errors, Contradictions, and Hallucinations.
${logicContent}
`;

   // --- 3. LEGAL MODULE (Module #4) ---
   const legalRules = rules.filter(r => r.type === 'legal');
   const legalContent = legalRules.length > 0
      ? legalRules.map(r => `### LegalRule: ${r.label}\n${r.content}`).join('\n\n')
      : "No specific Legal SOPs provided.";

   const legalSection = `
=== MODULE 4: LEGAL ===
**COMPLIANCE CHECK**
You must audit based on the provided Legal SOPs below.

${legalContent}

If you find a violation, use category "legal".
`;

   return `
BẠN LÀ HỆ THỐNG AUDIT NỘI DUNG ĐA TẦNG (MULTI-LAYER AUDIT SYSTEM).

*** NHIỆM VỤ ***
Kiểm tra văn bản input dựa trên các MODULES độc lập dưới đây.

*** MODULE 1: BRAND (Thương hiệu) ***
${brandInstructions}
-> Lỗi Brand: Sai tone, sai từ ngữ cấm, sai phong cách.

*** MODULE 2: PRODUCT (Sản phẩm) ***
${productInstructions}
${targetProducts.length === 0 ? '-> LƯU Ý: KHÔNG CÓ SẢN PHẨM NÀO ĐƯỢC CHỌN. TUYỆT ĐỐI KHÔNG kiểm tra thông số kỹ thuật hay tính năng cụ thể. Bỏ qua mọi nghi ngờ về tính xác thực của sản phẩm.' : '-> Lỗi Product: Sai thông số, sai tính năng, sai USP dựa trên dữ liệu thật được cung cấp ở trên.'}

${logicSection}
-> Lỗi AI Logic: Mâu thuẫn, suy diễn sai, ảo giác (hallucination).

${legalSection}
-> Lỗi Legal: Vi phạm luật quảng cáo, tuyên bố sai sự thật (false claims).

${platformRules ? `*** MODULE 5: PLATFORM RULES (${payload.platform}) ***
${platformRules}
-> Áp dụng các quy tắc riêng của platform khi phân loại lỗi.
` : ''}

(Lưu ý: Module "Language" kiểm tra chính tả được thực hiện bởi module khác).

*** NGUYÊN TẮC CỐT LÕI ***
1. CHỈ sử dụng thông tin được cung cấp trong Modules này. TUYỆT ĐỐI không sử dụng kiến thức bên ngoài (World Knowledge) để bắt bẻ số liệu nếu số liệu đó không mâu thuẫn với thông tin được cung cấp.
2. Nếu không vi phạm văn bản hướng dẫn phía trên -> KHÔNG ĐƯỢC tạo lỗi.
3. Citation PHẢI thuộc Whitelist: ${whitelistJson}

*** QUY TẮC PHÂN LOẠI (CATEGORY MAPPING) ***
- Lỗi Tone/Voice/Style -> category: "brand"
- Lỗi Thông tin Sản phẩm/Tính năng/Thông số -> category: "product"
- Lỗi Logic/Hallucination/Mâu thuẫn nội bộ -> category: "ai_logic"
- Lỗi Luật/Pháp lý/Quảng cáo -> category: "legal"

*** VĂN BẢN CẦN AUDIT ***
"""
${safeText}
"""
`;
};
