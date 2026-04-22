
import { Brand, NlpIssue } from '../types';

/**
 * KHỐI THƯƠNG HIỆU - BLOCK 2 (HIGH PRIORITY)
 */
export const BrandService = {
  getInstructions: (brand: Brand) => {
    const dontWords = brand.dont_words && brand.dont_words.length > 0 ? brand.dont_words.join(', ') : "(None)";
    const doWords = brand.do_words && brand.do_words.length > 0 ? brand.do_words.join(', ') : "(None)";
    const styleRules = brand.style_rules || "No specific style rules.";

    return `
=== LAYER 2: BRAND IDENTITY (Source: Brand DB) ===
Use this data to check for Tone, Voice, and Forbidden Words.

1. **Brand Personality:** ${brand.personality || "Professional"}
2. **Brand Voice (Tone):** ${brand.voice || "Neutral"}
3. **Forbidden Words (Dont-Words):** ${dontWords}
4. **Encouraged Words (Do-Words):** ${doWords}
5. **Style Rules:** ${styleRules}

*REMINDER:* usage of arrows (→), plus signs (+), or casual abbreviations (teencode) implies a lack of formality. If Brand Voice is "Professional", these are BRAND ERRORS, not language errors.
`;
  },

  analyzeBrandCompliance: (text: string, brand: Brand): NlpIssue[] => {
    // Client-side regex check (Optional pre-check)
    const issues: NlpIssue[] = [];
    if (brand.dont_words && brand.dont_words.length > 0) {
      const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      brand.dont_words.forEach(word => {
        if (!word.trim()) return;
        const regex = new RegExp(`\\b${escapeRegExp(word.trim())}\\b`, 'gi');
        const match = text.match(regex);
        if (match) {
          issues.push({
            dimension: 'brand',
            severity: 'high',
            message: `Vi phạm từ cấm: "${match[0]}"`,
            problematic_text: match[0],
          });
        }
      });
    }
    return issues;
  }
};
