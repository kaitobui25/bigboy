/**
 * Constants dung chung cua BigBoy V1.2.
 * File nay la nguon chan ly cho ten Sheet, header, config default va estimated API cost.
 */
var BB_VERSION = '1.2.1';
var BB_SCHEMA_VERSION = '1.2';
var BB_NANSEN_BASE_URL = 'https://api.nansen.ai/api/v1';

/** Ten Sheet co dinh; doi ten o day se anh huong toan bo pipeline. */
var BB_SHEETS = {
  README: '00_README',
  CONFIG: '01_CONFIG',
  WALLETS: '02_WALLETS',
  TRADES_RAW: '03_TRADES_RAW',
  TOKEN_RESULTS: '04_TOKEN_RESULTS',
  RUN_LOG: '05_RUN_LOG',
  WALLET_INBOX: '06_WALLET_INBOX',
  WALLET_METRICS: '07_WALLET_METRICS',
  WALLET_COHORT: '08_WALLET_COHORT'
};

/** Header duoc dung cho migration va object<->row mapping. */
var BB_HEADERS = {};
BB_HEADERS[BB_SHEETS.CONFIG] = ['key', 'value', 'description'];
BB_HEADERS[BB_SHEETS.WALLETS] = [
  'active', 'chain', 'wallet_address', 'entity_key', 'wallet_name', 'source',
  'source_url', 'notes', 'wallet_key', 'cohort_type', 'wallet_score',
  'managed_by', 'last_synced_at'
];
BB_HEADERS[BB_SHEETS.TRADES_RAW] = [
  'raw_key', 'imported_at', 'block_time', 'chain', 'tx_hash', 'evt_index',
  'wallet_address', 'entity_key', 'token_bought_address', 'token_bought_symbol',
  'token_sold_address', 'token_sold_symbol', 'amount_usd', 'project', 'tx_url'
];
BB_HEADERS[BB_SHEETS.TOKEN_RESULTS] = [
  'result_key', 'updated_at', 'chain', 'token_address', 'token_symbol', 'status',
  'buy_entities_24h', 'buy_wallets_24h', 'raw_buy_24h', 'raw_sell_24h',
  'raw_net_24h', 'buy_entities_72h', 'raw_net_72h', 'largest_entity_share_24h',
  'first_buy_at', 'last_buy_at', 'wallets', 'entities', 'tx_count_24h', 'dex_url',
  'verified_buy_entities_24h', 'provisional_buy_entities_24h',
  'median_verified_wallet_score', 'wallet_quality_note'
];
BB_HEADERS[BB_SHEETS.RUN_LOG] = [
  'started_at', 'finished_at', 'run_id', 'action', 'status', 'wallet_count',
  'rows_received', 'rows_inserted', 'rows_duplicate', 'result_count',
  'error_message', 'provider', 'credits_used', 'requests_made', 'budget_remaining'
];
BB_HEADERS[BB_SHEETS.WALLET_INBOX] = [
  'wallet_key', 'chain', 'wallet_address', 'first_seen_at', 'last_seen_at',
  'discovery_count', 'discovery_trade_count', 'discovery_volume_usd',
  'nansen_labels', 'latest_source_token', 'latest_source_tx', 'priority_score',
  'queue_status', 'next_action', 'last_error'
];
BB_HEADERS[BB_SHEETS.WALLET_METRICS] = [
  'wallet_key', 'pnl_90d_realized', 'pnl_180d_realized', 'win_rate_90d',
  'traded_tokens_180d', 'profitable_tokens_180d', 'largest_winner_usd',
  'largest_winner_share', 'recent_activity_at', 'label_90d_match',
  'label_180d_match', 'score_pnl_consistency', 'score_win_rate',
  'score_profitable_breadth', 'score_winner_concentration',
  'score_recent_activity', 'score_label_overlap', 'wallet_score',
  'wallet_gate_pass', 'wallet_gate_reasons', 'scored_at', 'next_review_at',
  'source_snapshot_key'
];
BB_HEADERS[BB_SHEETS.WALLET_COHORT] = [
  'wallet_key', 'chain', 'wallet_address', 'cohort_type', 'cluster_key',
  'wallet_score', 'wallet_quality_weight', 'active', 'last_seen_at',
  'next_review_at', 'source', 'cohort_reason'
];

/**
 * Config default chi duoc seed khi key chua ton tai.
 * Setup chay lai khong overwrite gia tri nguoi dung da chinh trong 01_CONFIG.
 */
var BB_CONFIG_DEFAULTS = [
  ['SCHEMA_VERSION', BB_SCHEMA_VERSION, 'Do not edit manually'],
  ['SYSTEM_ENABLED', true, 'Master kill switch'],
  ['TIMEZONE', 'Asia/Tokyo', 'Display and daily credit timezone'],
  ['CHAIN', 'base', 'V1.2 supports one chain per run'],
  ['NANSEN_ENABLED', false, 'Set TRUE only after storing NANSEN_API_KEY'],
  ['NANSEN_DAILY_BUDGET', 9, 'Local estimate only; verify actual Nansen Usage Analytics'],
  ['NANSEN_DISCOVERY_LIMIT', 20, 'Rows per discovery call'],
  ['NANSEN_DETAIL_PER_PAGE', 100, 'PnL detail rows per page'],
  ['NANSEN_MAX_PNL_PAGES', 5, 'Hard pagination guard per wallet'],
  ['MIN_DISCOVERY_TRADE_USD', 1000, 'Broad discovery threshold; wallet quality is filtered later by scoring'],
  ['MAX_WALLETS_SCORE_PER_RUN', 1, 'Free-plan default; raise only with budget'],
  ['MIN_WALLET_SCORE', 65, 'Verified wallet threshold'],
  ['PROVISIONAL_QUALITY_WEIGHT', 0.40, 'Display weight until verified'],
  ['MIN_TRADED_TOKENS_180D', 8, 'Wallet breadth gate'],
  ['MIN_PROFITABLE_TOKENS_180D', 5, 'Profitable breadth gate'],
  ['MAX_LARGEST_WINNER_SHARE', 0.50, 'Reject one-hit-wonder concentration'],
  ['WALLET_REVIEW_DAYS', 30, 'Verified wallet rescore interval'],
  ['STALE_WALLET_DAYS', 90, 'Deactivate wallets not rediscovered'],
  ['MAX_TRACKED_WALLETS', 300, 'Google Sheets/Dune safety guard'],
  ['MIN_WATCH_ENTITIES', 2, 'Temporary V1.2 token rule'],
  ['MIN_CANDIDATE_ENTITIES', 3, 'Temporary V1.2 token rule'],
  ['MIN_CANDIDATE_NET_BUY_USD', 10000, 'Temporary V1.2 token rule'],
  ['MIN_VERIFIED_BUYERS_CANDIDATE', 2, 'Temporary V1.2 quality requirement']
];

/**
 * Estimated cost dung cho local guard.
 * Neu response co observed credit header, 05_CreditGuard se dieu chinh lai ledger.
 */
var BB_NANSEN_COSTS = {
  DISCOVERY: 5,
  PNL_SUMMARY: 1,
  PNL_DETAIL_PAGE: 1
};

/** Trang thai queue cua wallet tu discovery den scoring/review. */
var BB_QUEUE_STATUS = {
  NEW: 'NEW',
  PROVISIONAL: 'PROVISIONAL',
  WAIT_SCORE: 'WAIT_SCORE',
  WAIT_DATA: 'WAIT_DATA',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  STALE: 'STALE'
};
