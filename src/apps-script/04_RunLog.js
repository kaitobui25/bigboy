/** Tao object run trong memory; chi ghi Sheet khi run ket thuc. */
function bbStartRun_(action, provider) {
  return {
    started_at: bbNowIso_(),
    finished_at: '',
    run_id: bbUuid_(),
    action: action,
    status: 'RUNNING',
    wallet_count: 0,
    rows_received: 0,
    rows_inserted: 0,
    rows_duplicate: 0,
    result_count: 0,
    error_message: '',
    provider: provider || '',
    credits_used: 0,
    requests_made: 0,
    budget_remaining: ''
  };
}

/**
 * Merge thong tin ket qua va append dung mot row vao 05_RUN_LOG.
 * Status co the la SUCCESS, NO_DATA, PARTIAL, FAILED, SKIPPED_BUDGET...
 * Logging duoc boc try/catch de loi log khong che mat loi pipeline goc.
 */
function bbFinishRun_(run, status, updates) {
  var finalRun = Object.assign({}, run, updates || {});
  finalRun.finished_at = bbNowIso_();
  finalRun.status = status;

  // budget_remaining la local estimate, khong phai balance chinh thuc cua Nansen.
  try {
    var config = bbGetConfig_();
    finalRun.budget_remaining = Math.max(0, config.NANSEN_DAILY_BUDGET - bbGetNansenUsageToday_());
  } catch (ignored) {}

  try {
    var table = bbGetTable_(BB_SHEETS.RUN_LOG);
    table.sheet.appendRow(bbObjectToRow_(finalRun, table.headers));
  } catch (logError) {
    console.error('Unable to write run log: ' + bbErrorMessage_(logError));
  }
  return finalRun;
}
