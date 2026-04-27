# SmartRedirect Suite - User Guide

This manual describes the daily use of the SmartRedirect Suite. The application manages more than 100,000 URL transformation rules and supports migrations between domains.

You can open the admin area using the gear symbol in the header or by appending `?admin=true` to the URL.

## General Settings
After logging into the admin area, a menu with four tabs is available: **General**, **Rules**, **Statistics** and **System & Data**. You can log out or close the admin area using the buttons in the header area.

In the **General** tab, all texts, colors and icons of the migration application can be adjusted:

- **Header**: Title, icon or logo as well as the background color of the top area.
- **Main area and notice**: Heading, description, warning icon and colors for the warning message.
- **Routing & Fallback Behavior (formerly URL comparison)**:
  - **Target Domain**: The base domain for all redirects (default). IMPORTANT: Also used as a basis for partial matches.
  - **Fallback Strategy**: Defines the behavior when no specific rule matches.
    - *Simple Domain Replacement*: Default behavior. Replaces only the domain, keeps the entire path.
    - *Smart Search Redirect*: Extracts the last path segment and redirects to a configurable search page (e.g. `?q=filename.pdf`).
      - **Regex extraction**: Optionally, a regular expression can be defined to flexibly extract the search term from the URL (e.g. from query parameters with `[?&]file=([^&]+)`).
      - **Fallback**: If the regex does not work or is not defined, the last path segment is automatically used.
  - **Fallback Info Messages**: Configurable texts in the event that no rule applies (Smart Search Message) or no specific rule text is available (Standard Info Text).
  - **Visualization**: Title, icon, background color and names for old and new URL as well as button texts. In addition, the interaction options on the migration page can be controlled (showing/hiding the buttons for copying or opening the URL and configuring the click behavior of the displayed URL).
- **Special Notes**: Heading and icon for the information area.
- **Additional information**: title, icon and up to three bullet points.
- **Footer**: Copyright notice.
- **Automatic forwarding**: Globally enable instant forwarding for all rules.

## Manage rules
1. **Create a new rule**: URL matcher, target URL, redirect type (*Partial* - replaces only the beginning, *Full* - replaces the entire path, or *Domain*), optional info text and configure automatic redirection.
   - **Parameter Handling**:
     - For *Partial/Domain*: Option "Remove all link parameters" (default: Off/Keep parameters).
     - For *Complete*: "Keep link parameters" option (default: Off/Remove parameters).
2. **Search, sort and paginate rules**: Enter in the search field, sort by source, target or creation date.
3. **Edit or delete rules**: Remove individual entries using actions or collectively remove several marked rules.
4. **Bulk Deletion**: Mark multiple rules on the current page and delete them together.

## Statistics
- **Top 100**: Most frequently accessed paths, filterable by time period (24h, 7 days, all time).
- **All Entries**: Complete list of tracking data with search and sorting functionality.
- **Pagination**: Display the total number and navigate between pages.

## System & Data
The System & Data section is divided into three sections to cover different use cases.

### 1. Standard import/export (Excel, CSV)
This area is optimized for daily maintenance of redirects.
- **Export**: Download all rules as an Excel (.xlsx) or CSV file.
- **Import**: Supports Excel and CSV.
  - **Preview**: Before the actual import, a preview is displayed that lists new, updated and invalid rules.
  - **Columns**: The import file should contain the following columns (headers are case sensitive, German/English supported):
    - `Matcher` / `Source` (mandatory): The source path or domain.
    - `Target URL` / `Target` (mandatory): The target of the redirect.
    - `Type` / `Typ` (Mandatory): 'partial' (Partial), 'wildcard' (Full) or 'domain'.
    - `Info` / `Description` (Optional): Internal note text.
    - `Auto Redirect` (Optional): 'true'/'false' or '1'/'0'.
    - `Discard Query Params` / `Remove Parameters` (Optional): 'true'/'false'. Removes all parameters from partial/domain rules.
    - `Keep Query Params` / `Keep Parameters` (Optional): 'true'/'false'. Retains parameters in wildcard rules.
    - `ID` (Optional): Only needed to explicitly update existing rules.
  - **Option: Automatically encode URLs**: If activated (default), special characters in URLs are automatically encoded during import (e.g. spaces to `%20`).
  - **Sample files**: Templates for Excel and CSV can be downloaded in the UI.

### 2. Advanced rule import/export (JSON)
For system backups and experts.
- Works with the raw JSON format of the database.
- **No preview**: Data is imported directly.
- **Warning**: Rules with identical IDs will be overwritten immediately.

### 3. System & Statistics
- **System Settings**: Export/import the entire configuration (texts, colors, icons) as a JSON backup.
- **Statistics**: Export the tracking logs of all redirects made as CSV for external analysis.

### 4. Maintenance
- **Rebuild Cache**: Forces all rules to be reloaded into memory. Only necessary if there are display problems.

Further setup instructions can be found in [INSTALLATION.md](./INSTALLATION.md).
