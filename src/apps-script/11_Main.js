/** Tao menu dieu khien trong Google Sheets. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('BigBoy')
    .addItem('Setup / Upgrade V1.2', 'setupBigBoyV12')
    .addItem('Validate Setup', 'validateBigBoyV12')
    .addSeparator()
    .addItem('Set Nansen API Key', 'setNansenApiKey')
    .addItem('Clear Nansen API Key', 'clearNansenApiKey')
    .addItem('Show Nansen Budget', 'showNansenBudget')
    .addSeparator()
    .addItem('Run Nansen Discovery', 'runNansenDiscovery')
    .addItem('Score Priority Wallets', 'scorePriorityWallets')
    .addItem('Rebuild Wallet Cohort', 'rebuildWalletCohort')
    .addItem('Sync Cohort to Tracked Wallets', 'syncCohortToTrackedWallets')
    .addItem('Refresh Token Wallet Quality', 'refreshTokenWalletQuality')
    .addSeparator()
    .addItem('Run Wallet Pipeline', 'runWalletPipeline')
    .addItem('Run V1.2 Self Tests', 'runV12SelfTests')
    .addToUi();
}

/**
 * Chay full wallet pipeline theo dung dependency:
 * discovery -> scoring -> cohort -> tracked wallets -> token quality.
 *
 * SKIPPED_BUDGET la trang thai du kien, nen pipeline tiep tuc cac buoc khong ton API.
 * Moi loi khac duoc throw ngay de tranh rebuild/sync tu du lieu nua chay nua hong.
 */
function runWalletPipeline() {
  var steps = [];
  try {
    var discovery = runNansenDiscovery();
    steps.push(discovery && discovery.noData ? 'discovery no data' : 'discovery');
  } catch (error) {
    if (String(error.message || '').indexOf('SKIPPED_BUDGET') < 0) throw error;
    steps.push('discovery skipped by budget');
  }

  try {
    scorePriorityWallets();
    steps.push('scoring');
  } catch (error2) {
    if (String(error2.message || '').indexOf('SKIPPED_BUDGET') < 0) throw error2;
    steps.push('scoring skipped by budget');
  }

  // Cac buoc ben duoi chi doc/ghi Sheet, khong goi Nansen.
  rebuildWalletCohort();
  syncCohortToTrackedWallets();
  refreshTokenWalletQuality();
  bbToast_('Wallet pipeline finished: ' + steps.join(', '), 'BigBoy');
}
