// ─────────────────────────────────────────────────────────────────────────────
// Switzerland Trip Tracker — Google Apps Script backend
//
// SETUP INSTRUCTIONS:
//   1. Open your Google Sheet → Extensions → Apps Script
//   2. Paste this entire file into the editor (replace any existing code)
//   3. Click Deploy → New deployment → Type: Web App
//      - Execute as: Me
//      - Who has access: Anyone
//   4. Click Deploy → copy the Web App URL
//   5. Paste that URL into index.html as window.TRACKER_API_URL
// ─────────────────────────────────────────────────────────────────────────────

const EXPENSES_TAB  = 'Expenses';
const SETTINGS_TAB  = 'Settings';
const BUDGET_TAB    = 'Sheet1';    // existing tab with Fixed/Variable budget rows
const SECRET        = PropertiesService.getScriptProperties().getProperty('TRACKER_SECRET');

// ─── HTTP entry points ───────────────────────────────────────────────────────

function doGet(e) {
  if ((e.parameter.secret || '') !== SECRET) return jsonOut({ error: 'Unauthorized' });
  try {
    return jsonOut(getState_());
  } catch (err) {
    return jsonOut({ error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if ((body.secret || '') !== SECRET) return jsonOut({ error: 'Unauthorized' });
    let result;
    switch (body.action) {
      case 'addEntry':    result = addEntry_(body.entry);           break;
      case 'updateEntry': result = updateEntry_(body.id, body.patch); break;
      case 'deleteEntry': result = deleteEntry_(body.id);            break;
      case 'setSettings': result = setSettings_(body.patch);         break;
      default: result = { error: 'Unknown action: ' + body.action };
    }
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ error: err.message });
  }
}

function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Read state ──────────────────────────────────────────────────────────────

function getSettings_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_TAB);
  const settings = { chfRate: 123, warningThreshold: 80, friendName: 'Friend' };
  if (!sheet) return settings;
  sheet.getDataRange().getValues().forEach(r => {
    if (r[0] === 'chfRate')          settings.chfRate          = Number(r[1]);
    if (r[0] === 'warningThreshold') settings.warningThreshold = Number(r[1]);
    if (r[0] === 'friendName')       settings.friendName       = String(r[1] || 'Friend');
  });
  return settings;
}

function getBudget_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BUDGET_TAB);
  const fixedCosts = [], variableBudgets = [];
  if (!sheet || sheet.getLastRow() < 2) return { fixedCosts, variableBudgets };

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
  rows.forEach(r => {
    const type = String(r[1]).trim();
    if (type !== 'Fixed' && type !== 'Variable') return; // skip totals/blanks
    const entry = {
      category: String(r[0]).trim(),
      budget:   Number(r[2]) || 0,
      note:     String(r[3] || '').trim(),
    };
    if (type === 'Fixed') {
      fixedCosts.push({ ...entry, actual: Number(r[4]) || 0 });
    } else {
      variableBudgets.push(entry);
    }
  });
  return { fixedCosts, variableBudgets };
}

function getState_() {
  const settings = getSettings_();
  const { fixedCosts, variableBudgets } = getBudget_();
  let entries = [];

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPENSES_TAB);
  if (sheet && sheet.getLastRow() > 1) {
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();
    entries = rows
      .filter(r => r[0])   // row must have an ID
      .map(r => ({
        id:              String(r[0]),
        ts:              new Date(r[1]).getTime(),
        category:        String(r[2]),
        person:          String(r[3]),
        amount:          Number(r[4]),
        currency:        String(r[5]),
        amountINR:       Number(r[6]),
        note:            String(r[7] || ''),
        sharedWithFriend: r[8] === true || r[8] === 'TRUE',
        paidBy:          String(r[9]  || 'us'),
        splitRatio:      String(r[10] || '50-50'),
      }))
      .sort((a, b) => b.ts - a.ts);
  }

  return { settings, entries, fixedCosts, variableBudgets };
}

// ─── Sheet helpers ───────────────────────────────────────────────────────────

function ensureTab_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#1c242d')
        .setFontColor('#ecebe6');
    }
  }
  return sheet;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitize_(v) {
  const s = String(v || '').trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

// ─── Mutations ───────────────────────────────────────────────────────────────

function addEntry_(entry) {
  const sheet = ensureTab_(EXPENSES_TAB, ['ID','Timestamp','Category','Person','Amount','Currency','Amount INR','Note','Shared','Paid By','Split']);
  const settings = getSettings_();
  const id = 'e' + Date.now() + Math.random().toString(36).slice(2, 6);
  const amount = Number(entry.amount) || 0;
  const amountINR = entry.currency === 'CHF'
    ? Math.round(amount * settings.chfRate)
    : Math.round(amount);

  sheet.appendRow([
    id,
    new Date().toISOString(),
    sanitize_(entry.category),
    sanitize_(entry.person),
    amount,
    entry.currency === 'CHF' ? 'CHF' : 'INR',
    amountINR,
    sanitize_(entry.note),
    entry.sharedWithFriend || false,
    entry.paidBy || 'us',
    entry.splitRatio || '50-50',
  ]);
  return { ok: true, id };
}

function updateEntry_(id, patch) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPENSES_TAB);
  if (!sheet || sheet.getLastRow() <= 1) return { ok: false, error: 'Not found' };

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();
  const idx  = rows.findIndex(r => String(r[0]) === String(id));
  if (idx < 0) return { ok: false, error: 'Not found' };

  const settings  = getSettings_();
  const row       = rows[idx];
  const amount    = patch.amount   != null ? Number(patch.amount)  : Number(row[4]);
  const currency  = patch.currency != null ? patch.currency        : String(row[5]);
  const amountINR = currency === 'CHF'
    ? Math.round(amount * settings.chfRate)
    : Math.round(amount);

  sheet.getRange(idx + 2, 1, 1, 11).setValues([[
    row[0],
    row[1],
    sanitize_(patch.category != null ? patch.category : row[2]),
    sanitize_(patch.person   != null ? patch.person   : row[3]),
    amount,
    currency,
    amountINR,
    sanitize_(patch.note            != null ? patch.note            : row[7]),
    patch.sharedWithFriend          != null ? patch.sharedWithFriend : row[8],
    patch.paidBy                    != null ? patch.paidBy           : (row[9] || 'us'),
    patch.splitRatio                != null ? patch.splitRatio        : (row[10] || '50-50'),
  ]]);
  return { ok: true };
}

function deleteEntry_(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPENSES_TAB);
  if (!sheet || sheet.getLastRow() <= 1) return { ok: false };

  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const idx = ids.findIndex(r => String(r[0]) === String(id));
  if (idx < 0) return { ok: false, error: 'Not found' };

  sheet.deleteRow(idx + 2);
  return { ok: true };
}

function setSettings_(patch) {
  const sheet = ensureTab_(SETTINGS_TAB, ['Key', 'Value']);
  const rows  = sheet.getDataRange().getValues();

  Object.entries(patch).forEach(([key, val]) => {
    const idx = rows.findIndex(r => r[0] === key);
    if (idx >= 0) {
      sheet.getRange(idx + 1, 2).setValue(val);
      rows[idx][1] = val;
    } else {
      sheet.appendRow([key, val]);
      rows.push([key, val]);
    }
  });

  // Re-convert all existing CHF entries when the rate changes
  if (patch.chfRate != null) {
    const expSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPENSES_TAB);
    if (expSheet && expSheet.getLastRow() > 1) {
      const data = expSheet.getRange(2, 1, expSheet.getLastRow() - 1, 8).getValues();
      data.forEach((row, i) => {
        if (String(row[5]) === 'CHF') {
          expSheet.getRange(i + 2, 7).setValue(Math.round(Number(row[4]) * patch.chfRate));
        }
      });
    }
  }

  return { ok: true };
}
