/**
 * Google Custom Search API
 * Miễn phí 100 queries/ngày
 * Cần setup: https://developers.google.com/custom-search/v1/introduction
 *
 * Cách lấy API key:
 * 1. Vào https://console.cloud.google.com → Tạo project
 * 2. Bật "Custom Search API"
 * 3. Tạo API Key ở "Credentials"
 * 4. Vào https://cse.google.com → Tạo Search Engine (chọn "Search entire web")
 * 5. Copy Search Engine ID (CX)
 * 6. Điền vào file .env: GOOGLE_API_KEY=... và GOOGLE_CX=...
 */

const axios = require('axios');

function cleanDomain(input) {
  try {
    let s = input.trim();
    if (!s.startsWith('http')) s = 'https://' + s;
    return new URL(s).hostname.replace(/^www\./, '').toLowerCase();
  } catch (_) {
    return input.replace(/^www\./, '').toLowerCase().split('/')[0].trim();
  }
}

async function searchWithAPI(keyword, targetDomain, maxResults = 100) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;

  if (!apiKey || !cx) {
    return { error: 'NO_API_KEY', keyword, domain: targetDomain, position: null };
  }

  const allItems = [];

  // API trả tối đa 10 kết quả/lần → cần lặp để lấy top 100
  const pages = Math.ceil(maxResults / 10); // 10 pages cho top 100

  for (let page = 0; page < pages; page++) {
    const start = page * 10 + 1; // 1, 11, 21, ...91
    try {
      const res = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: apiKey,
          cx: cx,
          q: keyword,
          num: 10,
          start: start,
          hl: 'vi',
          gl: 'vn',
        },
        timeout: 10000,
      });

      const items = res.data.items || [];
      items.forEach((item, i) => {
        allItems.push({
          position: start + i,
          url: item.link,
          title: item.title,
          snippet: item.snippet || '',
        });
      });

      // Nếu ít hơn 10 kết quả → không có trang tiếp theo
      if (items.length < 10) break;

      // Delay nhỏ giữa các page
      if (page < pages - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        console.warn('  ⚠️  API hết quota ngày hôm nay (100 queries/day)');
        break;
      }
      if (status === 400 && start > 100) {
        break; // Google CSE giới hạn tới start=91
      }
      console.error(`  API lỗi page ${page + 1}:`, err.message);
      break;
    }
  }

  // Tìm vị trí của domain mục tiêu
  const targetClean = cleanDomain(targetDomain);
  let position = null;

  for (const item of allItems) {
    if (cleanDomain(item.url) === targetClean) {
      position = item.position;
      break;
    }
  }

  return {
    keyword,
    domain: targetDomain,
    position,
    totalFound: allItems.length,
    top10: allItems.slice(0, 10),
    source: 'api',
    timestamp: new Date(),
  };
}

module.exports = { searchWithAPI };
