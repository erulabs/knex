#!/usr/bin/env node

'use strict';

const { execFileSync } = require('child_process');
const { readFileSync, readdirSync, unlinkSync, mkdirSync } = require('path')
  ? require('fs')
  : null;
const path = require('path');

const PROFILE_DIR = path.join(__dirname, '..', 'profiles');
const BENCHMARK_SCRIPT = path.join(__dirname, 'benchmark-toSQL.js');

function ensureProfileDir() {
  try {
    mkdirSync(PROFILE_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

function cleanOldProfiles() {
  try {
    for (const f of readdirSync(PROFILE_DIR)) {
      if (f.endsWith('.cpuprofile')) {
        unlinkSync(path.join(PROFILE_DIR, f));
      }
    }
  } catch {
    // nothing to clean
  }
}

function runBenchmarkWithProfiling() {
  console.log('Running benchmark with CPU profiling enabled...\n');
  const output = execFileSync(
    process.execPath,
    ['--cpu-prof', '--cpu-prof-dir', PROFILE_DIR, BENCHMARK_SCRIPT],
    { encoding: 'utf8', timeout: 120_000 }
  );
  process.stdout.write(output);
}

function findLatestProfile() {
  const files = readdirSync(PROFILE_DIR)
    .filter((f) => f.endsWith('.cpuprofile'))
    .map((f) => ({
      name: f,
      path: path.join(PROFILE_DIR, f),
      mtime: require('fs').statSync(path.join(PROFILE_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    throw new Error('No .cpuprofile files found in ' + PROFILE_DIR);
  }
  return files[0].path;
}

function analyzeProfile(profilePath) {
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  const { nodes, samples } = profile;

  const nodeMap = new Map();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Count how many times each node appears as the leaf (self-time)
  const sampleCounts = new Map();
  for (const s of samples) {
    sampleCounts.set(s, (sampleCounts.get(s) || 0) + 1);
  }

  // Aggregate by function identity (name + location)
  const funcSelf = new Map();
  for (const [nodeId, count] of sampleCounts) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;
    const { functionName, url, lineNumber } = node.callFrame;
    const key = `${functionName || '(anonymous)'}\t${url}:${lineNumber}`;
    funcSelf.set(key, (funcSelf.get(key) || 0) + count);
  }

  const sorted = [...funcSelf.entries()].sort((a, b) => b[1] - a[1]);
  const totalSamples = samples.length;

  console.log('\n' + '='.repeat(110));
  console.log(' CPU Profile: Top 25 functions by self-time');
  console.log('='.repeat(110));
  console.log(
    `${'%'.padStart(7)}  ${'samples'.padStart(7)}  ${'function'.padEnd(40)}  location`
  );
  console.log('-'.repeat(110));

  for (const [key, count] of sorted.slice(0, 25)) {
    const [funcName, location] = key.split('\t');
    const pct = ((count / totalSamples) * 100).toFixed(1);
    const shortLoc = location.replace(/.*\/knex\//, '');
    console.log(
      `${(pct + '%').padStart(7)}  ${String(count).padStart(7)}  ${funcName.padEnd(40)}  ${shortLoc}`
    );
  }

  console.log('-'.repeat(110));
  console.log(`Total samples: ${totalSamples}`);
  console.log(`Profile: ${profilePath}`);
  console.log('='.repeat(110));
}

// --- Main ---
ensureProfileDir();
cleanOldProfiles();
runBenchmarkWithProfiling();
const profilePath = findLatestProfile();
analyzeProfile(profilePath);
