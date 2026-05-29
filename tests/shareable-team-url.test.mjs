import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShareTeamUrl,
  decodeTeamFromUrl,
  encodeTeamForUrl,
  replaceTeamUrlState
} from '../src/core/shareableTeamUrl.js';

const team = [
  { pokemon_id: 'PKMN_0038_ALOLA', moves: ['aurora-veil'], item_id: 'light-clay' },
  null,
  { pokemon_id: 'PKMN_0115', moves: ['fake-out'] }
];

test('encodes and decodes a six-slot share payload', () => {
  const encoded = encodeTeamForUrl(team);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  const decoded = decodeTeamFromUrl(encoded);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.team.length, 6);
  assert.equal(decoded.team[0].pokemon_id, 'PKMN_0038_ALOLA');
  assert.equal(decoded.team[1], null);
  assert.equal(decoded.team[2].pokemon_id, 'PKMN_0115');
});

test('returns a warning and empty team for bad or missing share codes', () => {
  const missing = decodeTeamFromUrl('');
  assert.equal(missing.ok, false);
  assert.equal(missing.team.length, 6);
  assert.match(missing.warning, /No shared team code/);

  const bad = decodeTeamFromUrl('not-valid-json');
  assert.equal(bad.ok, false);
  assert.equal(bad.team.length, 6);
  assert.match(bad.warning, /could not be read/);
});

test('builds a team-builder URL without mutating the input team', () => {
  const original = structuredClone(team);
  const url = new URL(buildShareTeamUrl(team, 'https://champions.example/analysis?x=1#section'));
  assert.equal(url.origin, 'https://champions.example');
  assert.equal(url.pathname, '/team-builder');
  assert.ok(url.searchParams.get('team'));
  assert.deepEqual(team, original);
});

test('replaceTeamUrlState is a safe no-op outside the browser or outside team-builder route', () => {
  assert.equal(replaceTeamUrlState(team, 'analysis-desk'), '');
});
