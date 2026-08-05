/**
 * Smart Money discovery -> 06_WALLET_INBOX.
 * Phan biet ro 3 truong hop: API rong, parser loai het, va co valid wallet.
 */
function runNansenDiscovery() {
  return bbWithScriptLock_(function () {
    var run = bbStartRun_('NANSEN_DISCOVERY', 'NANSEN');
    var usageBefore = bbGetNansenUsageToday_();
    try {
      var config = bbGetConfig_();
      bbAssertSystemReady_(config, true);
      var result = bbFetchDiscovery_(config);
      var apiRows = result.body.data || [];
      var analysis = bbAnalyzeDiscoveryRows_(apiRows, config);
      var usageAfter = bbGetNansenUsageToday_();

      // HTTP 200 + data=[]: khong phai parser bug. Ghi NO_DATA de nguoi dung khong goi lap lai trong mu.
      if (apiRows.length === 0) {
        var noDataMessage = [
          'HTTP 200 but Nansen returned data=[]',
          'chain=' + config.CHAIN,
          'MIN_DISCOVERY_TRADE_USD=' + config.MIN_DISCOVERY_TRADE_USD,
          'window=Nansen rolling 24h',
          'No wallet was filtered by BigBoy because the API returned no rows.'
        ].join('; ');
        bbFinishRun_(run, 'NO_DATA', {
          wallet_count: 0,
          rows_received: 0,
          rows_inserted: 0,
          rows_duplicate: 0,
          error_message: noDataMessage,
          credits_used: usageAfter - usageBefore,
          requests_made: 1
        });
        bbToast_(
          'NO_DATA: Nansen returned 0 rows for ' + config.CHAIN +
          ' with min $' + config.MIN_DISCOVERY_TRADE_USD + '. Check 05_RUN_LOG before another paid call.',
          'BigBoy'
        );
        return {
          inserted: 0,
          updated: 0,
          noData: true,
          apiRows: 0,
          validRows: 0,
          invalidReasons: {}
        };
      }

      // API co row nhung parser loai het: day la bug/schema/config can dieu tra, khong duoc bao SUCCESS.
      if (analysis.validRows.length === 0) {
        var parserMessage = 'PARSER_REJECTED_ALL: Nansen returned ' + apiRows.length +
          ' rows but BigBoy accepted 0. Reasons: ' + JSON.stringify(analysis.invalidReasons);
        bbFinishRun_(run, 'FAILED', {
          wallet_count: 0,
          rows_received: apiRows.length,
          rows_inserted: 0,
          rows_duplicate: 0,
          error_message: parserMessage,
          credits_used: usageAfter - usageBefore,
          requests_made: 1
        });
        throw new Error(parserMessage);
      }

      var upsert = bbUpsertDiscoveryInbox_(analysis.validRows);
      bbRecalculateInboxPriority_();
      var warning = analysis.invalidCount > 0
        ? 'Ignored ' + analysis.invalidCount + ' invalid rows: ' + JSON.stringify(analysis.invalidReasons)
        : '';
      bbFinishRun_(run, 'SUCCESS', {
        wallet_count: analysis.validRows.length,
        rows_received: apiRows.length,
        rows_inserted: upsert.inserted,
        rows_duplicate: upsert.updated,
        error_message: warning,
        credits_used: usageAfter - usageBefore,
        requests_made: 1
      });
      bbToast_(
        'Discovery: API rows=' + apiRows.length +
        ', valid=' + analysis.validRows.length +
        ', new wallets=' + upsert.inserted + '.',
        'BigBoy'
      );
      return Object.assign({}, upsert, {
        noData: false,
        apiRows: apiRows.length,
        validRows: analysis.validRows.length,
        invalidReasons: analysis.invalidReasons
      });
    } catch (error) {
      var status = String(error.message || '').indexOf('SKIPPED_BUDGET') === 0 ? 'SKIPPED_BUDGET' : 'FAILED';

      // PARSER_REJECTED_ALL da ghi log chi tiet o tren; tranh append them mot row FAILED trung lap.
      if (String(error.message || '').indexOf('PARSER_REJECTED_ALL') !== 0) {
        bbFinishRun_(run, status, {
          error_message: bbErrorMessage_(error),
          credits_used: bbGetNansenUsageToday_() - usageBefore
        });
      }
      throw error;
    }
  });
}

/**
 * Validate/normalize tung discovery row va dem ly do bi loai.
 * Khong silent-filter de khi schema doi ta biet chinh xac mat row o dau.
 */
function bbAnalyzeDiscoveryRows_(data, config) {
  var validRows = [];
  var invalidReasons = {};
  function reject(reason) {
    invalidReasons[reason] = (invalidReasons[reason] || 0) + 1;
  }
  (data || []).forEach(function (row) {
    var chain = bbNormalizeChain_(row.chain);
    var address = bbNormalizeAddress_(row.trader_address);
    var value = bbToNumber_(row.trade_value_usd, null);
    if (!address) {
      reject('INVALID_EVM_ADDRESS');
      return;
    }
    if (!chain) {
      reject('MISSING_CHAIN');
      return;
    }
    if (value === null) {
      reject('INVALID_TRADE_VALUE');
      return;
    }
    if (chain !== config.CHAIN) {
      reject('CHAIN_MISMATCH:' + chain);
      return;
    }
    validRows.push({
      wallet_key: bbWalletKey_(chain, address),
      chain: chain,
      wallet_address: address,
      seen_at: row.block_timestamp || bbNowIso_(),
      trade_value_usd: value,
      label: String(row.trader_address_label || ''),
      token_symbol: String(row.token_bought_symbol || ''),
      tx_hash: String(row.transaction_hash || '')
    });
  });
  return {
    validRows: validRows,
    invalidCount: (data || []).length - validRows.length,
    invalidReasons: invalidReasons
  };
}

/** Backward-compatible helper cho code/test chi can danh sach valid rows. */
function bbNormalizeDiscoveryRows_(data, config) {
  return bbAnalyzeDiscoveryRows_(data, config).validRows;
}

/**
 * Gop nhieu trade cung wallet trong mot API response, sau do upsert mot row/wallet.
 * discovery_count tang mot lan moi run; discovery_trade_count tang theo so trade.
 */
function bbUpsertDiscoveryInbox_(normalizedRows) {
  var table = bbGetTable_(BB_SHEETS.WALLET_INBOX);
  var existing = bbRowsToObjects_(table);
  var byKey = {};
  existing.forEach(function (row) { if (row.wallet_key) byKey[String(row.wallet_key)] = row; });

  var grouped = {};
  normalizedRows.forEach(function (event) {
    var group = grouped[event.wallet_key];
    if (!group) {
      group = {
        wallet_key: event.wallet_key,
        chain: event.chain,
        wallet_address: event.wallet_address,
        first_seen_at: event.seen_at,
        last_seen_at: event.seen_at,
        trade_count: 0,
        volume_usd: 0,
        labels: [],
        latest_token: '',
        latest_tx: ''
      };
      grouped[event.wallet_key] = group;
    }
    group.trade_count += 1;
    group.volume_usd += event.trade_value_usd;
    group.labels.push(event.label);
    if (!bbParseDate_(group.last_seen_at) || (bbParseDate_(event.seen_at) && bbParseDate_(event.seen_at) > bbParseDate_(group.last_seen_at))) {
      group.last_seen_at = event.seen_at;
      group.latest_token = event.token_symbol;
      group.latest_tx = event.tx_hash;
    }
  });

  var inserted = 0;
  var updated = 0;
  Object.keys(grouped).forEach(function (walletKey) {
    var event = grouped[walletKey];
    var row = byKey[walletKey];
    if (!row) {
      row = {
        wallet_key: event.wallet_key,
        chain: event.chain,
        wallet_address: event.wallet_address,
        first_seen_at: event.first_seen_at,
        last_seen_at: event.last_seen_at,
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
      byKey[walletKey] = row;
      inserted += 1;
    } else {
      updated += 1;
    }

    row.last_seen_at = event.last_seen_at;
    row.discovery_count = bbToNumber_(row.discovery_count, 0) + 1;
    row.discovery_trade_count = bbToNumber_(row.discovery_trade_count, 0) + event.trade_count;
    row.discovery_volume_usd = bbToNumber_(row.discovery_volume_usd, 0) + event.volume_usd;
    row.nansen_labels = bbUniqueStrings_(String(row.nansen_labels || '').split('|').concat(event.labels)).join(' | ');
    row.latest_source_token = event.latest_token;
    row.latest_source_tx = event.latest_tx;

    // Khong tu dong day VERIFIED/REJECTED quay lai WAIT_SCORE chi vi discovery lai.
    if ([BB_QUEUE_STATUS.REJECTED, BB_QUEUE_STATUS.VERIFIED].indexOf(String(row.queue_status)) < 0) {
      row.queue_status = BB_QUEUE_STATUS.WAIT_SCORE;
      row.next_action = 'SCORE';
    }
  });
  bbReplaceTableRows_(BB_SHEETS.WALLET_INBOX, existing);
  return { inserted: inserted, updated: updated };
}

/**
 * Priority chi quyet dinh wallet nao duoc dung credit truoc, khong phai quality score.
 * Discovery frequency/volume/label tang diem; wallet vua cham gan day bi tru diem.
 */
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
