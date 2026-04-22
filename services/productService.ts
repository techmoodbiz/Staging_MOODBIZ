
import { Product, AuditRule } from '../types';

/**
 * KHỐI SẢN PHẨM - BLOCK 1 (HIGHEST PRIORITY)
 */
export const ProductService = {
  getInstructions: (products: Product | Product[], rules: AuditRule[] = []) => {
    const productList = Array.isArray(products) ? products : (products ? [products] : []);

    const productRules = rules.filter(r => r.type === 'product');
    const sopContent = productRules.length > 0
      ? productRules.map(r => `### MarkRule: ${r.label}\n${r.content}`).join('\n\n')
      : "";

    if (productList.length === 0) {
      return `
=== LAYER 1: PRODUCT INFO ===
*** STATUS: NO PRODUCT SELECTED ***
Instruction: Skip factual check against specific product specs. Only check generic claims.
${sopContent}
`;
    }

    const productContext = productList.map((p, index) => `
--- PRODUCT ${index + 1}: ${p.name} ---
- Type: ${p.type}
- Category: ${p.category}
- Benefits: ${p.benefits}
- USP: ${p.usp}
- Target Audience: ${p.target_audience}
${p.description ? `- Description: ${p.description}` : ''}
`).join('\n');

    return `
=== LAYER 1: PRODUCT INFO (Source: Product DB) ===
Use this data to check for Factual Accuracy. ANY deviation from these specs is a CRITICAL ERROR.

${productContext}

${sopContent}
`;
  }
};
