// Delivered only through the authenticated setup route. The committed template
// contains no credentials; configureFleetExport is added server-side on download.
export const DRIVE_SCRIPT = String.raw`
function installFleetBackup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('FLEET_ORIGIN') || !props.getProperty('FLEET_SECRET')) throw new Error('Run configureFleetExport first.');
  var folderId = props.getProperty('FLEET_FOLDER_ID');
  var folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.createFolder('ESP32 daily data');
  props.setProperty('FLEET_FOLDER_ID', folder.getId());
  // Only replace this project's own backup trigger, never unrelated triggers.
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'runFleetBackup') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('runFleetBackup').timeBased().everyHours(1).create();
  console.log('Backup trigger installed. Folder: ' + folder.getUrl());
  runFleetBackup();
}

function fleetFetch_(path, options) {
  var props = PropertiesService.getScriptProperties();
  var origin = props.getProperty('FLEET_ORIGIN');
  if (!/^https:\/\/[^/]+$/.test(origin)) throw new Error('Invalid origin.');
  options = options || {};
  options.headers = {Authorization: 'Bearer ' + props.getProperty('FLEET_SECRET')};
  options.muteHttpExceptions = true; options.followRedirects = false;
  for (var attempt = 0; attempt < 3; attempt++) {
    var response;
    try { response = UrlFetchApp.fetch(origin + path, options); }
    catch (error) { if (attempt === 2) throw new Error('Export network request failed.'); Utilities.sleep(1000 * (attempt + 1)); continue; }
    var code = response.getResponseCode();
    if (code === 200) return JSON.parse(response.getContentText());
    if ((code === 429 || code >= 500) && attempt < 2) { Utilities.sleep(1000 * (attempt + 1)); continue; }
    throw new Error('Export request failed with HTTP ' + code + '. No partial file is accepted.');
  }
  throw new Error('Export request failed.');
}

function fleetHash_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes).map(function(byte) {
    return ('0' + (byte & 255).toString(16)).slice(-2);
  }).join('');
}

function fleetCollectDay_(date, snapshot, deadline) {
  var cursor = '', rows = 0, total = -1, parts = ['\ufeff'], seen = {}, size = 3;
  do {
    if (Date.now() > deadline) throw new Error('Time budget reached; retry will restart this date without saving a partial file.');
    var path = '/api/exports/day?date=' + encodeURIComponent(date) + '&snapshot=' + encodeURIComponent(snapshot);
    if (cursor) path += '&cursor=' + encodeURIComponent(cursor);
    var page = fleetFetch_(path);
    if (page.date !== date || page.node !== '' || page.snapshot !== snapshot || !Number.isInteger(page.rows) ||
        typeof page.csv !== 'string' || typeof page.header !== 'string' ||
        !(page.nextCursor === null || typeof page.nextCursor === 'string')) throw new Error('Invalid export page.');
    if (total < 0) {
      total = page.total;
      if (!Number.isInteger(total) || total < 0 || total > 1000000) throw new Error('Export count exceeds limit.');
      parts.push(page.header);
    }
    rows += page.rows; parts.push(page.csv); size += Utilities.newBlob(page.csv).getBytes().length;
    if (size > 45000000 || rows > total) throw new Error('Export exceeds size/count limit; preserve previous file and investigate.');
    cursor = page.nextCursor || '';
    if (cursor && seen[cursor]) throw new Error('Export cursor did not advance.');
    seen[cursor] = true;
  } while (cursor);
  if (rows !== total) throw new Error('Export count mismatch. Previous file preserved.');
  return {csv: parts.join(''), rows: rows};
}

function fleetSaveDay_(folder, date, snapshot, result) {
  var name = 'sensor-data-' + date + '.csv';
  var blob = Utilities.newBlob(result.csv, 'text/csv', name);
  var hash = fleetHash_(blob.getBytes());
  var matches = folder.getFilesByName(name), file = matches.hasNext() ? matches.next() : null;
  if (matches.hasNext()) throw new Error('Duplicate daily filenames found; inspect folder before continuing.');
  if (file) {
    // File.setContent has a 10 MB limit. Drive media upload supports our larger CSVs.
    var response = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(file.getId()) + '?uploadType=media', {
      method: 'patch', contentType: 'text/csv', payload: blob.getBytes(), muteHttpExceptions: true,
      headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}
    });
    if (response.getResponseCode() !== 200) throw new Error('Drive replacement failed; no backup receipt recorded.');
    file = DriveApp.getFileById(file.getId());
  } else { file = folder.createFile(blob); }
  // Verify the actual Drive bytes before the server records a successful backup.
  var stored = file.getBlob().getBytes();
  if (stored.length !== blob.getBytes().length || fleetHash_(stored) !== hash) throw new Error('Drive readback hash mismatch.');
  fleetFetch_('/api/exports/backup', {method: 'post', contentType: 'application/json', payload: JSON.stringify({
    date: date, snapshot: snapshot, rows: result.rows, bytes: stored.length, sha256: hash, fileId: file.getId()
  })});
  console.log('Verified ' + name + ': ' + result.rows + ' readings.');
}

function runFleetBackup() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var folder = DriveApp.getFolderById(props.getProperty('FLEET_FOLDER_ID'));
    var planText = props.getProperty('FLEET_PENDING_PLAN');
    var plan = planText ? JSON.parse(planText) : fleetFetch_('/api/exports/plan' +
      (props.getProperty('FLEET_WATERMARK') ? '?since=' + encodeURIComponent(props.getProperty('FLEET_WATERMARK')) : ''));
    if (!Array.isArray(plan.dates) || typeof plan.snapshot !== 'string') throw new Error('Invalid backup plan.');
    props.setProperty('FLEET_PENDING_PLAN', JSON.stringify(plan));
    var deadline = Date.now() + 240000;
    while (plan.dates.length) {
      if (Date.now() > deadline - 30000) return; // Resume remaining dates at next hourly trigger.
      var date = plan.dates[0];
      var result = fleetCollectDay_(date, plan.snapshot, deadline);
      fleetSaveDay_(folder, date, plan.snapshot, result);
      plan.dates.shift(); props.setProperty('FLEET_PENDING_PLAN', JSON.stringify(plan));
    }
    // Advance only after every planned date was uploaded and readback-verified.
    props.setProperty('FLEET_WATERMARK', plan.snapshot);
    props.deleteProperty('FLEET_PENDING_PLAN');
  } finally { lock.releaseLock(); }
}
`;
