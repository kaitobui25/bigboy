/** Lightweight Apps Script self-tests; no API calls. */
function runV12SelfTests() {
  var failures = [];
  function assert(name, condition) { if (!condition) failures.push(name); }
  var config = {
    MIN_PROFITABLE_TOKENS_180D: 5,
    MIN_TRADED_TOKENS_180D: 8,
    MAX_LARGEST_WINNER_SHARE: 0.5,
    MIN_WALLET_SCORE: 65
  };
  var strong = {
    pnl_90d_realized: 100,
    pnl_180d_realized: 200,
    win_rate_90d: 0.6,
    traded_tokens_180d: 20,
    profitable_tokens_180d: 10,
    largest_winner_share: 0.2,
    recent_activity_at: new Date().toISOString(),
    label_90d_match: true,
    label_180d_match: true
  };
  var score = bbCalculateWalletScore_(strong, config, new Date());
  strong.wallet_score = score.total;
  assert('score clamps to <=100', score.total <= 100 && score.total >= 99);
  assert('strong wallet gate pass', bbEvaluateWalletGate_(strong, config).pass === true);
  var concentrated = Object.assign({}, strong, { largest_winner_share: 0.9, wallet_score: 90 });
  assert('concentrated wallet rejected', bbEvaluateWalletGate_(concentrated, config).pass === false);
  assert('wallet normalization', bbNormalizeAddress_(' 0x431AeC20e2C09A1eE556F656fCbEb0CC36F7DfDC ') === '0x431aec20e2c09a1ee556f656fcbeb0cc36f7dfdc');
  if (failures.length) throw new Error('Self-test failures: ' + failures.join(', '));
  SpreadsheetApp.getUi().alert('BigBoy V1.2 self-tests passed (' + 4 + ').');
  return true;
}
