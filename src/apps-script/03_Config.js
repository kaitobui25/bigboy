/** Config parsing and validation. */
function bbGetConfig_() {
  var table = bbGetTable_(BB_SHEETS.CONFIG);
  var rows = bbRowsToObjects_(table);
  var raw = {};
  rows.forEach(function (row) {
    var key = String(row.key || '').trim();
    if (key) raw[key] = row.value;
  });
  var required = BB_CONFIG_DEFAULTS.map(function (item) { return item[0]; });
  var missing = required.filter(function (key) {
    return !Object.prototype.hasOwnProperty.call(raw, key) || raw[key] === '' || raw[key] === null;
  });
  if (missing.length) throw new Error('Missing config keys: ' + missing.join(', '));

  var config = {
    SCHEMA_VERSION: String(raw.SCHEMA_VERSION),
    SYSTEM_ENABLED: bbToBoolean_(raw.SYSTEM_ENABLED, false),
    TIMEZONE: String(raw.TIMEZONE || 'Asia/Tokyo'),
    CHAIN: bbNormalizeChain_(raw.CHAIN),
    NANSEN_ENABLED: bbToBoolean_(raw.NANSEN_ENABLED, false),
    NANSEN_DAILY_BUDGET: bbToNumber_(raw.NANSEN_DAILY_BUDGET, 0),
    NANSEN_DISCOVERY_LIMIT: Math.floor(bbToNumber_(raw.NANSEN_DISCOVERY_LIMIT, 20)),
    NANSEN_DETAIL_PER_PAGE: Math.floor(bbToNumber_(raw.NANSEN_DETAIL_PER_PAGE, 100)),
    NANSEN_MAX_PNL_PAGES: Math.floor(bbToNumber_(raw.NANSEN_MAX_PNL_PAGES, 5)),
    MIN_DISCOVERY_TRADE_USD: bbToNumber_(raw.MIN_DISCOVERY_TRADE_USD, 10000),
    MAX_WALLETS_SCORE_PER_RUN: Math.floor(bbToNumber_(raw.MAX_WALLETS_SCORE_PER_RUN, 1)),
    MIN_WALLET_SCORE: bbToNumber_(raw.MIN_WALLET_SCORE, 65),
    PROVISIONAL_QUALITY_WEIGHT: bbToNumber_(raw.PROVISIONAL_QUALITY_WEIGHT, 0.4),
    MIN_TRADED_TOKENS_180D: Math.floor(bbToNumber_(raw.MIN_TRADED_TOKENS_180D, 8)),
    MIN_PROFITABLE_TOKENS_180D: Math.floor(bbToNumber_(raw.MIN_PROFITABLE_TOKENS_180D, 5)),
    MAX_LARGEST_WINNER_SHARE: bbToNumber_(raw.MAX_LARGEST_WINNER_SHARE, 0.5),
    WALLET_REVIEW_DAYS: Math.floor(bbToNumber_(raw.WALLET_REVIEW_DAYS, 30)),
    STALE_WALLET_DAYS: Math.floor(bbToNumber_(raw.STALE_WALLET_DAYS, 90)),
    MAX_TRACKED_WALLETS: Math.floor(bbToNumber_(raw.MAX_TRACKED_WALLETS, 300)),
    MIN_WATCH_ENTITIES: Math.floor(bbToNumber_(raw.MIN_WATCH_ENTITIES, 2)),
    MIN_CANDIDATE_ENTITIES: Math.floor(bbToNumber_(raw.MIN_CANDIDATE_ENTITIES, 3)),
    MIN_CANDIDATE_NET_BUY_USD: bbToNumber_(raw.MIN_CANDIDATE_NET_BUY_USD, 10000),
    MIN_VERIFIED_BUYERS_CANDIDATE: Math.floor(bbToNumber_(raw.MIN_VERIFIED_BUYERS_CANDIDATE, 2))
  };
  if (!config.CHAIN) throw new Error('CHAIN is empty');
  if (config.NANSEN_DAILY_BUDGET < 1) throw new Error('NANSEN_DAILY_BUDGET must be >= 1');
  if (config.MAX_WALLETS_SCORE_PER_RUN < 1) throw new Error('MAX_WALLETS_SCORE_PER_RUN must be >= 1');
  return config;
}

function bbAssertSystemReady_(config, requireNansen) {
  if (!config.SYSTEM_ENABLED) throw new Error('SYSTEM_ENABLED is FALSE');
  if (requireNansen) {
    if (!config.NANSEN_ENABLED) throw new Error('NANSEN_ENABLED is FALSE');
    if (!PropertiesService.getScriptProperties().getProperty('NANSEN_API_KEY')) {
      throw new Error('NANSEN_API_KEY is missing. Use BigBoy > Set Nansen API Key.');
    }
  }
}

function setNansenApiKey() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt('Set Nansen API Key', 'The key is stored only in Apps Script Script Properties.', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  var key = String(response.getResponseText() || '').trim();
  if (key.length < 10) throw new Error('API key looks too short');
  PropertiesService.getScriptProperties().setProperty('NANSEN_API_KEY', key);
  ui.alert('Nansen API key saved. Now set NANSEN_ENABLED=TRUE in 01_CONFIG.');
}

function clearNansenApiKey() {
  PropertiesService.getScriptProperties().deleteProperty('NANSEN_API_KEY');
  SpreadsheetApp.getUi().alert('NANSEN_API_KEY removed from Script Properties.');
}
