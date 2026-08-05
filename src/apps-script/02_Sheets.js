/** Spreadsheet schema, migrations and table helpers. */
function setupBigBoyV12() {
  return bbWithScriptLock_(function () {
    var run = bbStartRun_('SETUP_V1_2', 'SYSTEM');
    try {
      var ss = bbGetSpreadsheet_();
      bbEnsureReadme_(ss);
      Object.keys(BB_HEADERS).forEach(function (sheetName) {
        bbEnsureSheet_(ss, sheetName, BB_HEADERS[sheetName]);
      });
      bbSeedConfigDefaults_();
      bbApplySheetFormatting_(ss);
      bbFinishRun_(run, 'SUCCESS', { result_count: Object.keys(BB_HEADERS).length + 1 });
      bbToast_('V1.2 schema is ready. Set NANSEN_API_KEY, then enable NANSEN_ENABLED.', 'BigBoy setup');
      return true;
    } catch (error) {
      bbFinishRun_(run, 'FAILED', { error_message: bbErrorMessage_(error) });
      throw error;
    }
  });
}

function bbEnsureReadme_(ss) {
  var sheet = ss.getSheetByName(BB_SHEETS.README) || ss.insertSheet(BB_SHEETS.README);
  var rows = [
    ['BigBoy Smart Money Wallet Finder', 'V' + BB_VERSION],
    ['Schema version', BB_SCHEMA_VERSION],
    ['Purpose', 'Discover and score Nansen wallets. Research only; NOT A BUY SIGNAL.'],
    ['First run', 'BigBoy > Setup / Upgrade V1.2'],
    ['Secret setup', 'BigBoy > Set Nansen API Key'],
    ['Enable API', 'Set NANSEN_ENABLED=TRUE in 01_CONFIG after key setup'],
    ['Recommended Free budget', '9 credits/day, 1 wallet scoring/run'],
    ['Run order', 'Discovery → Score Priority Wallets → Rebuild Cohort → Sync Tracked Wallets'],
    ['Known limitation', 'No entity clustering, MM filtering, aggregator attribution or advanced token gate until V1.3–V1.5'],
    ['Data policy', 'API-derived metrics are rebuilt by code. Do not edit 07_WALLET_METRICS or 08_WALLET_COHORT manually.'],
    ['Updated at', bbNowIso_()]
  ];
  sheet.clear();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
  sheet.setColumnWidth(2, 700);
}

function bbEnsureSheet_(ss, name, expectedHeaders) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var lastColumn = sheet.getLastColumn();
  var existing = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function (value) { return String(value || '').trim(); }) : [];
  var existingMap = {};
  existing.forEach(function (header, index) { if (header) existingMap[header] = index + 1; });
  var nextColumn = Math.max(existing.length, 0) + 1;
  expectedHeaders.forEach(function (header) {
    if (!existingMap[header]) {
      sheet.getRange(1, nextColumn).setValue(header);
      existingMap[header] = nextColumn;
      nextColumn += 1;
    }
  });
  if (!existing.length && expectedHeaders.length) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  }
  sheet.setFrozenRows(1);
  if (!sheet.getFilter() && sheet.getLastColumn() > 0) {
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), sheet.getLastColumn()).createFilter();
  }
  return sheet;
}

function bbApplySheetFormatting_(ss) {
  Object.keys(BB_HEADERS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var columns = sheet.getLastColumn();
    if (columns) {
      sheet.getRange(1, 1, 1, columns).setFontWeight('bold').setWrap(true);
      sheet.autoResizeColumns(1, columns);
    }
  });
  var configSheet = ss.getSheetByName(BB_SHEETS.CONFIG);
  if (configSheet) configSheet.setColumnWidth(3, 500);
}

function bbGetTable_(sheetName) {
  var sheet = bbGetSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Missing sheet: ' + sheetName + '. Run Setup / Upgrade V1.2.');
  var values = sheet.getDataRange().getValues();
  if (!values.length) return { sheet: sheet, headers: [], rows: [], headerMap: {} };
  var headers = values[0].map(function (value) { return String(value || '').trim(); });
  var headerMap = {};
  headers.forEach(function (header, index) { if (header) headerMap[header] = index; });
  var rows = values.slice(1).filter(function (row) {
    return row.some(function (value) { return value !== '' && value !== null; });
  });
  return { sheet: sheet, headers: headers, rows: rows, headerMap: headerMap };
}

function bbRowsToObjects_(table) {
  return table.rows.map(function (row) {
    var object = {};
    table.headers.forEach(function (header, index) { if (header) object[header] = row[index]; });
    return object;
  });
}

function bbObjectToRow_(object, headers) {
  return headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(object, header) ? object[header] : '';
  });
}

function bbReplaceTableRows_(sheetName, objects) {
  var table = bbGetTable_(sheetName);
  var sheet = table.sheet;
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  if (objects && objects.length) {
    var values = objects.map(function (object) { return bbObjectToRow_(object, table.headers); });
    sheet.getRange(2, 1, values.length, table.headers.length).setValues(values);
  }
}

function bbUpsertObjects_(sheetName, keyField, objects) {
  if (!objects || !objects.length) return { inserted: 0, updated: 0 };
  var table = bbGetTable_(sheetName);
  if (typeof table.headerMap[keyField] === 'undefined') throw new Error('Missing key column ' + keyField + ' in ' + sheetName);
  var existing = bbRowsToObjects_(table);
  var byKey = {};
  existing.forEach(function (object, index) {
    var key = String(object[keyField] || '');
    if (key) byKey[key] = index;
  });
  var inserted = 0;
  var updated = 0;
  objects.forEach(function (incoming) {
    var key = String(incoming[keyField] || '');
    if (!key) throw new Error('Cannot upsert ' + sheetName + ': empty ' + keyField);
    if (Object.prototype.hasOwnProperty.call(byKey, key)) {
      existing[byKey[key]] = Object.assign({}, existing[byKey[key]], incoming);
      updated += 1;
    } else {
      byKey[key] = existing.length;
      existing.push(incoming);
      inserted += 1;
    }
  });
  bbReplaceTableRows_(sheetName, existing);
  return { inserted: inserted, updated: updated };
}

function bbSeedConfigDefaults_() {
  var table = bbGetTable_(BB_SHEETS.CONFIG);
  var existing = bbRowsToObjects_(table);
  var byKey = {};
  existing.forEach(function (row) { byKey[String(row.key || '')] = row; });
  BB_CONFIG_DEFAULTS.forEach(function (item) {
    var key = item[0];
    if (!byKey[key]) {
      byKey[key] = { key: key, value: item[1], description: item[2] };
      existing.push(byKey[key]);
    } else if (!byKey[key].description) {
      byKey[key].description = item[2];
    }
  });
  bbReplaceTableRows_(BB_SHEETS.CONFIG, existing);
}

function validateBigBoyV12() {
  var issues = [];
  var ss = bbGetSpreadsheet_();
  Object.keys(BB_HEADERS).forEach(function (sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      issues.push('Missing sheet: ' + sheetName);
      return;
    }
    var actual = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    BB_HEADERS[sheetName].forEach(function (header) {
      if (actual.indexOf(header) < 0) issues.push(sheetName + ': missing column ' + header);
    });
  });
  try { bbGetConfig_(); } catch (error) { issues.push(error.message); }
  var key = PropertiesService.getScriptProperties().getProperty('NANSEN_API_KEY');
  if (!key) issues.push('NANSEN_API_KEY is not set in Script Properties');
  if (issues.length) {
    bbToast_(issues.slice(0, 5).join('\n'), 'Validation failed');
    throw new Error(issues.join('; '));
  }
  bbToast_('V1.2 setup is valid.', 'BigBoy');
  return true;
}
