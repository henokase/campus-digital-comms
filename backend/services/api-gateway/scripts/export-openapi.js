const fs = require('node:fs');
const path = require('node:path');

const { buildSwaggerSpec } = require('../src/swagger');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function main() {
  const spec = buildSwaggerSpec();

  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const outDir = path.join(repoRoot, 'docs', 'api');
  const outFile = path.join(outDir, 'api-gateway.openapi.json');

  ensureDir(outDir);

  fs.writeFileSync(outFile, JSON.stringify(spec, null, 2) + '\n', 'utf8');
  process.stdout.write(`Wrote OpenAPI spec to ${outFile}\n`);
}

main();
