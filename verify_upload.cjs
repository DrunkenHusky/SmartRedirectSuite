const http = require('http');

// Helper to create a multipart request manually (simple version)
function makeMultipartRequest(path, bodySize) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

    // Create a dummy file body
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    // We want to simulate a large body.
    // However, if we just want to verify we DON'T get 413 from Express,
    // we can send a moderate size (e.g., 2MB) which is > 1MB default but < 5MB multer limit.
    // If Express blocks it (because of 1MB default limit being wrongly applied), we get 413.
    // If Express passes it, we might get 403 (Auth) or something else, but NOT 413.

    const dataSize = bodySize;
    const data = Buffer.alloc(dataSize, 'x');

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': header.length + dataSize + footer.length
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: responseData }));
    });

    req.on('error', reject);

    req.write(header);
    req.write(data);
    req.write(footer);
    req.end();
  });
}

async function test() {
  console.log('Testing Upload Request...');

  // Test 1: Upload 2MB file to /api/admin/logo/upload
  // Default limit is 1MB. Import/Upload limit is 200MB.
  // We expect this to PASS Express middleware (not 413).
  // It will likely fail with 403 (Auth) because we have no session.
  try {
    const res = await makeMultipartRequest('/api/admin/logo/upload', 2 * 1024 * 1024);

    if (res.statusCode === 413) {
      console.log('❌ FAIL: Got 413 Payload Too Large. Express middleware blocked the upload.');
    } else if (res.statusCode === 403) {
      console.log('✅ PASS: Got 403 Forbidden. This means the request passed the size check and reached Auth.');
    } else if (res.statusCode === 200 || res.statusCode === 500 || res.statusCode === 400) {
      console.log('✅ PASS: Request reached application logic (Status: ' + res.statusCode + ')');
    } else {
      console.log('❓ UNKNOWN: Got status ' + res.statusCode);
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
