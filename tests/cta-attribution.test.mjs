/**
 * Prueba estática de cta.html: se ejecuta el bloque <script> real de la página con stubs de window/document,
 * sin navegador y sin red. Cubre la resolución de origen exigida por Dirección (powerbox-salesia#19, 5718253320):
 * validar cada candidato, preferir pbx_origin válido y, si no, ref válido; pbx_interaction sólo degrada.
 * Nunca imprime el website token.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'cta.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/u)[1];
const tokenDecl = script.match(/var WEBSITE_TOKEN = '([^']*)'/u);
const PLACEHOLDER = '__PBX_CHATWOOT_WEBSITE_TOKEN__';
const FIXTURE_TOKEN = 'static-fixture-token-000';
const BASE_URL = 'https://ismaels-imac.taildb7c09.ts.net';
const VALID_A = 'pbx_VeCJLxv_ujvxWemBjm5p-A';
const VALID_B = 'pbx_0123456789abcdefghijkl';

function run(search, token = FIXTURE_TOKEN) {
  const code = script.replace(tokenDecl[0], `var WEBSITE_TOKEN = '${token}'`);
  const listeners = {};
  const appended = [];
  let ranWith = null;
  let attrs = null;
  const window = {
    location: { search },
    addEventListener: (name, fn) => { listeners[name] = fn; },
    $chatwoot: { setConversationCustomAttributes: (a) => { attrs = a; } },
    chatwootSDK: { run: (o) => { ranWith = o; } },
  };
  const document = {
    createElement: () => ({}),
    head: { appendChild: (s) => { appended.push(s.src); if (s.onload) s.onload(); } },
  };
  new Function('window', 'document', 'URLSearchParams', code)(window, document, URLSearchParams);
  if (listeners['chatwoot:ready']) listeners['chatwoot:ready']();
  return {
    mounted: appended.length === 1 && appended[0] === `${BASE_URL}/packs/js/sdk.js`,
    ranOk: ranWith !== null && ranWith.websiteToken === token && ranWith.baseUrl === BASE_URL,
    attrs,
  };
}

test('HEAD lleva un website token con forma válida, no el marcador', () => {
  assert.notEqual(tokenDecl[1], PLACEHOLDER);
  assert.match(tokenDecl[1], /^[A-Za-z0-9_-]{8,128}$/u);
});

test('ref válido → pbx_origin', () => {
  const r = run(`?ref=${VALID_A}`);
  assert.equal(r.mounted, true); assert.equal(r.ranOk, true);
  assert.deepEqual(r.attrs, { pbx_origin: VALID_A });
});

test('pbx_origin válido → pbx_origin', () => {
  assert.deepEqual(run(`?pbx_origin=${VALID_A}`).attrs, { pbx_origin: VALID_A });
});

test('pbx_origin válido y ref válido distintos → gana pbx_origin', () => {
  assert.deepEqual(run(`?pbx_origin=${VALID_A}&ref=${VALID_B}`).attrs, { pbx_origin: VALID_A });
});

test('pbx_origin inválido + ref válido → gana el ref válido', () => {
  assert.deepEqual(run(`?pbx_origin=not-a-token&ref=${VALID_A}`).attrs, { pbx_origin: VALID_A });
  assert.deepEqual(run(`?pbx_origin=&ref=${VALID_A}`).attrs, { pbx_origin: VALID_A });
});

test('token malformado (en ref, en pbx_origin o en ambos) → no se reenvía nada', () => {
  assert.equal(run('?ref=<script>alert(1)</script>').attrs, null);
  assert.equal(run('?ref=pbx_tooshort').attrs, null);
  assert.equal(run(`?pbx_origin=${VALID_A}x`).attrs, null);
  assert.equal(run('?pbx_origin=bad&ref=worse').attrs, null);
  assert.equal(run('').attrs, null);
});

test('controlled_test se reenvía, con o sin origen', () => {
  assert.deepEqual(run(`?ref=${VALID_A}&pbx_interaction=controlled_test`).attrs, { pbx_origin: VALID_A, pbx_interaction: 'controlled_test' });
  assert.deepEqual(run('?pbx_interaction=controlled_test').attrs, { pbx_interaction: 'controlled_test' });
});

test('intento de real_market (u otro valor) desde el navegador → ignorado', () => {
  assert.deepEqual(run(`?ref=${VALID_A}&pbx_interaction=real_market`).attrs, { pbx_origin: VALID_A });
  assert.deepEqual(run(`?ref=${VALID_A}&pbx_interaction=Controlled_Test`).attrs, { pbx_origin: VALID_A });
});

test('marcador sin activar → no carga el SDK, no arranca, no fija atributos', () => {
  const r = run(`?ref=${VALID_A}`, PLACEHOLDER);
  assert.equal(r.mounted, false); assert.equal(r.ranOk, false); assert.equal(r.attrs, null);
});

test('la página no toca index.html ni s/: sólo cta.html monta el widget', () => {
  const index = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
  assert.equal(index.includes('chatwootSDK'), false);
});
