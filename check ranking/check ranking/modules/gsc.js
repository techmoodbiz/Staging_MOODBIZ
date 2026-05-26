const { google } = require('googleapis');
const path = require('path');

const CREDENTIALS_PATH = path.join('D:\\ViberCode\\mcp-server-gsc\\credentials\\searchconsonle-mb-57028b13e75b.json');

function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  return auth;
}

// Lấy danh sách sites trong GSC
async function listSites() {
  const auth = getAuthClient();
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const res = await searchconsole.sites.list();
  return res.data.siteEntry || [];
}

// Lấy thứ hạng cho 1 keyword cụ thể
async function getKeywordRanking(siteUrl, keyword, days = 28) {
  const auth = getAuthClient();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const fmt = (d) => d.toISOString().split('T')[0];

  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['query'],
        dimensionFilterGroups: [{
          filters: [{
            dimension: 'query',
            operator: 'equals',
            expression: keyword,
          }],
        }],
        rowLimit: 1,
      },
    });

    const rows = res.data.rows || [];
    if (rows.length === 0) {
      return {
        keyword,
        siteUrl,
        position: null,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        found: false,
      };
    }

    const row = rows[0];
    return {
      keyword,
      siteUrl,
      position: Math.round(row.position),  // GSC trả về vị trí trung bình
      positionExact: row.position,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: (row.ctr * 100).toFixed(2),
      found: true,
      period: `${fmt(startDate)} → ${fmt(endDate)}`,
    };
  } catch (err) {
    return {
      keyword,
      siteUrl,
      position: null,
      error: err.message,
      found: false,
    };
  }
}

// Lấy thứ hạng cho nhiều keywords
async function getMultipleKeywordRankings(siteUrl, keywords, days = 28) {
  const results = [];

  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    console.log(`  [${i + 1}/${keywords.length}] "${kw}"`);
    const result = await getKeywordRanking(siteUrl, kw, days);

    if (result.found) {
      console.log(`    ✅ Vị trí: #${result.position} | Clicks: ${result.clicks} | Impressions: ${result.impressions}`);
    } else if (result.error) {
      console.log(`    ❌ Lỗi: ${result.error}`);
    } else {
      console.log(`    ➖ Không có dữ liệu (chưa xuất hiện trong kết quả tìm kiếm)`);
    }

    results.push(result);

    // Nhỏ delay để tránh rate limit
    if (i < keywords.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}

// Lấy top keywords đang rank cho site
async function getTopKeywords(siteUrl, limit = 50, days = 28) {
  const auth = getAuthClient();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const fmt = (d) => d.toISOString().split('T')[0];

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      dimensions: ['query'],
      orderBy: [{ fieldName: 'impressions', sortOrder: 'descending' }],
      rowLimit: limit,
    },
  });

  return (res.data.rows || []).map((row) => ({
    keyword: row.keys[0],
    position: Math.round(row.position),
    positionExact: row.position,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: (row.ctr * 100).toFixed(2),
  }));
}

module.exports = { listSites, getKeywordRanking, getMultipleKeywordRankings, getTopKeywords };
