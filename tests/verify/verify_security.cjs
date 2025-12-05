const http = require('http');
const crypto = require('crypto');

// Helpers
function makeRequest(path, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function test() {
  console.log('Starting security verification...');

  // 1. Test Body Limit
  const largeBody = JSON.stringify({ data: 'x'.repeat(2 * 1024 * 1024) }); // 2MB

  // Test on normal route (should fail with 413)
  try {
    const res1 = await makeRequest('/api/track', 'POST', largeBody);
    if (res1.statusCode === 413) {
      console.log('✅ PASS: Large body rejected on normal route');
    } else {
      console.log('❌ FAIL: Large body allowed on normal route (Status: ' + res1.statusCode + ')');
    }
  } catch (e) { console.log('Error testing normal route:', e.message); }

  // Test on import route (should pass validation of size, but might fail auth or schema, but not 413)
  // We need a session first for import routes usually, but let's see if we get 413 or 403/400
  try {
     // We expect 403 because we are not authenticated, but NOT 413 (Payload Too Large)
     // If the limit works, express body parser runs before auth middleware?
     // Actually, usually body parser is first.
     // So if limit is 200MB, it reads it, then passes to next(), then auth fails.
     // If limit is 1MB, it returns 413 immediately.

     // Let's send 2MB to /api/admin/import
     const res2 = await makeRequest('/api/admin/import', 'POST', largeBody);

     // If we configured it correctly, this should NOT return 413.
     if (res2.statusCode !== 413) {
        console.log('✅ PASS: Large body allowed (or at least not 413) on import route (Status: ' + res2.statusCode + ')');
     } else {
        console.log('❌ FAIL: Large body rejected on import route');
     }
  } catch (e) { console.log('Error testing import route:', e.message); }

}

test().catch(console.error);
