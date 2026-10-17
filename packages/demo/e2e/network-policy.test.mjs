import assert from 'node:assert/strict';
import test from 'node:test';
import { allowedRequest } from './isolation.mjs';

const config = { owner: 'http://localhost:3000', pos: 'http://localhost:3001' };
const accepts = (url, method = 'GET') => allowedRequest({ url: () => url, method: () => method }, config);

test('existing CSS/font resources allow Google Fonts query-based subsets without a provider whitelist', () => {
  for (const url of [
    'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap',
    'https://fonts.googleapis.com/css?family=JetBrains+Mono',
    'https://fonts.gstatic.com/s/dmsans/v17/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K4.woff2',
    'https://fonts.gstatic.com/l/font?kit=rP2-p2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopwDRUUHvP-6oMc49yvtf0DPCg&skey=cd068b3e1b767e51&v=v17',
  ]) {
    assert.equal(accepts(url), true, url);
    assert.equal(accepts(url, 'HEAD'), true, url);
    assert.equal(accepts(url, 'POST'), false, `No writes to a static font endpoint: ${url}`);
  }
});

test('business endpoints and foreign services remain forbidden even when shaped like static assets', () => {
  for (const url of [
    'http://localhost:3000/api/owner/products?isDemo=true',
    'http://localhost:3001/api/admin/orders',
    'https://rakku.vercel.app/demo?mode=pos',
    'https://example.supabase.co/rest/v1/products',
    'https://api.vessel.example/payments',
    'https://api.echo.example/send',
    'https://api.silos.example/images/product.woff2',
    'https://fonts.googleapis.com/api/send-email',
    'https://fonts.gstatic.com/api/payment.woff2',
    'https://fonts.gstatic.com/other/product.woff2',
    'https://fonts.googleapis.com.evil.invalid/css2',
    'https://fonts.gstatic.com:444/l/font?kit=subset',
    'http://fonts.gstatic.com/l/font?kit=subset',
    'http://localhost:3000/_next/image?url=https%3A%2F%2Fprovider.invalid%2Fimage.png',
  ]) assert.equal(accepts(url), false, url);
  assert.equal(accepts(`${config.owner}/demo`, 'POST'), false);
  assert.equal(accepts(`${config.pos}/login`, 'DELETE'), false);
  assert.equal(accepts(`${config.owner}/demo-assets/cafe.svg`, 'POST'), false);
});

test('real public documents, Next assets and local image optimization remain allowed', () => {
  for (const url of [
    `${config.owner}/demo`, `${config.pos}/demo`, `${config.owner}/demo/menu/pusat`,
    `${config.owner}/demo/menu/taman`, `${config.pos}/login`, `${config.pos}/sw.js`,
    `${config.pos}/~offline`, `${config.owner}/demo-assets/cafe.svg`,
    `${config.owner}/_next/static/chunks/app/demo/page-123abc.js`,
    `${config.owner}/_next/image?url=%2Fimages%2Frakku_logo.png&w=64&q=75`,
  ]) assert.equal(accepts(url), true, url);
});
