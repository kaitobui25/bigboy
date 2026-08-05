/**
 * Quan ly ngan sach Nansen cuc bo trong Script Properties.
 *
 * Luu y quan trong:
 * - Day la so credit BigBoy TU UOC TINH, khong phai so du chinh thuc cua Nansen.
 * - Nansen Usage Analytics van la nguon dung de xac nhan credit thuc te.
 * - Ledger tach theo ngay va theo TIMEZONE trong 01_CONFIG.
 */
function bbUsagePropertyKey_() {
  var config = bbGetConfig_();
  var day = Utilities.formatDate(new Date(), config.TIMEZONE, 'yyyyMMdd');
  return 'NANSEN_USAGE_' + day;
}

/** Doc tong credit da reserve/ghi nhan trong ngay hien tai. */
function bbGetNansenUsageToday_() {
  return bbToNumber_(PropertiesService.getScriptProperties().getProperty(bbUsagePropertyKey_()), 0);
}

/**
 * Reserve credit TRUOC khi goi API.
 * Lam nhu vay de hai job chay gan nhau khong cung nghi rang budget van con.
 * Neu vuot cap, dung clean bang SKIPPED_BUDGET thay vi goi API roi moi phat hien.
 */
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

/**
 * Neu response header co credit cost thuc te, thay estimate bang observed cost.
 * Neu Nansen khong tra header phu hop thi giu estimate bao thu da reserve.
 */
function bbAdjustNansenCredits_(reservedCost, observedCost) {
  var observed = bbToNumber_(observedCost, null);
  if (observed === null || observed < 0) return;
  var used = bbGetNansenUsageToday_();
  var adjusted = Math.max(0, used - Number(reservedCost || 0) + observed);
  PropertiesService.getScriptProperties().setProperty(bbUsagePropertyKey_(), String(adjusted));
}

/** Tim credit cost trong mot so header Nansen co the su dung. */
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

/**
 * Chi reset khi chac chan API call KHONG tieu credit thuc.
 * Khong dung ham nay de lach cap sau khi Nansen da tru credit.
 */
function resetNansenBudgetForTesting() {
  PropertiesService.getScriptProperties().deleteProperty(bbUsagePropertyKey_());
  SpreadsheetApp.getUi().alert('Today\'s local Nansen usage ledger was reset. Use only when actual API credits were not consumed.');
}
