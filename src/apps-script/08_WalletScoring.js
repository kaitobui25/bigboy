/** Wallet metric derivation, score and hard gate. Pure helpers are Node-testable. */
function bbDeriveWalletMetrics_(summary90, detail180Rows, inboxRow, config, now) {
  var rows = detail180Rows || [];
  if (!summary90 || !Array.isArray(rows)) throw new Error('WAIT_DATA: summary/detail missing');
  var realized180 = 0;
  var profitable = 0;
  var positiveTotal = 0;
  var largestWinner = 0;
  rows.forEach(function (row) {
    var pnl = bbToNumber_(row.pnl_usd_realised, null);
    if (pnl === null) return;
    realized180 += pnl;
    if (pnl > 0) {
      profitable += 1;
      positiveTotal += pnl;
      largestWinner = Math.max(largestWinner, pnl);
    }
  });
  var labels = String(inboxRow.nansen_labels || '').toLowerCase();
  var derived = {
    wallet_key: String(inboxRow.wallet_key),
    pnl_90d_realized: bbToNumber_(summary90.realized_pnl_usd, null),
    pnl_180d_realized: bbRound_(realized180, 6),
    win_rate_90d: bbToNumber_(summary90.win_rate, null),
    traded_tokens_180d: rows.length,
    profitable_tokens_180d: profitable,
    largest_winner_usd: bbRound_(largestWinner, 6),
    largest_winner_share: positiveTotal > 0 ? largestWinner / positiveTotal : null,
    recent_activity_at: inboxRow.last_seen_at || '',
    label_90d_match: /30d|90d|short.?term|smart trader/.test(labels),
    label_180d_match: /180d|all.?time|long.?term/.test(labels)
  };
  var scoreResult = bbCalculateWalletScore_(derived, config, now || new Date());
  Object.keys(scoreResult.components).forEach(function (key) { derived[key] = scoreResult.components[key]; });
  derived.wallet_score = scoreResult.total;
  var gate = bbEvaluateWalletGate_(derived, config);
  derived.wallet_gate_pass = gate.pass;
  derived.wallet_gate_reasons = gate.reasons.join(' | ');
  return derived;
}

function bbCalculateWalletScore_(metrics, config, now) {
  var pnlScore = 0;
  if (bbToNumber_(metrics.pnl_90d_realized, 0) > 0) pnlScore += 12.5;
  if (bbToNumber_(metrics.pnl_180d_realized, 0) > 0) pnlScore += 12.5;

  var winRate = bbToNumber_(metrics.win_rate_90d, 0);
  var winRateScore = bbClamp_(winRate / 0.60, 0, 1) * 15;

  var profitable = bbToNumber_(metrics.profitable_tokens_180d, 0);
  var breadthTarget = Math.max(config.MIN_PROFITABLE_TOKENS_180D * 2, 10);
  var breadthScore = bbClamp_(profitable / breadthTarget, 0, 1) * 20;

  var share = bbToNumber_(metrics.largest_winner_share, 1);
  var concentrationScore;
  if (share <= 0.25) concentrationScore = 20;
  else if (share >= 0.75) concentrationScore = 0;
  else concentrationScore = (0.75 - share) / 0.50 * 20;

  var activityDays = bbDaysBetween_(metrics.recent_activity_at, now);
  var activityScore = 0;
  if (activityDays !== null && activityDays <= 7) activityScore = 10;
  else if (activityDays !== null && activityDays <= 30) activityScore = 7;
  else if (activityDays !== null && activityDays <= 90) activityScore = 3;

  var labelScore = (metrics.label_90d_match ? 5 : 0) + (metrics.label_180d_match ? 5 : 0);
  var components = {
    score_pnl_consistency: bbRound_(pnlScore, 2),
    score_win_rate: bbRound_(winRateScore, 2),
    score_profitable_breadth: bbRound_(breadthScore, 2),
    score_winner_concentration: bbRound_(concentrationScore, 2),
    score_recent_activity: bbRound_(activityScore, 2),
    score_label_overlap: bbRound_(labelScore, 2)
  };
  var total = Object.keys(components).reduce(function (sum, key) { return sum + components[key]; }, 0);
  return { components: components, total: bbRound_(bbClamp_(total, 0, 100), 2) };
}

function bbEvaluateWalletGate_(metrics, config) {
  var required = [
    'pnl_90d_realized', 'pnl_180d_realized', 'win_rate_90d',
    'traded_tokens_180d', 'profitable_tokens_180d', 'largest_winner_share', 'wallet_score'
  ];
  var missing = required.filter(function (key) {
    return metrics[key] === '' || metrics[key] === null || typeof metrics[key] === 'undefined' || !isFinite(Number(metrics[key]));
  });
  if (missing.length) return { pass: false, waitData: true, reasons: ['MISSING:' + missing.join(',')] };
  var reasons = [];
  if (Number(metrics.pnl_90d_realized) <= 0) reasons.push('PNL_90D_NOT_POSITIVE');
  if (Number(metrics.pnl_180d_realized) <= 0) reasons.push('PNL_180D_NOT_POSITIVE');
  if (Number(metrics.traded_tokens_180d) < config.MIN_TRADED_TOKENS_180D) reasons.push('TRADED_TOKENS_LT_' + config.MIN_TRADED_TOKENS_180D);
  if (Number(metrics.profitable_tokens_180d) < config.MIN_PROFITABLE_TOKENS_180D) reasons.push('PROFITABLE_TOKENS_LT_' + config.MIN_PROFITABLE_TOKENS_180D);
  if (Number(metrics.largest_winner_share) > config.MAX_LARGEST_WINNER_SHARE) reasons.push('LARGEST_WINNER_SHARE_GT_' + config.MAX_LARGEST_WINNER_SHARE);
  if (Number(metrics.wallet_score) < config.MIN_WALLET_SCORE) reasons.push('WALLET_SCORE_LT_' + config.MIN_WALLET_SCORE);
  return { pass: reasons.length === 0, waitData: false, reasons: reasons.length ? reasons : ['PASS'] };
}

function bbSelectPriorityWallets_(config) {
  var inbox = bbRowsToObjects_(bbGetTable_(BB_SHEETS.WALLET_INBOX));
  return inbox.filter(function (row) {
    var status = String(row.queue_status || '');
    return row.chain === config.CHAIN && [BB_QUEUE_STATUS.NEW, BB_QUEUE_STATUS.PROVISIONAL, BB_QUEUE_STATUS.WAIT_SCORE, BB_QUEUE_STATUS.WAIT_DATA].indexOf(status) >= 0;
  }).sort(function (a, b) {
    return bbToNumber_(b.priority_score, 0) - bbToNumber_(a.priority_score, 0);
  }).slice(0, config.MAX_WALLETS_SCORE_PER_RUN);
}

function scorePriorityWallets() {
  return bbWithScriptLock_(function () {
    var run = bbStartRun_('SCORE_PRIORITY_WALLETS', 'NANSEN');
    var usageBefore = bbGetNansenUsageToday_();
    var requests = 0;
    var walletErrors = [];
    try {
      var config = bbGetConfig_();
      bbAssertSystemReady_(config, true);
      var selected = bbSelectPriorityWallets_(config);
      if (!selected.length) {
        bbFinishRun_(run, 'SUCCESS', { wallet_count: 0, result_count: 0 });
        bbToast_('No wallet is waiting for score.', 'BigBoy');
        return [];
      }
      var results = [];
      selected.forEach(function (inboxRow) {
        var scoredAt = new Date();
        try {
          var summaryResult = bbFetchPnlSummary_(inboxRow.wallet_address, inboxRow.chain, 90);
          requests += 1;
          var detailResult = bbFetchPnlDetailAll_(inboxRow.wallet_address, inboxRow.chain, 180, config);
          requests += detailResult.pagesFetched;
          var metrics = bbDeriveWalletMetrics_(summaryResult.body, detailResult.data, inboxRow, config, scoredAt);
          metrics.scored_at = scoredAt.toISOString();
          metrics.next_review_at = bbAddDays_(scoredAt, config.WALLET_REVIEW_DAYS).toISOString();
          metrics.source_snapshot_key = 'NANSEN:' + inboxRow.wallet_key + ':' + scoredAt.toISOString() + ':' + bbHashJson_({ summary: summaryResult.body, detail: detailResult.data });
          bbUpsertObjects_(BB_SHEETS.WALLET_METRICS, 'wallet_key', [metrics]);
          bbUpdateInboxAfterScore_(inboxRow.wallet_key, metrics, null);
          results.push(metrics);
        } catch (walletError) {
          bbUpdateInboxAfterScore_(inboxRow.wallet_key, null, walletError);
          walletErrors.push(bbErrorMessage_(walletError));
          if (String(walletError.message || '').indexOf('SKIPPED_BUDGET') === 0 || [401, 403].indexOf(walletError.httpStatus) >= 0) throw walletError;
        }
      });
      bbRecalculateInboxPriority_();
      var usageAfter = bbGetNansenUsageToday_();
      var finalStatus = walletErrors.length ? (results.length ? 'PARTIAL' : 'FAILED') : 'SUCCESS';
      bbFinishRun_(run, finalStatus, {
        wallet_count: selected.length,
        result_count: results.length,
        error_message: walletErrors.join(' || ').slice(0, 1000),
        credits_used: usageAfter - usageBefore,
        requests_made: requests
      });
      bbToast_('Scored ' + results.length + ' wallet(s)' + (walletErrors.length ? '; errors: ' + walletErrors.length : '') + '.', 'BigBoy');
      return results;
    } catch (error) {
      var status = String(error.message || '').indexOf('SKIPPED_BUDGET') === 0 ? 'SKIPPED_BUDGET' : 'FAILED';
      bbFinishRun_(run, status, {
        error_message: bbErrorMessage_(error),
        credits_used: bbGetNansenUsageToday_() - usageBefore,
        requests_made: requests
      });
      throw error;
    }
  });
}

function bbUpdateInboxAfterScore_(walletKey, metrics, error) {
  var table = bbGetTable_(BB_SHEETS.WALLET_INBOX);
  var rows = bbRowsToObjects_(table);
  rows.forEach(function (row) {
    if (String(row.wallet_key) !== String(walletKey)) return;
    if (error) {
      row.last_error = bbErrorMessage_(error);
      row.queue_status = /WAIT_DATA|contract|missing/i.test(row.last_error) ? BB_QUEUE_STATUS.WAIT_DATA : BB_QUEUE_STATUS.WAIT_SCORE;
      row.next_action = 'RETRY_SCORE';
    } else {
      row.last_error = '';
      row.queue_status = metrics.wallet_gate_pass ? BB_QUEUE_STATUS.VERIFIED : BB_QUEUE_STATUS.REJECTED;
      row.next_action = metrics.wallet_gate_pass ? 'REVIEW_LATER' : 'HOLD';
    }
  });
  bbReplaceTableRows_(BB_SHEETS.WALLET_INBOX, rows);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    bbCalculateWalletScore_: bbCalculateWalletScore_,
    bbEvaluateWalletGate_: bbEvaluateWalletGate_
  };
}
