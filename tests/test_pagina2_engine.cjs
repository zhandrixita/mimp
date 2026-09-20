// Verifies the browser engine against independently computed SPSS audit samples.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'pagina2/data/data.js'), 'utf8'), context);
const data = JSON.parse(JSON.stringify(context.window.DASH_DATA));
const audit = JSON.parse(fs.readFileSync(path.join(root, 'pagina2/data/validacion.json'), 'utf8'));
const engine = require('../pagina2/js/engine.js');
const all = { population: 'total', months: data.months.map(m => m.id), departments: data.departments.map((_, i) => i) };
for (const [population, expected] of Object.entries(audit.totals)) {
  const result = engine.aggregate(data, { ...all, population });
  assert.equal(result.total, expected);
  for (const field of data.fields) {
    assert.equal(engine.distribution(field, result).reduce((n, r) => n + r.count, 0), expected, `${population}/${field.id}`);
    const text = engine.interpret(field, result);
    assert(!text.includes('NaN') && !text.includes('Infinity'));
  }
}
for (const check of audit.filter_checks) {
  const result = engine.aggregate(data, check);
  assert.equal(result.total, check.total);
  assert.equal(result.monthly.reduce((a, b) => a + b, 0), result.total);
  assert.equal(result.territorial.reduce((a, b) => a + b, 0), result.total);
}
const empty = engine.aggregate(data, { population: 'lgtbi', months: [0, 4, 7], departments: [0, 5, 7, 18] });
assert.equal(empty.total, 0);
assert(engine.interpret(data.fields[0], empty).includes('No se registran casos'));
const synthetic = { id: 'TEST', labels: ['A', 'B', 'Sin registro'], offset: 0, size: 3, missingIndex: 2, yesIndex: -1 };
assert(engine.interpret(synthetic, { total: 10, vector: [5, 5, 0] }).includes('2 categorías comparten'));
assert(engine.interpret(synthetic, { total: 10, vector: [0, 0, 10] }).includes('No hay respuestas'));
assert.equal(data.audit.variables.length, 577);
assert.equal(data.fields.length, 390);
assert(data.fields.every(f => !/MOTIVO_CONSULTA|N_FICHA|APRECIACION_PROF/.test(f.id)));
console.log(`OK: ${data.fields.length} indicadores, 7 poblaciones, ${audit.filter_checks.length} filtros y casos vacíos/empates.`);
