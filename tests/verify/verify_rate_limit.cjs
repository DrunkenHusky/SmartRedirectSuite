const http = require('http');

function makeRequest(path, count) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      res.resume();
      resolve(res.statusCode);
    });

    req.on('error', reject);
    req.write(JSON.stringify({ path: '/test-' + count }));
    req.end();
  });
}

async function test() {
  console.log('Testing Rate Limiting...');

  // The apiRateLimiter is set to 100 requests per minute for /api/check-rules
  // Sending 101 requests should trigger 429 on the last one.
  // Ideally, we don't want to spam 101 requests in this test script if it takes too long.
  // But let's try a smaller batch to ensure 200 OK first, then maybe check headers.

  // Actually, checking headers is better.
  const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/check-rules',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
  };

  const req = http.request(options, (res) => {
    console.log('Response Status:', res.statusCode);
    console.log('X-RateLimit-Limit:', res.headers['x-ratelimit-limit']);
    console.log('X-RateLimit-Remaining:', res.headers['x-ratelimit-remaining']);
    res.resume();
  });

  req.write(JSON.stringify({ path: '/test' }));
  req.end();
}

test();
