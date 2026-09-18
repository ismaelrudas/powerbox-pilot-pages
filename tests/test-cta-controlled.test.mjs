/**
 * Prueba estática de test/cta.html (superficie de PRUEBA CONTROLADA, inbox 3): se ejecuta el bloque <script> real
 * con stubs de window/document, sin navegador y sin red. Exigencias de Dirección (powerbox-salesia#19, 5729444925):
 * noindex, copy inequívoco de prueba controlada, token del inbox 3 (distinto del de cta.html) y marcador
 * pbx_interaction=controlled_test siempre presente. Nunca imprime ningún website token.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'test', 'cta.html'), 'utf8');
const real = readFileSync(join(root, 'cta.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/u)[1];
const tokenDecl = script.match(/var WEBSITE_TOKEN = '([^']*)'/u);
const realTokenDecl = real.match(/var WEBSITE_TOKEN = '([^']*)'/u);
const FIXTURE_TOKEN = 'static-fixture-token-000';
const BASE_URL = 'https://ismaels-imac.taildb7c09.ts.net';
const VALID_A = 'pbx_VeCJLxv_ujvxWemBjm5p-A';

function run(search, token = FIXTURE_TOKEN) {
  const code = script.replace(tokenDecl[0], `var WEBSITE_TOKEN = '${token}'`);
  const listeners = {};
  let ranWith = null;
  let attrs = null;
  const window = {
    location: { search },
    addEventListener: (name, fn) => { listeners[name] = fn; },
    $chatwoot: { setConversationCustomAttributes: (a) => { attrs = a; } },
    chatwootSDK: { run: (o) => { ranWith = o; } },
  };
  const document = { createElement: () => ({}), head: { appendChild: (s) => { if (s.onload) s.onload(); } } };
  new Function('window', 'document', 'URLSearchParams', code)(window, document, URLSearchParams);
  if (listeners['chatwoot:ready']) listeners['chatwoot:ready']();
  return { ranWith, attrs };
}

test('la página se excluye de los buscadores y se declara prueba controlada sin ambigüedad', () => {
  assert.match(html, /<meta name="robots" content="noindex, nofollow(, noarchive)?">/u);
  assert.match(html, /<title>PRUEBA CONTROLADA/u);
  assert.match(html, /no es un canal comercial/u);
  assert.match(html, /Nada se responde automáticamente/u);
});

test('monta el widget con un token propio: ni el marcador de posición ni el del inbox del piloto', () => {
  assert.ok(tokenDecl, 'declaración del token ausente');
  assert.ok(!tokenDecl[1].startsWith('__'), 'el marcador de posición sigue en la página');
  assert.notEqual(tokenDecl[1], realTokenDecl[1], 'la prueba controlada no puede usar el inbox del piloto');
  const { ranWith } = run('');
  assert.deepEqual(ranWith, { websiteToken: FIXTURE_TOKEN, baseUrl: BASE_URL });
});

test('el marcador controlled_test va siempre, aunque la URL no lo pida o intente otra cosa', () => {
  assert.deepEqual(run('').attrs, { pbx_interaction: 'controlled_test' });
  assert.deepEqual(run('?pbx_interaction=real_market').attrs, { pbx_interaction: 'controlled_test' });
  assert.deepEqual(run(`?ref=${VALID_A}`).attrs, { pbx_interaction: 'controlled_test', pbx_origin: VALID_A });
  assert.deepEqual(run('?ref=no-valido').attrs, { pbx_interaction: 'controlled_test' });
});

test('con el marcador de posición no se monta nada', () => {
  const { ranWith, attrs } = run('', '__PBX_INBOX3_WEBSITE_TOKEN__');
  assert.equal(ranWith, null);
  assert.equal(attrs, null);
});
