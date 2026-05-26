const http = require('http');

const API_URL = 'http://localhost:5000/api';

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Keyword Ranking Checker - API Tests\n');

  try {
    // Test 1: Check health
    console.log('1️⃣ Health Check...');
    let res = await makeRequest('GET', '/health');
    console.log(`   Status: ${res.status}, DB Ready: ${res.data.dbReady}\n`);

    // Test 2: Add a website
    console.log('2️⃣ Adding Website...');
    res = await makeRequest('POST', '/sites', {
      domain: 'moodbiz.vn',
      name: 'MoodBiz'
    });
    const siteId = res.data.id;
    console.log(`   Added: ${res.data.domain} (ID: ${siteId})\n`);

    // Test 3: Get sites
    console.log('3️⃣ Listing Websites...');
    res = await makeRequest('GET', '/sites');
    console.log(`   Found ${res.data.length} site(s)\n`);

    // Test 4: Add keywords
    console.log('4️⃣ Adding Keywords...');
    const keywords = ['keyword ranking checker', 'google rank tracker', 'seo tool'];
    for (const kw of keywords) {
      res = await makeRequest('POST', '/keywords', {
        siteId: siteId,
        keyword: kw
      });
      console.log(`   ✓ Added: "${kw}"`);
    }
    console.log();

    // Test 5: Get keywords
    console.log('5️⃣ Listing Keywords...');
    res = await makeRequest('GET', `/keywords/${siteId}`);
    console.log(`   Found ${res.data.length} keyword(s)\n`);

    // Test 6: Check single keyword (quick test)
    console.log('6️⃣ Quick Ranking Check (1 keyword)...');
    console.log('   Searching Google for "moodbiz.vn"...');
    res = await makeRequest('POST', '/check-keyword', {
      keyword: 'moodbiz.vn',
      domain: 'moodbiz.vn'
    });
    if (res.data.position) {
      console.log(`   ✓ Found at position: ${res.data.position}\n`);
    } else {
      console.log(`   ℹ Not in top 100 results\n`);
    }

    // Test 7: Batch ranking check
    console.log('7️⃣ Batch Ranking Check (all keywords)...');
    console.log('   ⚠️ This will take 1-2 minutes (includes delays to avoid Google blocking)\n');
    const startTime = Date.now();
    res = await makeRequest('POST', `/refresh/${siteId}`, {});
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`   ✓ Checked ${res.data.checked} keywords in ${duration}s`);
    console.log('   Results:');
    res.data.results.forEach((r, i) => {
      const status = r.position ? `Position #${r.position}` : 'Not ranked';
      console.log(`     ${i + 1}. "${r.keyword}" → ${status}`);
    });
    console.log();

    // Test 8: Get current rankings
    console.log('8️⃣ Current Rankings...');
    res = await makeRequest('GET', `/rankings/${siteId}`);
    console.log(`   Fetched ${res.data.length} ranking(s)\n`);
    res.data.slice(0, 3).forEach((r) => {
      const pos = r.position ? `#${r.position}` : 'Not ranked';
      console.log(`   • ${r.keyword}: ${pos}`);
    });

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📖 Next steps:');
    console.log('   1. Open client/index.html in a browser');
    console.log('   2. Add more websites and keywords');
    console.log('   3. Track ranking changes over time');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nMake sure the server is running:');
    console.error('  npm start');
    process.exit(1);
  }
}

// Wait for server to start
setTimeout(runTests, 2000);
