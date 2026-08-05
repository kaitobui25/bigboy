/** Conservative local Nansen credit ledger. */
function bbUsagePropertyKey_() {
  var config = bbGetConfig_();
  var day = Utilities.formatDate(new Date(), config.TIMEZONE, 'yyyyMMdd');
  return 'NANSEN_USAGE_' + day;
}

function bbGetNansenUsageToday_() {
  return bbToNumber_(PropertiesService.getScriptProperties().getProperty(bbUsagePropertyKey_()), 0);
}

function bbReserveNansenCredits_(plannedCost) {
  var config = bbGetConfig_();
  var cost = bbToNumber_(plannedCost, 0);
  var used = bbGetNansenUsageToday_();
  if (used + cost > config.NANSEN_DAILY_BUDGET) {
    var error = new Error('SKIPPED_BUDGET: need ' + cost + ', used ' + used + ', budget ' + config.NANSEN_DAILY_BUDGET);
    error.code = 'SKIPPED_BUDGET';
    throw error;
  }
  PropertiesService.getScriptProperties().setProperty(bbUsagePropertyKey_(), String(used + cost));
  return used + cost;
}

function bbAdjustNansenCredits_(reservedCost, observedCost) {
  var observed = bbToNumber_(observedCost, null);
  if (observed === null || observed < 0) return;
  var used = bbGetNansenUsageToday_();
  var adjusted = Math.max(0, used - Number(reservedCost || 0) + observed);
  PropertiesService.getScriptProperties().setProperty(bbUsagePropertyKey_(), String(adjusted));
}

function bbExtractObservedCreditCost_(headers) {
  if (!headers) return null;
  var normalized = {};
  Object.keys(headers).forEach(function (key) { normalized[String(key).toLowerCase()] = headers[key]; });
  var candidates = ['x-credits-used', 'x-credit-cost', 'x-nansen-credits-used', 'credits-used'];
  for (var i = 0; i < candidates.length; i += 1) {
    var value = bbToNumber_(normalized[candidates[i]], null);
    if (value !== null) return value;
  }
  return null;
}

function showNansenBudget() {
  var config = bbGetConfig_();
  var used = bbGetNansenUsageToday_();
  SpreadsheetApp.getUi().alert(
    'Nansen local budget\nUsed today: ' + used + '\nDaily cap: ' + config.NANSEN_DAILY_BUDGET + '\nRemaining: ' + Math.max(0, config.NANSEN_DAILY_BUDGET - used)
  );
}

function resetNansenBudgetForTesting() {
  PropertiesService.getScriptProperties().deleteProperty(bbUsagePropertyKey_());
  SpreadsheetApp.getUi().alert('Today\'s local Nansen usage ledger was reset. Use only when actual API credits were not consumed.');
}
