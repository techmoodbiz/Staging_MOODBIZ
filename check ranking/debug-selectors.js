const { chromium } = require('playwright');

async function debugSelectors() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    locale: 'vi-VN',
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const keyword = 'vietnam travel guide';
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&num=100&hl=vi`;
  console.log('Opening:', searchUrl);

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Debug: thử nhiều selectors khác nhau
  const debug = await page.evaluate(() => {
    const data = {};

    // Thử các selector phổ biến
    data['#rso > div'] = document.querySelectorAll('#rso > div').length;
    data['div.g'] = document.querySelectorAll('div.g').length;
    data['div.tF2Cxc'] = document.querySelectorAll('div.tF2Cxc').length;
    data['div[data-hveid]'] = document.querySelectorAll('div[data-hveid]').length;
    data['h3 > a'] = document.querySelectorAll('h3 > a').length;
    data['#search a[href^="http"]'] = document.querySelectorAll('#search a[href^="http"]').length;
    data['a[jsname]'] = document.querySelectorAll('a[jsname]').length;
    data['#rso'] = document.querySelectorAll('#rso').length;
    data['[data-snf]'] = document.querySelectorAll('[data-snf]').length;

    // Lấy URL của các kết quả tìm thấy qua h3 links
    const urls = [];
    document.querySelectorAll('#search h3').forEach(h3 => {
      const a = h3.closest('a') || h3.querySelector('a');
      if (a && a.href && a.href.startsWith('http') && !a.href.includes('google.com')) {
        const host = new URL(a.href).hostname;
        urls.push(host);
      }
    });
    data['urls_via_h3'] = urls.slice(0, 20);

    // Thử lấy tất cả các link trong #search không phải google
    const externalLinks = [];
    document.querySelectorAll('#search a[href^="http"]').forEach(a => {
      if (!a.href.includes('google.com') && !a.href.includes('googleapis')) {
        const h3 = a.querySelector('h3');
        if (h3) {
          externalLinks.push({
            url: a.href,
            title: h3.textContent.trim().substring(0, 80)
          });
        }
      }
    });
    data['external_links_with_h3'] = externalLinks;

    return data;
  });

  console.log('\n=== DEBUG SELECTORS ===');
  Object.entries(debug).forEach(([key, val]) => {
    if (typeof val === 'number') {
      console.log(`  ${key}: ${val} phần tử`);
    }
  });

  console.log('\n=== URLs tìm được qua h3 ===');
  debug.urls_via_h3.forEach((u, i) => console.log(`  ${i+1}. ${u}`));

  console.log('\n=== External links với h3 ===');
  debug.external_links_with_h3.forEach((r, i) => {
    try {
      const host = new URL(r.url).hostname;
      console.log(`  ${i+1}. ${host} — ${r.title}`);
    } catch(_) {}
  });

  // Lưu HTML để phân tích
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('D:/ViberCode/check ranking/debug-page.html', html);
  console.log('\nĐã lưu HTML → debug-page.html');

  await browser.close();
}

debugSelectors().catch(console.error);
