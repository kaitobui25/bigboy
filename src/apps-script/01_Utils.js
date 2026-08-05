/** Cac helper dung chung, khong phu thuoc service cu the. */
function bbNowIso_() {
  return new Date().toISOString();
}

function bbUuid_() {
  return Utilities.getUuid();
}

/** Normalize EVM address; invalid address tra chuoi rong de caller quyet dinh bo qua/throw. */
function bbNormalizeAddress_(value) {
  var address = String(value || '').trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) return '';
  return address;
}

function bbNormalizeChain_(value) {
  return String(value || '').trim().toLowerCase();
}

/** wallet_key gom chain + address de cung mot address tren chain khac khong bi trung key. */
function bbWalletKey_(chain, address) {
  var normalizedChain = bbNormalizeChain_(chain);
  var normalizedAddress = bbNormalizeAddress_(address);
  return normalizedChain && normalizedAddress ? normalizedChain + ':' + normalizedAddress : '';
}

/** Parse number bao thu; khong dung `value || fallback` vi gia tri 0 la hop le. */
function bbToNumber_(value, fallback) {
  if (value === '' || value === null || typeof value === 'undefined') return fallback;
  var n = Number(value);
  return isFinite(n) ? n : fallback;
}

function bbToBoolean_(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    var s = value.trim().toLowerCase();
    if (['true', 'yes', '1', 'on'].indexOf(s) >= 0) return true;
    if (['false', 'no', '0', 'off'].indexOf(s) >= 0) return false;
  }
  return fallback;
}

function bbClamp_(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function bbRound_(value, digits) {
  var factor = Math.pow(10, digits || 0);
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

/** Date parse fail thi tra null, khong tao Invalid Date lan truyen sang score. */
function bbParseDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (!value) return null;
  var date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function bbDaysBetween_(earlier, later) {
  var a = bbParseDate_(earlier);
  var b = bbParseDate_(later || new Date());
  if (!a || !b) return null;
  return Math.max(0, (b.getTime() - a.getTime()) / 86400000);
}

function bbAddDays_(date, days) {
  var d = bbParseDate_(date) || new Date();
  return new Date(d.getTime() + Number(days) * 86400000);
}

function bbMedian_(values) {
  var numbers = (values || []).map(Number).filter(function (n) { return isFinite(n); });
  if (!numbers.length) return '';
  numbers.sort(function (a, b) { return a - b; });
  var middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
}

/** Bo UTF-8 BOM truoc JSON.parse vi fixture tao bang PowerShell co the co BOM. */
function bbSafeJsonParse_(text, context) {
  try {
    return JSON.parse(String(text || '').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error('Invalid JSON from ' + (context || 'unknown source') + ': ' + error.message);
  }
}

/** Tao SHA-256 de truy dau input snapshot ma khong luu secret/API header. */
function bbHashJson_(value) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(value),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function (byte) {
    var normalized = byte < 0 ? byte + 256 : byte;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}

function bbUniqueStrings_(values) {
  var seen = {};
  return (values || []).map(function (value) { return String(value || '').trim(); })
    .filter(function (value) {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    });
}

/**
 * Lock toan script de tranh hai menu/trigger cung sua Sheet va credit ledger mot luc.
 * tryLock 5 giay, khong xep hang vo han.
 */
function bbWithScriptLock_(callback) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('SKIPPED_LOCKED: another BigBoy job is running');
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Khi chay tu menu, dung active spreadsheet.
 * Khi chay tu time trigger khong co active UI, mo bang GOOGLE_SHEET_ID da luu luc setup.
 */
function bbGetSpreadsheet_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  var id = PropertiesService.getScriptProperties().getProperty('GOOGLE_SHEET_ID');
  if (!id) throw new Error('No active spreadsheet and GOOGLE_SHEET_ID is not set');
  return SpreadsheetApp.openById(id);
}

function bbToast_(message, title) {
  try {
    bbGetSpreadsheet_().toast(String(message), title || 'BigBoy', 8);
  } catch (ignored) {}
}

/** Cat error message de mot row log khong bi phinh qua lon. */
function bbErrorMessage_(error) {
  if (!error) return 'Unknown error';
  return String(error.message || error).slice(0, 1000);
}
