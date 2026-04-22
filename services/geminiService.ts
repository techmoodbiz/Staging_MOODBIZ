
// Dịch vụ này hiện tại chỉ chứa các hàm helper (Utility) để xử lý JSON.
// Tất cả các lệnh gọi API tới Gemini đã được chuyển về Backend (Vercel Functions).

/**
 * Hàm sửa lỗi JSON string bằng thuật toán State Machine và Substring Extraction.
 */
function robustJsonRepair(jsonStr: string): string {
    let cleanStr = String(jsonStr);

    // 1. Trích xuất phần JSON chính (tìm cặp {} ngoài cùng)
    // Điều này loại bỏ các tiền tố như "Here is the JSON:" hoặc markdown ```json
    const firstBrace = cleanStr.indexOf('{');
    const lastBrace = cleanStr.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
        cleanStr = cleanStr.substring(firstBrace, lastBrace + 1);
    } else {
        // Nếu không tìm thấy cặp ngoặc, trả về nguyên bản để parse thử (có thể lỗi)
        return cleanStr.replace(/```json/gi, '').replace(/```/g, '').trim();
    }

    // 2. Xử lý các lỗi cú pháp phổ biến
    cleanStr = cleanStr
        .replace(/,(\s*[}\]])/g, '$1') // Xóa dấu phẩy thừa cuối mảng/object
        .replace(/\/\/.*$/gm, '') // Xóa comment JS
        .replace(/\n/g, ' ') // Xóa xuống dòng (đôi khi gây lỗi string)
        .replace(/\t/g, ' '); // Xóa tab

    return cleanStr;
}

// --- HELPER ---
export function safeJSONParse(input: any) {
    // Case 1: Input đã là Object
    if (typeof input === 'object' && input !== null) {
        return input;
    }

    // Case 2: Input rỗng hoặc không phải string
    if (!input || typeof input !== 'string') {
        return { summary: "Không nhận được dữ liệu phản hồi từ AI.", identified_issues: [] };
    }

    const tryParse = (str: string) => {
        try {
            return JSON.parse(str);
        } catch (e) {
            return null;
        }
    };

    // Strategy 1: Direct Parse
    let result = tryParse(input);
    if (result) return result;

    // Strategy 2: Advanced Repair
    const repaired = robustJsonRepair(input);
    result = tryParse(repaired);
    if (result) return result;

    // Strategy 3: Manual Fix for unquoted keys (Last Resort)
    try {
        const fixedKeys = repaired.replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');
        result = tryParse(fixedKeys);
        if (result) return result;
    } catch (e) { }

    // Strategy 4 (Fallback):
    console.warn('JSON Parse Failed completely. Falling back to raw text display.');

    // Thử trích xuất summary bằng regex nếu có thể
    let summary = "AI trả về kết quả nhưng cấu trúc không đúng định dạng JSON chuẩn.";
    const summaryMatch = input.match(/"summary"\s*:\s*"([^"]*)"/);
    if (summaryMatch && summaryMatch[1]) {
        summary = summaryMatch[1];
    } else if (input.length > 0) {
        summary = input.substring(0, 300) + "...";
    }

    return {
        summary: summary,
        identified_issues: [
            {
                category: "ai_logic",
                severity: "Low",
                problematic_text: "System Format Error",
                reason: "AI output was not valid JSON. Please check raw output.",
                suggestion: "Check Raw Output",
                citation: "System"
            }
        ],
        raw_response: input,
        is_fallback: true
    };
}
