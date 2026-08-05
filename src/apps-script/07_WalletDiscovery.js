/** Smart Money discovery -> 06_WALLET_INBOX. */
function runNansenDiscovery() {
  return bbWithScriptLock_(function () {
    var run = bbStartRun_('NANSEN_DISCOVERY', 'NANSEN');
    var usageBefore = bbGetNansenUsageToday_();
    try {
      var config = bbGetConfig_();
      bbAssertSystemReady_(config, true);
      var result = bbFetchDiscovery_(config);
      var rows = bbNormalizeDiscoveryRows_(result.body.data, config);
      var upsert = bbUpsertDiscoveryInbox_(rows);
      bbRecalculateInboxPriority_();
      var usageAfter = bbGetNansenUsageToday_();
      bbFinishRun_(run, 'SUCCESS', {
        wallet_count: rows.length,
        rows_received: result.body.data.length,
        rows_inserted: upsert.inserted,
        rows_duplicate: upsert.updated,
        credits_used: usageAfter - usageBefore,
        requests_made: 1
      });
      bbToast_('Discovery: ' + rows.length + ' valid wallet rows; ' + upsert.inserted + ' new.', 'BigBoy');
      return upsert;
    } catch (error) {
      var status = String(error.message || '').indexOf('SKIPPED_BUDGET') === 0 ? 'SKIPPED_BUDGET' : 'FAILED';
      bbFinishRun_(run, status, {
        error_message: bbErrorMessage_(error),
        credits_used: bbGetNansenUsageToday_() - usageBefore
      });
      throw error;
    }
  });
}

function bbNormalizeDiscoveryRows_(data, config) {
  return (data || []).map(function (row) {
    var chain = bbNormalizeChain_(row.chain);
    var address = bbNormalizeAddress_(row.trader_address);
    var value = bbToNumber_(row.trade_value_usd, null);
    if (!address || !chain || value === null || chain !== config.CHAIN) return null;
    return {
      wallet_key: bbWalletKey_(chain, address),
      chain: chain,
      wallet_address: address,
      seen_at: row.block_timestamp || bbNowIso_(),
      trade_value_usd: value,
      label: String(row.trader_address_label || ''),
      token_symbol: String(row.token_bought_symbol || ''),
      tx_hash: String(row.transaction_hash || '')
    };
  }).filter(Boolean);
}

function bbUpsertDiscoveryInbox_(normalizedRows) {
  var table = bbGetTable_(BB_SHEETS.WALLET_INBOX);
  var existing = bbRowsToObjects_(table);
  var byKey = {};
  existing.forEach(function (row) { if (row.wallet_key) byKey[String(row.wallet_key)] = row; });
  var newKeys = {};
  normalizedRows.forEach(function (event) {
    var row = byKey[event.wallet_key];
    if (!row) {
      row = {
        wallet_key: event.wallet_key,
        chain: event.chain,
        wallet_address: event.wallet_address,
        first_seen_at: event.seen_at,
        last_seen_at: event.seen_at,
        discovery_count: 0,
        discovery_trade_count: 0,
        discovery_volume_usd: 0,
        nansen_labels: '',
        latest_source_token: '',
        latest_source_tx: '',
        priority_score: 0,
        queue_status: BB_QUEUE_STATUS.NEW,
        next_action: 'SCORE',
        last_error: ''
      };
      existing.push(row);
      byKey[event.wallet_key] = row;
      newKeys[event.wallet_key] = true;
    }
    row.last_seen_at = event.seen_at;
    row.discovery_count = bbToNumber_(row.discovery_count, 0) + 1;
    row.discovery_trade_count = bbToNumber_(row.discovery_trade_count, 0) + 1;
    row.discovery_volume_usd = bbToNumber_(row.discovery_volume_usd, 0) + event.trade_value_usd;
    row.nansen_labels = bbUniqueStrings_(String(row.nansen_labels || '').split('|').concat([event.label])).join(' | ');
    row.latest_source_token = event.token_symbol;
    row.latest_source_tx = event.tx_hash;
    if ([BB_QUEUE_STATUS.REJECTED, BB_QUEUE_STATUS.VERIFIED].indexOf(String(row.queue_status)) < 0) {
      row.queue_status = BB_QUEUE_STATUS.WAIT_SCORE;
      row.next_action = 'SCORE';
    }
  });
  bbReplaceTableRows_(BB_SHEETS.WALLET_INBOX, existing);
  return {
    inserted: Object.keys(newKeys).length,
    updated: Math.max(0, normalizedRows.length - Object.keys(newKeys).length)
  };
}

function bbRecalculateInboxPriority_() {
  var inboxTable = bbGetTable_(BB_SHEETS.WALLET_INBOX);
  var inbox = bbRowsToObjects_(inboxTable);
  var metrics = bbRowsToObjects_(bbGetTable_(BB_SHEETS.WALLET_METRICS));
  var metricByKey = {};
  metrics.forEach(function (row) { metricByKey[String(row.wallet_key)] = row; });
  inbox.forEach(function (row) {
    var labels = String(row.nansen_labels || '').toLowerCase();
    var score = Math.min(bbToNumber_(row.discovery_count, 0), 10) * 3;
    score += Math.log10(bbToNumber_(row.discovery_volume_usd, 0) + 1) * 5;
    if (/30d|90d|short.?term|smart trader/.test(labels)) score += 10;
    if (/180d|all.?time|long.?term/.test(labels)) score += 15;
    var metric = metricByKey[String(row.wallet_key)];
    if (metric && metric.scored_at) {
      var days = bbDaysBetween_(metric.scored_at, new Date());
      if (days !== null && days < 7) score -= 100;
      else if (days !== null && days < 30) score -= 30;
    }
    row.priority_score = bbRound_(score, 2);
  });
  inbox.sort(function (a, b) { return bbToNumber_(b.priority_score, 0) - bbToNumber_(a.priority_score, 0); });
  bbReplaceTableRows_(BB_SHEETS.WALLET_INBOX, inbox);
}
