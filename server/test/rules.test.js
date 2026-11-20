import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseTables, overlaps, validEmail, validInterval } from '../src/rules.js';

test('email validation normalizes case and rejects malformed input', () => {
  assert.equal(validEmail('  Cafe.User@Example.com '), 'cafe.user@example.com');
  assert.equal(validEmail('not-an-email'), null);
});

test('reservation overlap uses half-open interval comparison', () => {
  assert.equal(overlaps('18:00', '19:30', '19:00', '20:30'), true);
  assert.equal(overlaps('18:00', '19:30', '19:30', '21:00'), false);
  assert.equal(overlaps('19:30', '21:00', '18:00', '19:30'), false);
});

test('table assignment selects one available table with enough seats', () => {
  const tables = [{table_id:3,capacity:4},{table_id:1,capacity:2},{table_id:2,capacity:2},{table_id:4,capacity:6}];
  assert.deepEqual(chooseTables(tables, 3).map(t=>t.table_id), [3]);
  assert.deepEqual(chooseTables(tables, 8), []);
  assert.deepEqual(chooseTables([...tables,{table_id:5,capacity:8}], 8).map(t=>t.table_id), [5]);
  assert.deepEqual(chooseTables(tables.slice(0,2), 9), []);
});

test('reservation must fit within branch hours', () => {
  assert.equal(validInterval('08:00:00','09:30:00','08:00:00','21:00:00'), true);
  assert.equal(validInterval('20:00:00','21:30:00','08:00:00','21:00:00'), false);
});
