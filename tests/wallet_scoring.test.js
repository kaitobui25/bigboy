const test = require('node:test');
const assert = require('node:assert/strict');

global.bbToNumber_ = (value, fallback) => {
  if (value === '' || value === null || typeof value === 'undefined') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
global.bbClamp_ = (value, min, max) => Math.max(min, Math.min(max, value));
global.bbRound_ = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};
global.bbDaysBetween_ = (earlier, later) => Math.max(0, (new Date(later) - new Date(earlier)) / 86400000);

const { bbCalculateWalletScore_, bbEvaluateWalletGate_ } = require('../src/apps-script/08_WalletScoring.js');

const config = {
  MIN_PROFITABLE_TOKENS_180D: 5,
  MIN_TRADED_TOKENS_180D: 8,
  MAX_LARGEST_WINNER_SHARE: 0.5,
  MIN_WALLET_SCORE: 65
};

function strongMetrics() {
  return {
    pnl_90d_realized: 1000,
    pnl_180d_realized: 2000,
    win_rate_90d: 0.60,
    traded_tokens_180d: 20,
    profitable_tokens_180d: 10,
    largest_winner_share: 0.20,
    recent_activity_at: '2026-08-05T00:00:00Z',
    label_90d_match: true,
    label_180d_match: true
  };
}

test('strong diversified wallet scores 100', () => {
  const result = bbCalculateWalletScore_(strongMetrics(), config, new Date('2026-08-06T00:00:00Z'));
  assert.equal(result.total, 100);
});

test('hard gate rejects one-hit wonder', () => {
  const metrics = { ...strongMetrics(), wallet_score: 90, largest_winner_share: 0.8 };
  const gate = bbEvaluateWalletGate_(metrics, config);
  assert.equal(gate.pass, false);
  assert.ok(gate.reasons.some((reason) => reason.startsWith('LARGEST_WINNER_SHARE')));
});

test('hard gate marks missing metric as WAIT_DATA', () => {
  const metrics = { ...strongMetrics(), wallet_score: null };
  const gate = bbEvaluateWalletGate_(metrics, config);
  assert.equal(gate.pass, false);
  assert.equal(gate.waitData, true);
});

test('negative 90D PnL cannot pass', () => {
  const metrics = { ...strongMetrics(), wallet_score: 90, pnl_90d_realized: -1 };
  const gate = bbEvaluateWalletGate_(metrics, config);
  assert.equal(gate.pass, false);
  assert.ok(gate.reasons.includes('PNL_90D_NOT_POSITIVE'));
});
