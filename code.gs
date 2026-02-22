// =========================================================
// Google Apps Script — Metadata Repository Backend (V2 Dynamic)
// Saves form data to 3 sheets, automatically aligning headers
// and accepting any custom schema/columns.
// =========================================================

// Default INITIAL headers for a brand new sheet to establish a baseline order.
// New dynamic columns will be appended after these.
const INITIAL_HEADERS = {
  Metadata_Repository: [
    'datasetId', 'submitterAgency', 'timestamp', 'domain', 'title', 'description',
    'objective', 'keywords', 'topicCategory', 'govDataCategory',
    'classification', 'datasetType', 'functionalRole', 'dataStructure',
    'license', 'owner', 'maintainer', 'email', 'source', 'fileFormat',
    'updateFreqUnit', 'updateFreqValue', 'geoCoverage', 'accessUrl',
    'createdDate', 'lastModifiedDate', 'accessibleCondition', 'sponsor',
    'unitOfAnalysis', 'language'
  ],
  Data_Dictionary: [
    'datasetId', 'submitterAgency', 'domain', 'variable', 'description', 'type',
    'format', 'validation', 'source', 'hasPII', 'classification',
    'dissemination', 'size', 'remarks'
  ],
  Glossary: [
    'datasetId', 'submitterAgency', 'domain', 'term', 'definition', 'source'
  ]
};

function ensureSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  // Initialize with baseline headers if empty
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, INITIAL_HEADERS[name].length).setValues([INITIAL_HEADERS[name]]);
    sheet.setFrozenRows(1);
    sheet.getRange("1:1").setFontWeight("bold").setBackground("#f3f3f3");
  }
  return sheet;
}

/**
 * Dynamically appends a row based on object keys. 
 * If a key doesn't exist in the sheet's header, it adds a new column.
 */
function appendDynamicRow(sheet, dataObj) {
  const lastCol = sheet.getLastColumn();
  // Read current headers from Row 1
  let headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  
  let newHeadersAdded = false;
  const dataKeys = Object.keys(dataObj);
  
  // Find any new keys payload that are not yet columns
  for (let i = 0; i < dataKeys.length; i++) {
    const key = dataKeys[i];
    
    // Skip undefined or deeply nested objects (that aren't arrays)
    if (typeof dataObj[key] === 'object' && dataObj[key] !== null && !Array.isArray(dataObj[key]) && !(dataObj[key] instanceof Date)) {
      continue;
    }
    
    if (!headers.includes(key)) {
      headers.push(key);
      newHeadersAdded = true;
    }
  }

  // Rewrite Header Row if new columns were added
  if (newHeadersAdded) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange("1:1").setFontWeight("bold").setBackground("#f3f3f3");
  }

  // Build the array to append, in the exact order of the columns
  const rowToAppend = headers.map(header => {
    let val = dataObj[header];
    if (val === undefined || val === null) {
      return '';
    }
    if (Array.isArray(val)) {
      return val.join(', ');
    }
    return val;
  });

  sheet.appendRow(rowToAppend);
}

function updateDynamicRow(sheet, dataObj, keyName, keyValue) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    appendDynamicRow(sheet, dataObj);
    return;
  }
  
  let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const keyColIdx = headers.indexOf(keyName);
  
  if (keyColIdx !== -1) {
    const dataVals = sheet.getDataRange().getValues();
    let targetRow = -1;
    for (let i = 1; i < dataVals.length; i++) {
        // Strict comparison to avoid type issues
      if (String(dataVals[i][keyColIdx]) === String(keyValue)) {
        targetRow = i + 1;
        break;
      }
    }
    
    if (targetRow !== -1) {
      let newHeadersAdded = false;
      const dataKeys = Object.keys(dataObj);
      for (let i = 0; i < dataKeys.length; i++) {
        const key = dataKeys[i];
        if (typeof dataObj[key] === 'object' && dataObj[key] !== null && !Array.isArray(dataObj[key]) && !(dataObj[key] instanceof Date)) continue;
        if (!headers.includes(key)) {
          headers.push(key);
          newHeadersAdded = true;
        }
      }
      
      if (newHeadersAdded) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange("1:1").setFontWeight("bold").setBackground("#f3f3f3");
      }
      
      const rowToUpdate = headers.map(header => {
        let val = dataObj[header];
        if (val === undefined || val === null) return '';
        if (Array.isArray(val)) return val.join(', ');
        return val;
      });
      
      sheet.getRange(targetRow, 1, 1, rowToUpdate.length).setValues([rowToUpdate]);
      return;
    }
  }
  // Not found, just append
  appendDynamicRow(sheet, dataObj);
}

function deleteRowsByValue(sheet, keyName, keyValue) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const keyColIdx = headers.indexOf(keyName);
  
  if (keyColIdx !== -1) {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;
    const dataVals = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    // Delete from bottom up
    for (let i = dataVals.length - 1; i >= 1; i--) {
      if (String(dataVals[i][keyColIdx]) === String(keyValue)) {
        sheet.deleteRow(i + 1);
      }
    }
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // ==========================================
    // 1. Authentication Check
    // ==========================================
    if (data.action === 'login') {
      const usernameInput = (data.username || '').trim().toLowerCase();
      const passwordInput = (data.password || '').trim();
      const validPasswords = ['admin@123', 'dla123', 'diw123', 'diw2_123'];
      
      if (usernameInput === 'admin' && validPasswords.includes(passwordInput)) {
        let queryParams = '';
        if (passwordInput === 'dla123') {
           queryParams = '?id=dla2'; // fallback fallback is dla2, but keeping original logic
        } else if (passwordInput === 'diw123') {
           queryParams = '?id=diw';
        } else if (passwordInput === 'diw2_123') {
           queryParams = '?id=diw2';
        }

        return ContentService.createTextOutput(JSON.stringify({
          result: 'success',
          username: 'admin',
          queryParams: queryParams
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          result: 'error',
          message: 'Auth Failed'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // ==========================================
    // 2. Metadata Processing (Insert/Update)
    // ==========================================
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const metaSheet = ensureSheet(ss, 'Metadata_Repository');
    const dictSheet = ensureSheet(ss, 'Data_Dictionary');
    const glossSheet = ensureSheet(ss, 'Glossary');

    // Determine Action Mode
    const isUpdate = (data.action === 'update' && data.datasetId);

    // Use passed ID if update, else generate new
    const datasetId = isUpdate ? data.datasetId : Utilities.getUuid();
    const timestamp = new Date();
    const domain = data.domain || 'Unknown';
    const agency = data.submitterAgency || 'Unknown';

    // 1. Prepare Metadata Item
    // Clone incoming data, inject IDs, and remove sub-tables to isolate meta fields
    const metaObj = { ...data };
    metaObj.datasetId = datasetId;
    metaObj.timestamp = timestamp;
    delete metaObj.action;
    delete metaObj.dictionary; 
    delete metaObj.glossary;   
    
    // Process Metadata Insert/Update
    if (isUpdate) {
      updateDynamicRow(metaSheet, metaObj, 'datasetId', datasetId);
      
      // Clean up old sub-table records before replacing them
      deleteRowsByValue(dictSheet, 'datasetId', datasetId);
      deleteRowsByValue(glossSheet, 'datasetId', datasetId);
    } else {
      appendDynamicRow(metaSheet, metaObj);
    }

    // 2. Prepare Dictionary Items
    if (data.dictionary && data.dictionary.length > 0) {
      data.dictionary.forEach(field => {
        // Build flat object
        const fieldObj = {
          datasetId: datasetId,
          submitterAgency: agency,
          domain: domain,
          ...field
        };
        appendDynamicRow(dictSheet, fieldObj);
      });
    }

    // 3. Prepare Glossary Items
    if (data.glossary && data.glossary.length > 0) {
      data.glossary.forEach(term => {
        // Build flat object
        const termObj = {
          datasetId: datasetId,
          submitterAgency: agency,
          domain: domain,
          ...term
        };
        appendDynamicRow(glossSheet, termObj);
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

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, 'Metadata_Repository');
  ensureSheet(ss, 'Data_Dictionary');
  ensureSheet(ss, 'Glossary');
}

/**
 * Handles GET requests to retrieve data for the Catalog frontend
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const metaSheet = ss.getSheetByName('Metadata_Repository');
    
    if (!metaSheet) {
      return ContentService.createTextOutput(JSON.stringify({ result: 'success', data: [] })).setMimeType(ContentService.MimeType.JSON);
    }
    const action = e.parameter.action;
    const reqId = e.parameter.datasetId;

    if (action === 'getDataset' && reqId) {
      // 1. Fetch Metadata Row
      let dataset = null;
      const metaData = metaSheet.getDataRange().getValues();
      const mHeaders = metaData[0];
      for (let i = 1; i < metaData.length; i++) {
        let rowObj = {};
        mHeaders.forEach((h, idx) => rowObj[h] = metaData[i][idx]);
        if (rowObj.datasetId === reqId) {
          dataset = rowObj;
          break;
        }
      }

      if (!dataset) {
        return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: 'Dataset not found' })).setMimeType(ContentService.MimeType.JSON);
      }

      // 2. Fetch Dictionary Rows
      dataset.dictionary = [];
      const dictSheet = ss.getSheetByName('Data_Dictionary');
      if (dictSheet) {
        const dData = dictSheet.getDataRange().getValues();
        if (dData.length > 1) {
          const dHeaders = dData[0];
          for (let i = 1; i < dData.length; i++) {
            let rowObj = {};
            dHeaders.forEach((h, idx) => rowObj[h] = dData[i][idx]);
            if (rowObj.datasetId === reqId) {
              dataset.dictionary.push(rowObj);
            }
          }
        }
      }

      // 3. Fetch Glossary Rows
      dataset.glossary = [];
      const glossSheet = ss.getSheetByName('Glossary');
      if (glossSheet) {
        const gData = glossSheet.getDataRange().getValues();
        if (gData.length > 1) {
          const gHeaders = gData[0];
          for (let i = 1; i < gData.length; i++) {
            let rowObj = {};
            gHeaders.forEach((h, idx) => rowObj[h] = gData[i][idx]);
            if (rowObj.datasetId === reqId) {
              dataset.glossary.push(rowObj);
            }
          }
        }
      }

      // Return fully assembled dataset for editing
      return ContentService
        .createTextOutput(JSON.stringify({ result: 'success', data: dataset }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Default Behavior (Get All Metadata for Catalog)
    const data = metaSheet.getDataRange().getValues();
    if (data.length <= 1) { // Only headers or completely empty
      return ContentService.createTextOutput(JSON.stringify({ result: 'success', data: [] })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // Map rows into an array of objects
    const resultData = rows.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    }).filter(row => row.datasetId); // Only include rows that have a datasetId
    
    // Return standard JSON response
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success', data: resultData }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
