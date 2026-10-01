import supertest from 'supertest';
import express from 'express';
import session from 'express-session';
import { registerRoutes } from './server/routes.ts';
import fs from 'fs';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const requireAuth = (req: any, res: any, next: any) => {
    req.session = { isAdminAuthenticated: true }; // fake auth
    next();
};
app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));

async function run() {
  await registerRoutes(app);

  const testFile = Buffer.from('fake image data');
  fs.writeFileSync('test.png', testFile);

  const request = supertest(app);

  const res = await request
    .post('/api/admin/logo/upload')
    .attach('file', 'test.png');

  console.log('Upload response:', res.status, res.body);

  if (res.status === 200) {
     const putRes = await request
       .put('/api/admin/logo')
       .send({ logoUrl: res.body.uploadURL });
     console.log('Put logo response:', putRes.status, putRes.body);
  }

  fs.unlinkSync('test.png');
}

run().catch(console.error);
