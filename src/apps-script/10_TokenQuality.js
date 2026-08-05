/** Enrich existing V1.1 token rows when 03_TRADES_RAW contains direct trades. */
function refreshTokenWalletQuality() {
  return bbWithScriptLock_(function () {
    var run = bbStartRun_('REFRESH_TOKEN_WALLET_QUALITY', 'SYSTEM');
    try {
      var config = bbGetConfig_();
      var raw = bbRowsToObjects_(bbGetTable_(BB_SHEETS.TRADES_RAW));
      var results = bbRowsToObjects_(bbGetTable_(BB_SHEETS.TOKEN_RESULTS));
      var cohort = bbRowsToObjects_(bbGetTable_(BB_SHEETS.WALLET_COHORT));
      var cohortByWallet = {};
      cohort.forEach(function (row) { cohortByWallet[String(row.wallet_address).toLowerCase()] = row; });
      var cutoff = Date.now() - 24 * 3600000;
      var walletTokenNet = {};
      raw.forEach(function (trade) {
        var date = bbParseDate_(trade.block_time);
        if (!date || date.getTime() < cutoff) return;
        var wallet = bbNormalizeAddress_(trade.wallet_address);
        var amount = bbToNumber_(trade.amount_usd, null);
        if (!wallet || amount === null) return;
        var bought = bbNormalizeAddress_(trade.token_bought_address);
        var sold = bbNormalizeAddress_(trade.token_sold_address);
        if (bought) walletTokenNet[wallet + '|' + bought] = bbToNumber_(walletTokenNet[wallet + '|' + bought], 0) + amount;
        if (sold) walletTokenNet[wallet + '|' + sold] = bbToNumber_(walletTokenNet[wallet + '|' + sold], 0) - amount;
      });
      var qualityByToken = {};
      Object.keys(walletTokenNet).forEach(function (key) {
        if (walletTokenNet[key] <= 0) return;
        var parts = key.split('|');
        var wallet = parts[0];
        var token = parts[1];
        var q = qualityByToken[token] || { verified: {}, provisional: {}, scores: [] };
        var c = cohortByWallet[wallet];
        if (c && c.cohort_type === 'VERIFIED') {
          q.verified[wallet] = true;
          q.scores.push(bbToNumber_(c.wallet_score, 0));
        } else {
          q.provisional[wallet] = true;
        }
        qualityByToken[token] = q;
      });
      results.forEach(function (row) {
        var token = bbNormalizeAddress_(row.token_address);
        var q = qualityByToken[token] || { verified: {}, provisional: {}, scores: [] };
        var verified = Object.keys(q.verified).length;
        var provisional = Object.keys(q.provisional).length;
        row.verified_buy_entities_24h = verified;
        row.provisional_buy_entities_24h = provisional;
        row.median_verified_wallet_score = q.scores.length ? bbRound_(bbMedian_(q.scores), 2) : '';
        row.wallet_quality_note = 'V1.2 direct-trade net buyers only';
        var entities = bbToNumber_(row.buy_entities_24h, 0);
        var net = bbToNumber_(row.raw_net_24h, 0);
        if (entities >= config.MIN_CANDIDATE_ENTITIES && net >= config.MIN_CANDIDATE_NET_BUY_USD && verified >= config.MIN_VERIFIED_BUYERS_CANDIDATE) row.status = 'CANDIDATE';
        else if (net > 0 && (entities >= config.MIN_WATCH_ENTITIES || verified + provisional > 0)) row.status = 'WATCH';
        else row.status = 'OBSERVED';
      });
      bbReplaceTableRows_(BB_SHEETS.TOKEN_RESULTS, results);
      bbFinishRun_(run, 'SUCCESS', { rows_received: raw.length, result_count: results.length });
      bbToast_('Token quality refreshed for ' + results.length + ' result rows.', 'BigBoy');
      return results.length;
    } catch (error) {
      bbFinishRun_(run, 'FAILED', { error_message: bbErrorMessage_(error) });
      throw error;
    }
  });
}
