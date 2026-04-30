const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

chromium.use(StealthPlugin());

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function cleanDomain(input) {
  try {
    let s = input.trim();
    if (!s.startsWith('http')) s = 'https://' + s;
    return new URL(s).hostname.replace(/^www\./, '').toLowerCase();
  } catch (_) {
    return input.replace(/^www\./, '').toLowerCase().split('/')[0].trim();
  }
}

function isGoogleDomain(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith('google.com') ||
      host.endsWith('google.com.vn') ||
      host.endsWith('googleapis.com') ||
      host.endsWith('googleusercontent.com') ||
      host.endsWith('gstatic.com') ||
      host.endsWith('youtube.com') // Bỏ qua YouTube (nếu muốn include thì xóa dòng này)
    );
  } catch (_) {
    return false;
  }
}

// Hàm kiểm tra 1 keyword với browser/context có sẵn
async function checkOneKeyword(page, keyword, targetDomain) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&num=100&hl=vi&gl=vn`;
  console.log(`  🔎 "${keyword}"`);

  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500 + Math.random() * 1000);

    const html = await page.content();

    // Phát hiện CAPTCHA: trang bị block thường rất ngắn và có marker cụ thể
    const isBlocked =
      html.length < 20000 &&
      (html.includes('solveSimpleChallenge') ||
        html.includes('id="captcha"') ||
        html.includes('detected unusual traffic'));

    if (isBlocked) {
      console.warn('  ⚠️  Bị CAPTCHA block');
      return { keyword, domain: targetDomain, position: null, error: 'CAPTCHA', timestamp: new Date() };
    }

    // Lấy kết quả từ trang
    const results = await page.evaluate(() => {
      const items = [];
      const seen = new Set();

      // Cách 1: lấy tất cả <a> có <h3> bên trong vùng #search
      document.querySelectorAll('#search a').forEach((a) => {
        const h3 = a.querySelector('h3');
        if (!h3) return;

        let href = a.getAttribute('href') || '';

        // Xử lý dạng /url?q=https://...
        if (href.startsWith('/url?')) {
          const match = href.match(/[?&]q=([^&]+)/);
          if (match) href = decodeURIComponent(match[1]);
        }

        if (!href.startsWith('http')) return;

        try {
          const url = new URL(href);
          const key = url.hostname + url.pathname;
          if (seen.has(key)) return;
          seen.add(key);
          items.push({ url: href, title: h3.textContent.trim() });
        } catch (_) {}
      });

      // Cách 2 (fallback): tìm các cite bên cạnh h3 để xây URL
      if (items.length < 5) {
        document.querySelectorAll('div.g').forEach((g) => {
          const a = g.querySelector('a[href]');
          if (!a) return;
          let href = a.getAttribute('href') || '';
          if (href.startsWith('/url?')) {
            const match = href.match(/[?&]q=([^&]+)/);
            if (match) href = decodeURIComponent(match[1]);
          }
          if (!href.startsWith('http')) return;
          try {
            const url = new URL(href);
            const key = url.hostname + url.pathname;
            if (seen.has(key)) return;
            seen.add(key);
            const h3 = g.querySelector('h3');
            items.push({ url: href, title: h3 ? h3.textContent.trim() : '' });
          } catch (_) {}
        });
      }

      return items;
    });

    // Lọc bỏ domain của Google
    const organic = results.filter((r) => !isGoogleDomain(r.url));

    // Gán thứ hạng
    const numbered = organic.map((r, i) => ({ ...r, position: i + 1 }));
    console.log(`     → Tìm được ${numbered.length} kết quả organic`);

    // Tìm domain mục tiêu
    const targetClean = cleanDomain(targetDomain);
    let position = null;

    for (const r of numbered) {
      if (cleanDomain(r.url) === targetClean) {
        position = r.position;
        break;
      }
    }

    return {
      keyword,
      domain: targetDomain,
      position,
      totalFound: numbered.length,
      top10: numbered.slice(0, 10),
      timestamp: new Date(),
    };
  } catch (err) {
    return { keyword, domain: targetDomain, position: null, error: err.message, timestamp: new Date() };
  }
}

// Kiểm tra 1 keyword (tạo browser mới)
async function searchGoogleRanking(keyword, targetDomain) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const context = await browser.newContext({
      userAgent: randomUA(),
      locale: 'vi-VN',
      viewport: { width: 1366, height: 768 },
      extraHTTPHeaders: {
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
      },
    });
    const page = await context.newPage();
    return await checkOneKeyword(page, keyword, targetDomain);
  } finally {
    await browser.close();
  }
}

// Kiểm tra nhiều keywords — dùng CHUNG 1 browser để tránh bị block
async function searchMultipleKeywords(keywords, domain) {
  const results = [];

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const context = await browser.newContext({
      userAgent: randomUA(),
      locale: 'vi-VN',
      viewport: { width: 1366, height: 768 },
      extraHTTPHeaders: {
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
      },
    });
    const page = await context.newPage();

    for (let i = 0; i < keywords.length; i++) {
      console.log(`\n[${i + 1}/${keywords.length}]`);
      const result = await checkOneKeyword(page, keywords[i], domain);
      results.push(result);

      // Log kết quả
      if (result.position) {
        console.log(`     ✅ Thứ hạng: #${result.position}`);
      } else if (result.error === 'CAPTCHA') {
        console.log(`     ❌ CAPTCHA — dừng session này`);
        break; // Dừng khi bị block
      } else {
        console.log(`     ➖ Không có trong top ${result.totalFound || 100}`);
      }

      // Delay ngẫu nhiên giữa các từ khóa (4–8 giây)
      if (i < keywords.length - 1) {
        const ms = 4000 + Math.random() * 4000;
        console.log(`     ⏳ Chờ ${(ms / 1000).toFixed(1)}s...`);
        await new Promise((r) => setTimeout(r, ms));
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

module.exports = { searchGoogleRanking, searchMultipleKeywords, findRankingForDomain: () => null };
