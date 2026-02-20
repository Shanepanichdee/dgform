# Deployment & Setup Guide

This guide explains how to add new agencies or fix the backend if something breaks. 

## 📝 1. Adding a New Agency (Frontend + Backend Setup)

If a new agency (e.g., Department of Health - DOH) wants to use the system, follow these steps:

### Step 1.1: Database Setup (Google Sheets)
1. Go to Google Drive and create a new blank Google Sheet (e.g., `DG_Form_DOH`).
2. Go to `Extensions` > `Apps Script`.
3. Copy the entire code from `dgform/code.gs` on your computer.
4. Paste it into the Apps Script editor, replacing any default code.
5. Click **Deploy** > **New deployment**.
6. Select **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy** (Authorize access if prompted).
8. Copy the long **Web App URL** provided.

### Step 1.2: Frontend Setup (GitHub Pages)
1. Open the file `dgform/index.html` in a code editor.
2. Find the `function loadConfig()` (around line 770).
3. Inside the `shortcodes` object, add a new entry for DOH:
```javascript
const shortcodes = {
    'dla': { ... },
    'diw': { ... },
    'doh': {
        agency: 'กรมอนามัย กระทรวงสาธารณสุข',
        url: 'PASTE_THE_WEB_APP_URL_FROM_STEP_1_HERE'
    }
}
```
4. Save the `index.html` file.

### Step 1.3: Add Password for the New Agency
1. Open `dgform/login.html` in a code editor.
2. Find the array `const validPasswords` (around line 260).
3. Add the new password to the array:
```javascript
const validPasswords = ['admin@123', 'dla123', 'diw123', 'doh123'];
```
4. Update the redirect mapping slightly below that:
```javascript
if (passwordInput === 'dla123') {
    queryParams = '?id=dla';
} else if (passwordInput === 'diw123') {
    queryParams = '?id=diw';
} else if (passwordInput === 'doh123') { 
    // ADD THIS BLOCK
    queryParams = '?id=doh';
}
```
5. Save `login.html`.

### Step 1.4: Push to Server
1. Open GitHub Desktop.
2. Commit the changes (message: "Add DOH agency").
3. Click **Push origin**.
4. The new agency can now log in using Username: `admin` and Password: `doh123`.

---

## 🔧 2. Troubleshooting & Maintenance

### ❌ Issue: Browser shows "CORS Error" when clicking Save
- **Cause:** This usually means the Google Apps Script Web App URL is wrong, expired, or hasn't been deployed with "Anyone" access.
- **Fix:** Redo Step 1.1 gently. Make sure to choose "Anyone" in the access dropdown. Copy the new URL and update it in `index.html`.

### ❌ Issue: Data isn't showing up in Google Sheets
- **Cause:** The structure of the Google Sheet payload might have changed, or the sheet names were accidentally renamed.
- **Fix:** The Apps Script relies on the exact sheet names: `Metadata_Repository`, `Data_Dictionary`, and `Glossary`. Do not rename these tabs in Google Sheets once they are created. 

### ❌ Issue: Bulk Import CSV fails for Data Dictionary
- **Cause:** PapaParse expects the CSV headers to somewhat match the logic inside `importDictionary()` in `index.html`. 
- **Fix:** Check the sample datasets in the `sample_data/` folder to provide to users as a template. The engine is quite forgiving and ignores case, but the minimum required headers usually involve `variable`, `description`, `type`, etc.
