/**
 * Personal Organiser — Google Sheets backup.
 *
 * Deploy this as a Web App (Execute as: Me, Who has access: Anyone) and
 * paste the resulting /exec URL into the app's Settings → Google Sheets
 * backup. The app POSTs its full task list here every few seconds after a
 * change; this script rewrites two tabs each time:
 *
 *   - "Task Log"  — one row per task, most recent addition on top.
 *   - "Backup"    — a full JSON snapshot, for disaster recovery via the
 *                   app's Import JSON feature.
 *
 * This is a one-way sync (device -> sheet). If you use the app on more than
 * one device, treat the sheet as a read-only combined view; keep editing on
 * one device and use Export/Import JSON to move data between devices.
 */

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const tasks = payload.tasks || [];
    writeTaskLog(tasks);
    writeBackup(payload);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, count: tasks.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function writeTaskLog(tasks) {
  const sheet = getSheet("Task Log");
  sheet.clear();
  const header = ["Added At", "Category", "Text", "Priority", "Due At", "Repeat", "Tags", "Status", "Completed At", "Last Touched"];
  const sorted = tasks.slice().sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  const rows = sorted.map((t) => [
    t.addedAt || "",
    t.category || "",
    t.text || "",
    t.priority || "",
    t.dueAt || "",
    t.repeat || "",
    (t.tags || []).join(", "),
    t.completedAt ? "Done" : "Open",
    t.completedAt || "",
    t.lastTouchedAt || "",
  ]);
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight("bold");
  if (rows.length) sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, header.length);
}

function writeBackup(payload) {
  const sheet = getSheet("Backup");
  sheet.clear();
  const json = JSON.stringify(payload);
  const CHUNK = 45000; // stay under Sheets' per-cell character limit
  const chunks = [];
  for (let i = 0; i < json.length; i += CHUNK) chunks.push(json.slice(i, i + CHUNK));
  sheet.getRange(1, 1).setValue("Full JSON snapshot below — join the cells in column A to restore via Import JSON.");
  sheet.getRange(2, 1, chunks.length, 1).setValues(chunks.map((c) => [c]));
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, message: "Personal Organiser sync endpoint is live." }))
    .setMimeType(ContentService.MimeType.JSON);
}
