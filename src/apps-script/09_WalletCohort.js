/**
 * Tao view cohort tu WALLET_INBOX + WALLET_METRICS, sau do dong bo sang 02_WALLETS.
 * V1.2 tam coi moi address la mot entity rieng; V1.3 moi gom wallet cung chu.
 */
function rebuildWalletCohort() {
  return bbWithScriptLock_(function () {
    var run = bbStartRun_('REBUILD_WALLET_COHORT', 'SYSTEM');
    try {
      var config = bbGetConfig_();
      var inbox = bbRowsToObjects_(bbGetTable_(BB_SHEETS.WALLET_INBOX));
      var metrics = bbRowsToObjects_(bbGetTable_(BB_SHEETS.WALLET_METRICS));

      // Index metric theo wallet_key de join O(n), tranh quet lai sheet cho tung wallet.
      var metricByKey = {};
      metrics.forEach(function (row) { metricByKey[String(row.wallet_key)] = row; });
      var now = new Date();

      var cohort = inbox.map(function (row) {
        var metric = metricByKey[String(row.wallet_key)];
        var staleDays = bbDaysBetween_(row.last_seen_at, now);
        var isStale = staleDays !== null && staleDays > config.STALE_WALLET_DAYS;

        // VERIFIED chi khi gate pass va wallet chua stale.
        // Moi truong hop khac van giu trong PROVISIONAL de khong lam cohort bi hep qua som.
        var verified = metric && bbToBoolean_(metric.wallet_gate_pass, false) && !isStale;
        var cohortType = verified ? 'VERIFIED' : 'PROVISIONAL';
        var score = metric ? bbToNumber_(metric.wallet_score, 0) : 0;
        return {
          wallet_key: row.wallet_key,
          chain: row.chain,
          wallet_address: row.wallet_address,
          cohort_type: cohortType,
          cluster_key: 'WALLET:' + row.wallet_address,
          wallet_score: score,
          wallet_quality_weight: verified ? bbRound_(score / 100, 4) : config.PROVISIONAL_QUALITY_WEIGHT,
          active: !isStale && String(row.queue_status) !== BB_QUEUE_STATUS.REJECTED,
          last_seen_at: row.last_seen_at,
          next_review_at: metric ? metric.next_review_at : '',
          source: 'NANSEN',
          cohort_reason: isStale ? 'STALE' : (verified ? 'GATE_PASS' : (metric ? metric.wallet_gate_reasons : 'WAIT_SCORE'))
        };
      });

      // Giu cac wallet MANUAL ma nguoi dung da nhap; rebuild khong duoc lam mat chung.
      var cohortKeys = {};
      cohort.forEach(function (row) { cohortKeys[String(row.wallet_key)] = true; });
      var manualWallets = bbRowsToObjects_(bbGetTable_(BB_SHEETS.WALLETS)).filter(function (row) {
        return String(row.managed_by || 'MANUAL') !== 'NANSEN_AUTO' && bbToBoolean_(row.active, true);
      });
      manualWallets.forEach(function (row) {
        var address = bbNormalizeAddress_(row.wallet_address);
        var chain = bbNormalizeChain_(row.chain || config.CHAIN);
        var key = String(row.wallet_key || bbWalletKey_(chain, address));
        if (!key || cohortKeys[key]) return;
        cohort.push({
          wallet_key: key,
          chain: chain,
          wallet_address: address,
          cohort_type: 'PROVISIONAL',
          cluster_key: 'WALLET:' + address,
          wallet_score: '',
          wallet_quality_weight: config.PROVISIONAL_QUALITY_WEIGHT,
          active: true,
          last_seen_at: row.last_synced_at || '',
          next_review_at: '',
          source: 'MANUAL',
          cohort_reason: 'MANUAL_UNSCORED'
        });
        cohortKeys[key] = true;
      });

      // WALLET_COHORT la materialized view: rebuild toan bo, khong nhap tay.
      bbReplaceTableRows_(BB_SHEETS.WALLET_COHORT, cohort);
      bbFinishRun_(run, 'SUCCESS', { wallet_count: inbox.length, result_count: cohort.length });
      bbToast_('Cohort rebuilt: ' + cohort.length + ' wallets.', 'BigBoy');
      return cohort;
    } catch (error) {
      bbFinishRun_(run, 'FAILED', { error_message: bbErrorMessage_(error) });
      throw error;
    }
  });
}

/**
 * Dong bo cohort sang 02_WALLETS, la danh sach operational cho cac pipeline trade sau nay.
 * Rule an toan:
 * - row MANUAL duoc giu nguyen;
 * - row NANSEN_AUTO duoc code quan ly;
 * - wallet ngoai top MAX_TRACKED_WALLETS khong bi xoa, chi active=FALSE.
 */
function syncCohortToTrackedWallets() {
  return bbWithScriptLock_(function () {
    var run = bbStartRun_('SYNC_COHORT_TO_WALLETS', 'SYSTEM');
    try {
      var config = bbGetConfig_();
      var cohort = bbRowsToObjects_(bbGetTable_(BB_SHEETS.WALLET_COHORT));
      var walletTable = bbGetTable_(BB_SHEETS.WALLETS);
      var wallets = bbRowsToObjects_(walletTable);

      var manual = wallets.filter(function (row) { return String(row.managed_by || 'MANUAL') !== 'NANSEN_AUTO'; });
      var autoByKey = {};
      wallets.filter(function (row) { return String(row.managed_by) === 'NANSEN_AUTO'; })
        .forEach(function (row) { autoByKey[String(row.wallet_key || bbWalletKey_(row.chain, row.wallet_address))] = row; });

      // Uu tien VERIFIED truoc, sau do score cao; cat theo MAX_TRACKED_WALLETS.
      var activeCohort = cohort.filter(function (row) { return bbToBoolean_(row.active, false); })
        .sort(function (a, b) {
          if (a.cohort_type !== b.cohort_type) return a.cohort_type === 'VERIFIED' ? -1 : 1;
          return bbToNumber_(b.wallet_score, 0) - bbToNumber_(a.wallet_score, 0);
        }).slice(0, config.MAX_TRACKED_WALLETS);

      var activeKeys = {};
      var now = bbNowIso_();
      activeCohort.forEach(function (row) { activeKeys[String(row.wallet_key)] = true; });

      // Map moi cohort row thanh row NANSEN_AUTO; merge prior de giu note/name nguoi dung da them.
      var autoRows = cohort.map(function (row) {
        var key = String(row.wallet_key);
        var prior = autoByKey[key] || {};
        return Object.assign({}, prior, {
          active: !!activeKeys[key],
          chain: row.chain,
          wallet_address: row.wallet_address,
          entity_key: 'WALLET:' + row.wallet_address,
          wallet_name: prior.wallet_name || '',
          source: 'NANSEN',
          source_url: prior.source_url || '',
          notes: prior.notes || row.cohort_reason,
          wallet_key: key,
          cohort_type: row.cohort_type,
          wallet_score: row.wallet_score,
          managed_by: 'NANSEN_AUTO',
          last_synced_at: now
        });
      });

      bbReplaceTableRows_(BB_SHEETS.WALLETS, manual.concat(autoRows));
      bbFinishRun_(run, 'SUCCESS', { wallet_count: cohort.length, result_count: activeCohort.length });
      bbToast_('Tracked wallets synced. Active Nansen wallets: ' + activeCohort.length, 'BigBoy');
      return activeCohort.length;
    } catch (error) {
      bbFinishRun_(run, 'FAILED', { error_message: bbErrorMessage_(error) });
      throw error;
    }
  });
}
