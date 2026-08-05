/** Lightweight Apps Script self-tests; no API calls. */
function runV12SelfTests() {
  var failures = [];
  function assert(name, condition) { if (!condition) failures.push(name); }
  var config = {
    CHAIN: 'base',
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

  var discoverySample = [{
    chain: 'base',
    block_timestamp: '2026-08-05T06:56:37Z',
    transaction_hash: '0x325738ec77dfe2f0d849d8755cf2432a98bbb5dfb996ae8d3905283c71552bcc',
    trader_address: '0x431aec20e2c09a1ee556f656fcbeb0cc36f7dfdc',
    trader_address_label: 'High Balance',
    token_bought_symbol: 'ESBUILD',
    trade_value_usd: 10147.85324003996
  }];
  var discoveryAnalysis = bbAnalyzeDiscoveryRows_(discoverySample, config);
  assert('committed discovery shape parses', discoveryAnalysis.validRows.length === 1 && discoveryAnalysis.invalidCount === 0);

  if (failures.length) throw new Error('Self-test failures: ' + failures.join(', '));
  SpreadsheetApp.getUi().alert('BigBoy V1.2 self-tests passed (5). Discovery parser test uses no API credits.');
  return true;
}
