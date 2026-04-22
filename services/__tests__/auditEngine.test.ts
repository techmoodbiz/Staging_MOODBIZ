import { describe, it, expect } from 'vitest';
import { assembleAuditPrompt } from '../auditEngine';
import { AuditRule, Brand, Product } from '../../types';

describe('auditEngine: assembleAuditPrompt', () => {
    // Mock Data
    const mockBrand: Brand = {
        id: 'brand-1',
        name: 'Test Brand',
        personality: 'Friendly',
        voice: 'Professional',
        tone_of_voice: 'Warm'
    };

    const mockProduct: Product = {
        id: 'prod-1',
        brand_id: 'brand-1',
        name: 'Test Product',
        type: 'good',
        category: 'Tech',
        status: 'Active',
        target_audience: 'Everyone',
        benefits: 'Saves time',
        usp: 'Fastest',
        description: 'A great product'
    };

    const mockRules: AuditRule[] = [
        {
            id: 'rule-1',
            type: 'brand',
            code: 'B01',
            label: 'Tone Check',
            content: 'Must reflect brand tone.',
            updated_at: null
        },
        {
            id: 'rule-2',
            type: 'ai_logic',
            code: 'L01',
            label: 'No Hallucinations',
            content: 'Verify facts.',
            updated_at: null
        },
        {
            id: 'rule-3',
            type: 'legal',
            code: 'LEG01',
            label: 'No False Claims',
            content: 'Do not promise guaranteed results.',
            updated_at: null
        }
    ];

    it('should include all 4 modules in the prompt', () => {
        const payload = {
            text: 'Buy this amazing product now!',
            brand: mockBrand,
            product: mockProduct,
            rules: mockRules,
            language: 'vi',
            platform: 'Facebook'
        };

        const prompt = assembleAuditPrompt(payload);

        // Check for Module headers
        expect(prompt).toContain('MODULE 1: BRAND');
        expect(prompt).toContain('MODULE 2: PRODUCT');
        expect(prompt).toContain('MODULE 3: AI LOGIC');
        expect(prompt).toContain('MODULE 4: LEGAL');

        // Check for specific content inclusion
        expect(prompt).toContain('Test Product'); // Product Name
        expect(prompt).toContain('Friendly');     // Brand Personality (Brand Name is not in prompt)
        expect(prompt).toContain('No False Claims'); // Legal Rule Label
        expect(prompt).toContain('No Hallucinations'); // Logic Rule Label
    });

    it('should include Legal rules when provided (Dynamic SOPs)', () => {
        const payload = {
            text: 'Test',
            brand: mockBrand,
            rules: mockRules, // Contains a 'legal' rule
            language: 'vi',
            platform: 'Facebook'
        };

        const prompt = assembleAuditPrompt(payload);

        expect(prompt).toContain('### LegalRule: No False Claims');
        expect(prompt).toContain('Do not promise guaranteed results.');
    });

    it('should handle missing Legal rules gracefully', () => {
        const noLegalRules = mockRules.filter(r => r.type !== 'legal');
        const payload = {
            text: 'Test',
            brand: mockBrand,
            rules: noLegalRules,
            language: 'vi',
            platform: 'Facebook'
        };

        const prompt = assembleAuditPrompt(payload);

        expect(prompt).toContain('MODULE 4: LEGAL');
        expect(prompt).toContain('No specific Legal SOPs provided.');
        expect(prompt).not.toContain('### LegalRule:');
    });

    it('should include "legal" categories in the whitelist', () => {
        const payload = {
            text: 'Test',
            brand: mockBrand,
            rules: mockRules,
            language: 'vi',
            platform: 'Facebook'
        };

        const prompt = assembleAuditPrompt(payload);

        expect(prompt).toContain('"Legal Violation"');
        expect(prompt).toContain('"Legal SOP Violation"');
        expect(prompt).toContain('"Advertising Law Non-Compliance"');
    });
});
