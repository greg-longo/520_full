/**
 * DTSC 520 — LDA Lookup tab builder.
 *
 * Run setupLdaLookup() once from the Apps Script editor (or re-run any time
 * you want to rebuild the tab). It creates a "LDA Lookup" sheet with:
 *
 *   - An email input cell
 *   - Last activity date, total events, days-since (live formulas)
 *   - A scrollable list of every event for that student, newest first
 *
 * The formulas reference the Events sheet directly, so the tab updates the
 * instant a new row is appended. Nothing else to wire up.
 */
function setupLdaLookup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = 'LDA Lookup';
  let s = ss.getSheetByName(name);
  if (s) ss.deleteSheet(s);
  s = ss.insertSheet(name, 0);  // 0 = first tab

  // ── Layout ──────────────────────────────────────────────────────────────
  s.setColumnWidth(1, 200);
  s.setColumnWidth(2, 360);
  s.setColumnWidth(3, 140);
  s.setColumnWidth(4, 140);
  s.setColumnWidth(5, 100);
  s.setColumnWidth(6, 100);

  // Title
  s.getRange('A1:F1').merge()
    .setValue('LDA Lookup — Last Date of Academic Activity')
    .setFontSize(16).setFontWeight('bold')
    .setBackground('#8B1C40').setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  s.setRowHeight(1, 36);

  // Instruction line
  s.getRange('A2:F2').merge()
    .setValue('Type a student email below. Results update automatically. Source: the Events tab.')
    .setFontStyle('italic').setFontColor('#646469')
    .setBackground('#f5f3f0');

  // Input
  s.getRange('A4').setValue('Student email').setFontWeight('bold');
  s.getRange('B4').setValue('')
    .setBackground('#fff7d6')
    .setBorder(true, true, true, true, false, false,
               '#8B1C40', SpreadsheetApp.BorderStyle.SOLID_THICK);

  // Summary metrics
  s.getRange('A6').setValue('Last activity (LDA)').setFontWeight('bold');
  s.getRange('B6').setFormula(
    "=IFERROR(TEXT(MAX(FILTER(Events!A:A, LOWER(Events!B:B)=LOWER($B$4))), \"yyyy-mm-dd hh:mm\"), \"— no activity found —\")"
  ).setFontFamily('IBM Plex Mono').setFontSize(13);

  s.getRange('A7').setValue('Days since LDA').setFontWeight('bold');
  s.getRange('B7').setFormula(
    "=IFERROR(INT(NOW() - MAX(FILTER(Events!A:A, LOWER(Events!B:B)=LOWER($B$4)))), \"\")"
  );

  s.getRange('A8').setValue('Total events on file').setFontWeight('bold');
  s.getRange('B8').setFormula(
    "=SUMPRODUCT((LOWER(Events!B2:B)=LOWER($B$4))*1)"
  );

  s.getRange('A9').setValue('Student name (most recent)').setFontWeight('bold');
  s.getRange('B9').setFormula(
    "=IFERROR(INDEX(SORT(FILTER(Events!C:C, LOWER(Events!B:B)=LOWER($B$4)), 1, FALSE), 1), \"\")"
  );

  // Section divider
  s.getRange('A11:F11').merge()
    .setValue('All events for this student, newest first')
    .setFontWeight('bold').setBackground('#646469').setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // Header row
  const headers = ['Date / Time', 'Event Type', 'Event ID', 'Score', 'Max', 'Pct'];
  s.getRange('A12:F12').setValues([headers])
    .setFontWeight('bold').setBackground('#2A7195').setFontColor('#ffffff');
  s.setFrozenRows(12);

  // The big query: pull A (timestamp), D (event_type), E (event_id),
  // F (score), G (max_score), and a computed pct, sorted newest first.
  // We use ARRAYFORMULA + SORT + FILTER + IFERROR so the table grows live.
  s.getRange('A13').setFormula([
    '=IFERROR(SORT(FILTER({',
    '  Events!A2:A,',
    '  Events!D2:D,',
    '  Events!E2:E,',
    '  Events!F2:F,',
    '  Events!G2:G,',
    '  IFERROR(Events!F2:F/Events!G2:G, "")',
    '}, LOWER(Events!B2:B)=LOWER($B$4)), 1, FALSE), "")'
  ].join(''));

  // Format the percent column whenever values land
  s.getRange('F13:F').setNumberFormat('0%');
  s.getRange('A13:A').setNumberFormat('yyyy-mm-dd hh:mm');

  // Default cursor on the input cell
  s.setActiveRange(s.getRange('B4'));

  SpreadsheetApp.getActiveSpreadsheet().toast('LDA Lookup tab ready.');
}
