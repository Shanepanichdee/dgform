# 🏛️ Data Governance & Metadata Documentation Form (DG Form)

A Serverless Web Application designed for government agencies and organizations to standardized data dictionaries, business glossaries, and dataset metadata. 

## 🚀 Key Features

*   **Serverless Architecture**: Hosted entirely on GitHub Pages. No backend server maintenance required.
*   **Google Sheets Integration**: Utilizes Google Apps Script (GAS) to seamlessly append incoming JSON payloads directly into an agency-specific Google Sheet.
*   **Multi-Agency Support**: Built-in routing system using Shortcodes (e.g., `?id=dla`) or secure encoded tokens.
*   **Bulk CSV/JSON Import**: Users can seamlessly load existing massive dictionaries or glossaries using the built-in PapaParse importer.
*   **Export Capabilities**: One-click export to CSV or JSON for local backups.
*   **Responsive UI**: Built with Bootstrap 5, making it accessible on desktops and tablets.

## 📁 Repository Structure

*   `index.html`: The main Single Page Application (SPA).
*   `login.html`: Client-side authentication and routing gateway.
*   `splash.html`: Landing page for unauthenticated users.
*   `code.gs`: The Google Apps Script that serves as the backend database connector.
*   `sample_data/`: Contains mock CSV files (DLA and DIW) for testing the bulk import feature.
*   `docs/`: Contains detailed system documentation.

## 📚 Documentation Reference

For detailed guides on how the system works and how to set it up, refer to the `docs/` folder:

1.  **[System Architecture & Data Flow](docs/ARCHITECTURE.md)**: Explains how the serverless components interact via Mermaid sequences.
2.  **[Deployment & Setup Guide](docs/DEPLOYMENT_GUIDE.md)**: Step-by-step instructions on adding new agencies, setting up Google Sheets, and pushing changes.

---
*Developed for Data Governance implementations.*
