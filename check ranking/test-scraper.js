const { searchGoogleRanking } = require('./modules/scraper');

async function runTest() {
  console.log('=== TEST SCRAPER GOOGLE RANKING ===\n');

  const tests = [
    { keyword: 'wikipedia tiếng việt', domain: 'vi.wikipedia.org' },
    { keyword: 'du lịch việt nam', domain: 'vietnam.travel' },
  ];

  for (const test of tests) {
    console.log(`\n📌 Keyword: "${test.keyword}"`);
    console.log(`📌 Domain:  ${test.domain}`);
    console.log('─'.repeat(50));

    const result = await searchGoogleRanking(test.keyword, test.domain);

    if (result.error) {
      console.log(`❌ Lỗi: ${result.error}`);
    } else {
      console.log(`📊 Số kết quả lấy được: ${result.totalFound}`);
      if (result.position) {
        console.log(`🏆 Thứ hạng: #${result.position}`);
      } else {
        console.log(`➖ "${test.domain}" không có trong top ${result.totalFound}`);
      }

      if (result.top10 && result.top10.length > 0) {
        console.log('\nTop 10 kết quả Google:');
        result.top10.forEach((r) => {
          try {
            const host = new URL(r.url).hostname;
            const mark = host.includes(test.domain.replace('www.', '')) ? ' ← ★ TARGET' : '';
            console.log(`  ${String(r.position).padStart(3)}. ${host}${mark}`);
          } catch (_) {}
        });
      }
    }

    await new Promise((r) => setTimeout(r, 4000));
  }

  console.log('\n=== TEST XONG ===');
}

runTest().catch(console.error);
