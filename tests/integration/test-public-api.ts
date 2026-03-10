import request from 'supertest';
import express from 'express';
import assert from 'node:assert/strict';
import { registerRoutes } from '../../server/routes';

// Wir nutzen eine minimale Express-App für den Test
const app = express();
app.use(express.json());

async function runTests() {
  console.log('Setting up test server for Public API...');

  // Da die setup Funktion mit einer DB etc. interagiert und wir storage mocken
  // müssten, testen wir stattdessen die API Logik indirekt oder bauen
  // eine mock-Umgebung. Aber noch besser ist es, den tatsächlichen
  // Endpoint gegen einen laufenden oder hochgefahrenen Server zu testen.
  // Da der `server/routes.ts` code importierbar ist, können wir den request testen.

  // To properly test the endpoint without needing a fully running application with
  // a real storage implementation, we would need to mock `storage`.
  // However, this project is using `server/storage.ts` directly.

  // A simpler integration test would be to just spin up the actual app
  // or use `supertest` with a minimally configured app. Since `registerRoutes`
  // relies on `storage`, let's see if we can just test the route.

  try {
    const server = await registerRoutes(app);

    console.log('Testing POST /api/public/transform without url...');
    let res = await request(server).post('/api/public/transform').send({});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "Bitte geben Sie eine gültige 'url' als Parameter oder im Body an.");

    console.log('Testing POST /api/public/transform with body...');
    res = await request(server).post('/api/public/transform').send({ url: 'http://example.com/test' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.oldUrl === 'http://example.com/test');
    assert.ok('newUrl' in res.body);

    console.log('Testing POST /api/public/transform with query...');
    res = await request(server).post('/api/public/transform?url=http://example.com/test2');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.oldUrl === 'http://example.com/test2');
    assert.ok('newUrl' in res.body);

    console.log('All Public API tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

runTests();
