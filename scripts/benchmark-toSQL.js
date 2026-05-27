
const Knex = require('../knex');
const { performance } = require('perf_hooks');

const knex = Knex({
  client: 'sqlite3',
  connection: { filename: ':memory:' },
  useNullAsDefault: true,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateIds(n) {
  const arr = new Array(n);
  for (let i = 0; i < n; i++) arr[i] = i;
  return arr;
}

function generateStrings(n) {
  const arr = new Array(n);
  for (let i = 0; i < n; i++) arr[i] = `value_${i}`;
  return arr;
}

function generateRows(n) {
  const arr = new Array(n);
  for (let i = 0; i < n; i++) {
    arr[i] = { name: `user_${i}`, email: `u${i}@test.com`, age: 20 + (i % 50) };
  }
  return arr;
}

// Pre-build data sets so allocation is not measured
const ids10 = generateIds(10);
const ids100 = generateIds(100);
const ids1000 = generateIds(1000);
const ids15000 = generateIds(15000);
const strings100 = generateStrings(100);
const rows50 = generateRows(50);
const rows500 = generateRows(500);

// ---------------------------------------------------------------------------
// Scenarios — each returns a builder (call .toSQL() to compile)
// ---------------------------------------------------------------------------

const scenarios = {
  // --- Selects at various scales ---
  'select simple (no params)': () =>
    knex('users').select('id', 'name', 'email'),

  'select where (1 param)': () =>
    knex('users').select('*').where('id', 1),

  'select whereIn 10 ids': () =>
    knex('users').select('id', 'name').whereIn('id', ids10),

  'select whereIn 100 ids': () =>
    knex('users').select('id', 'name').whereIn('id', ids100),

  'select whereIn 100 strings': () =>
    knex('users').select('id', 'name').whereIn('email', strings100),

  'select whereIn 1000 ids': () =>
    knex('users').select('id', 'name').whereIn('id', ids1000),

  'select complex (join+where+order)': () =>
    knex('users')
      .select('users.id', 'users.name', 'posts.title')
      .leftJoin('posts', 'users.id', 'posts.user_id')
      .where('users.active', true)
      .whereIn('users.id', ids100)
      .orderBy('users.id', 'desc'),

  'select whereIn 15000 ids': () =>
    knex('users')
      .select('id', 'name', 'email', 'created_at', 'updated_at')
      .whereIn('id', ids15000)
      .where('active', true)
      .leftJoin('posts', 'users.id', 'posts.user_id')
      .orderBy('users.id', 'desc'),

  // --- Inserts ---
  'insert single row': () =>
    knex('users').insert({ name: 'alice', email: 'a@b.com', age: 30 }),

  'insert 50 rows': () =>
    knex('users').insert(rows50),

  'insert 500 rows': () =>
    knex('users').insert(rows500),

  // --- Updates ---
  'update with where': () =>
    knex('users').where('id', 42).update({ name: 'bob', email: 'b@c.com' }),

  // --- Raw ---
  'raw select with array bindings': () =>
    knex.raw('SELECT * FROM users WHERE id IN (?) AND active = ?', [ids100, true]),

  'raw select with named bindings': () =>
    knex.raw('SELECT * FROM users WHERE id = :id AND email = :email', {
      id: 1,
      email: 'a@b.com',
    }),
};

// ---------------------------------------------------------------------------
// Correctness baseline — capture SQL + bindings before running timed loops
// ---------------------------------------------------------------------------

function captureBaseline() {
  const baseline = {};
  for (const [name, buildFn] of Object.entries(scenarios)) {
    const result = buildFn().toSQL();
    baseline[name] = {
      sql: Array.isArray(result) ? result.map((r) => r.sql) : result.sql,
      bindingCount: Array.isArray(result)
        ? result.reduce((sum, r) => sum + (r.bindings?.length ?? 0), 0)
        : result.bindings?.length ?? 0,
    };
  }
  return baseline;
}

function verifyCorrectness(baseline) {
  let pass = true;
  for (const [name, buildFn] of Object.entries(scenarios)) {
    const result = buildFn().toSQL();
    const sql = Array.isArray(result) ? result.map((r) => r.sql) : result.sql;
    const bindingCount = Array.isArray(result)
      ? result.reduce((sum, r) => sum + (r.bindings?.length ?? 0), 0)
      : result.bindings?.length ?? 0;

    const expected = baseline[name];
    const sqlMatch = JSON.stringify(sql) === JSON.stringify(expected.sql);
    const bindingsMatch = bindingCount === expected.bindingCount;

    if (!sqlMatch || !bindingsMatch) {
      console.error(`  FAIL: ${name}`);
      if (!sqlMatch) {
        console.error(`    SQL expected: ${JSON.stringify(expected.sql)}`);
        console.error(`    SQL actual:   ${JSON.stringify(sql)}`);
      }
      if (!bindingsMatch) {
        console.error(
          `    Bindings expected: ${expected.bindingCount}, actual: ${bindingCount}`
        );
      }
      pass = false;
    }
  }
  return pass;
}

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

function bench(name, buildFn, iterations) {
  // Warmup
  for (let i = 0; i < 10; i++) buildFn().toSQL();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    buildFn().toSQL();
  }
  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  return { elapsed, opsPerSec };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Scale iterations inversely with expected cost so each scenario takes ~1-2s
const iterationMap = {
  'select simple (no params)': 200_000,
  'select where (1 param)': 200_000,
  'select whereIn 10 ids': 100_000,
  'select whereIn 100 ids': 50_000,
  'select whereIn 100 strings': 50_000,
  'select whereIn 1000 ids': 10_000,
  'select complex (join+where+order)': 30_000,
  'select whereIn 15000 ids': 2_000,
  'insert single row': 200_000,
  'insert 50 rows': 20_000,
  'insert 500 rows': 2_000,
  'update with where': 200_000,
  'raw select with array bindings': 50_000,
  'raw select with named bindings': 100_000,
};

console.log('Capturing correctness baseline...');
const baseline = captureBaseline();

console.log('Verifying correctness...');
if (!verifyCorrectness(baseline)) {
  console.error('\nCorrectness check FAILED — aborting benchmark.');
  process.exit(1);
}
console.log('All scenarios produce correct output.\n');

console.log(
  `${'Scenario'.padEnd(42)} ${'ops/sec'.padStart(12)} ${'avg (µs)'.padStart(10)} ${'iters'.padStart(9)}`
);
console.log('-'.repeat(77));

for (const [name, buildFn] of Object.entries(scenarios)) {
  const iterations = iterationMap[name] || 10_000;
  const { elapsed, opsPerSec } = bench(name, buildFn, iterations);
  const avgUs = (elapsed / iterations) * 1000;
  console.log(
    `${name.padEnd(42)} ${opsPerSec.toFixed(0).padStart(12)} ${avgUs.toFixed(1).padStart(10)} ${String(iterations).padStart(9)}`
  );
}

console.log('-'.repeat(77));

// Final correctness re-check after all timed runs
console.log('\nPost-benchmark correctness re-check...');
if (verifyCorrectness(baseline)) {
  console.log('PASS — all scenarios still produce correct output.');
} else {
  console.error('FAIL — output drifted during benchmark run!');
  process.exit(1);
}

process.exit(0);
