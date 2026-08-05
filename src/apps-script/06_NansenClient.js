/** Minimal Nansen API client based on committed V1.2 response fixtures. */
function bbNansenPost_(path, payload, estimatedCost, purpose) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('NANSEN_API_KEY');
  if (!apiKey) throw new Error('NANSEN_API_KEY is missing');
  bbReserveNansenCredits_(estimatedCost);
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  var response = bbFetchNansenWithRetry_(BB_NANSEN_BASE_URL + path, options, purpose);
  var status = response.getResponseCode();
  var headers = response.getAllHeaders ? response.getAllHeaders() : response.getHeaders();
  bbAdjustNansenCredits_(estimatedCost, bbExtractObservedCreditCost_(headers));
  var text = response.getContentText();
  var body = bbParseNansenBody_(text, status, purpose);
  if (status < 200 || status >= 300) {
    var message = body.message || body.error || body.raw || ('HTTP ' + status);
    var error = new Error('Nansen ' + purpose + ' failed (' + status + '): ' + message);
    error.httpStatus = status;
    error.responseBody = body;
    throw error;
  }
  return { body: body, headers: headers, status: status, estimatedCost: estimatedCost };
}

function bbFetchNansenWithRetry_(url, options, purpose) {
  var response;
  for (var attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = UrlFetchApp.fetch(url, options);
    } catch (networkError) {
      if (attempt === 0) {
        Utilities.sleep(1000);
        continue;
      }
      throw new Error('Nansen network error for ' + purpose + ': ' + networkError.message);
    }
    var status = response.getResponseCode();
    if (attempt === 0 && (status === 429 || status >= 500)) {
      var headers = response.getAllHeaders ? response.getAllHeaders() : response.getHeaders();
      var retryAfter = bbToNumber_(headers['Retry-After'] || headers['retry-after'], 1);
      Utilities.sleep(bbClamp_(retryAfter, 1, 10) * 1000);
      continue;
    }
    return response;
  }
  return response;
}

function bbParseNansenBody_(text, status, purpose) {
  if (!text) return {};
  try {
    return JSON.parse(String(text).replace(/^\uFEFF/, ''));
  } catch (error) {
    if (status >= 200 && status < 300) {
      throw new Error('Nansen ' + purpose + ' returned invalid JSON: ' + error.message);
    }
    return { raw: String(text).slice(0, 1000) };
  }
}

function bbFetchDiscovery_(config) {
  var payload = {
    chains: [config.CHAIN],
    filters: { trade_value_usd: { min: config.MIN_DISCOVERY_TRADE_USD } },
    pagination: { page: 1, per_page: config.NANSEN_DISCOVERY_LIMIT }
  };
  var result = bbNansenPost_('/smart-money/dex-trades', payload, BB_NANSEN_COSTS.DISCOVERY, 'smart-money discovery');
  bbValidateDiscoveryResponse_(result.body);
  return result;
}

function bbFetchPnlSummary_(wallet, chain, days) {
  var to = new Date();
  var from = new Date(to.getTime() - Number(days) * 86400000);
  var payload = {
    address: wallet,
    chain: chain,
    date: { from: from.toISOString(), to: to.toISOString() }
  };
  var result = bbNansenPost_('/profiler/address/pnl-summary', payload, BB_NANSEN_COSTS.PNL_SUMMARY, 'PnL summary ' + days + 'D');
  bbValidatePnlSummaryResponse_(result.body);
  return result;
}

function bbFetchPnlDetailAll_(wallet, chain, days, config) {
  var to = new Date();
  var from = new Date(to.getTime() - Number(days) * 86400000);
  var allRows = [];
  var pagesFetched = 0;
  var lastBody = null;
  for (var page = 1; page <= config.NANSEN_MAX_PNL_PAGES; page += 1) {
    var payload = {
      address: wallet,
      chain: chain,
      date: { from: from.toISOString(), to: to.toISOString() },
      pagination: { page: page, per_page: config.NANSEN_DETAIL_PER_PAGE }
    };
    var result = bbNansenPost_('/profiler/address/pnl', payload, BB_NANSEN_COSTS.PNL_DETAIL_PAGE, 'PnL detail ' + days + 'D page ' + page);
    bbValidatePnlDetailResponse_(result.body);
    lastBody = result.body;
    pagesFetched += 1;
    allRows = allRows.concat(result.body.data || []);
    if (!result.body.pagination || bbToBoolean_(result.body.pagination.is_last_page, false)) break;
  }
  if (lastBody && lastBody.pagination && !bbToBoolean_(lastBody.pagination.is_last_page, false) && pagesFetched >= config.NANSEN_MAX_PNL_PAGES) {
    throw new Error('WAIT_DATA: PnL detail exceeded NANSEN_MAX_PNL_PAGES=' + config.NANSEN_MAX_PNL_PAGES);
  }
  return { data: allRows, pagesFetched: pagesFetched };
}

function bbValidateDiscoveryResponse_(body) {
  if (!body || !Array.isArray(body.data)) throw new Error('Discovery contract error: data[] missing');
  body.data.forEach(function (row, index) {
    if (!row.chain || !row.trader_address || typeof row.trade_value_usd === 'undefined') {
      throw new Error('Discovery contract error at row ' + index + ': chain/trader_address/trade_value_usd required');
    }
  });
}

function bbValidatePnlSummaryResponse_(body) {
  var fields = ['realized_pnl_usd', 'win_rate', 'traded_token_count'];
  var missing = fields.filter(function (field) { return !body || typeof body[field] === 'undefined' || body[field] === null; });
  if (missing.length) throw new Error('PnL summary contract error: missing ' + missing.join(', '));
}

function bbValidatePnlDetailResponse_(body) {
  if (!body || !Array.isArray(body.data)) throw new Error('PnL detail contract error: data[] missing');
  body.data.forEach(function (row, index) {
    if (!row.token_address || typeof row.pnl_usd_realised === 'undefined') {
      throw new Error('PnL detail contract error at row ' + index + ': token_address/pnl_usd_realised required');
    }
  });
}
