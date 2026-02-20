// =========================================================
// Google Apps Script — Metadata Repository Backend
// Saves form data to 3 sheets: Metadata_Repository,
// Data_Dictionary, Glossary (all share dataset_id as FK)
// =========================================================

// Headers definition — single source of truth
const HEADERS = {
  Metadata_Repository: [
    'dataset_id', 'submitter_agency', 'timestamp', 'business_domain', 'title', 'description',
    'objective', 'keywords', 'topic_category', 'gov_data_category',
    'classification', 'dataset_type', 'functional_role', 'data_structure',
    'license', 'owner', 'maintainer', 'email', 'source', 'file_format',
    'update_freq_unit', 'update_freq_value', 'geo_coverage', 'access_url',
    'created_date', 'last_modified_date', 'accessible_condition', 'sponsor',
    'unit_of_analysis', 'language'
  ],
  Data_Dictionary: [
    'dataset_id', 'submitter_agency', 'business_domain', 'field_name', 'description', 'data_type',
    'data_format', 'validation', 'source', 'has_pii', 'classification',
    'dissemination', 'size', 'remarks'
  ],
  Glossary: [
    'dataset_id', 'submitter_agency', 'business_domain', 'term', 'definition', 'source'
  ]
};

/**
 * Ensures a sheet exists and has headers on row 1.
 * If the sheet is brand new or row 1 is empty, writes headers.
 */
function ensureSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  // Write headers if the sheet is empty (no data at all)
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
    sheet.setFrozenRows(1); // Freeze header row for easy filtering
  }
  return sheet;
}

/**
 * Main entry point — called by the HTML form via fetch (no-cors POST).
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Ensure all 3 sheets exist with headers
    const metaSheet = ensureSheet(ss, 'Metadata_Repository');
    const dictSheet = ensureSheet(ss, 'Data_Dictionary');
    const glossSheet = ensureSheet(ss, 'Glossary');

    // Generate a unique ID and timestamp for this submission
    const datasetId = Utilities.getUuid();
    const timestamp = new Date();
    const domain = data.domain || 'Unknown';
    const agency = data.submitterAgency || 'Unknown';

    // --- Save to Metadata_Repository ---
    const metaRow = [
      datasetId,
      agency,
      timestamp,
      domain,
      data.title || '',
      data.description || '',
      data.objective || '',
      Array.isArray(data.keywords) ? data.keywords.join(', ') : (data.keywords || ''),
      data.topicCategory || '',
      data.govDataCategory || '',
      data.classification || '',
      data.datasetType || '',
      data.functionalRole || '',
      data.dataStructure || '',
      data.license || '',
      data.owner || '',
      data.maintainer || '',
      data.email || '',
      data.source || '',
      data.fileFormat || '',
      data.updateFreqUnit || '',
      data.updateFreqValue || '',
      data.geoCoverage || '',
      data.accessUrl || '',
      data.createdDate || '',
      data.lastModifiedDate || '',
      data.accessibleCondition || '',
      data.sponsor || '',
      data.unitOfAnalysis || '',
      data.language || 'th'
    ];
    metaSheet.appendRow(metaRow);

    // --- Save to Data_Dictionary (one row per field) ---
    if (data.dictionary && data.dictionary.length > 0) {
      data.dictionary.forEach(field => {
        dictSheet.appendRow([
          datasetId,      // FK to Metadata_Repository
          agency,         // Submitter Agency
          domain,         // Domain column for easy filtering
          field.variable || '',
          field.description || '',
          field.type || '',
          field.format || '',
          field.validation || '',
          field.source || '',
          field.hasPII || 'No',
          field.classification || 'Open',
          field.dissemination || 'Public',
          field.size || '',
          field.remarks || ''
        ]);
      });
    }

    // --- Save to Glossary (one row per term) ---
    if (data.glossary && data.glossary.length > 0) {
      data.glossary.forEach(term => {
        glossSheet.appendRow([
          datasetId,      // FK to Metadata_Repository
          agency,         // Submitter Agency
          domain,         // Domain column for easy filtering
          term.term || '',
          term.definition || '',
          term.source || ''
        ]);
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success', id: datasetId }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Run this once manually from the Apps Script editor to initialize
 * all sheets with proper headers. Also safe to run on an existing spreadsheet.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, 'Metadata_Repository');
  ensureSheet(ss, 'Data_Dictionary');
  ensureSheet(ss, 'Glossary');
  SpreadsheetApp.getUi().alert('✅ Setup complete! All 3 sheets are ready.');
}
