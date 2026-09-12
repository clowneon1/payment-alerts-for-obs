# 🐛 StreamPe PC-Server Code Audit & Bug Bounty Report

> Generated: September 2026  
> Scope: `pc-server/` codebase (Backend Server, REST APIs, WebSocket, CSV Engine, Storage, Tauri Sidecar, Scripts, and Public Widgets/Dashboards).

---

## 📊 Summary of Findings

| Severity | Count | Category |
| :--- | :---: | :--- |
| **CRITICAL** | 4 | Runtime failures, data replacement boundaries, datastore clearing, broken alias queries |
| **HIGH** | 4 | Time format discrepancy, profile scoping in manual aliases, inaccurate socket count, version desync |
| **MEDIUM** | 5 | Missing DOM elements in preview, duplicate route handlers, duplicate `hexToRgb`, hardcoded firewall rule, dead copy listeners |
| **DEAD CODE / CLEANUP** | 4 | Deprecated auto-update endpoints, obsolete Windows service scripts (`node-windows`), dead list element references, silent catch blocks |
| **TOTAL** | **17** | **Issues identified for comprehensive cleanup & remediation** |

---

## 🔴 Critical Severity (Fix Immediately)

### 1. Discard Broken In-App Auto-Update & Apply Engine
- **Location:** [`pc-server/update-manager.js`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/update-manager.js) & [`pc-server/server.js:2100-2130`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/server.js#L2100-L2130)
- **Problem:** `server.js` contains endpoints `POST /api/updates/download`, `GET /api/updates/status`, and `POST /api/updates/apply` which call non-existent methods on `update-manager.js`. Per specification, in-app updating is discarded in favor of checking GitHub for releases and providing a direct download link for the portable ZIP.
- **Action:**
  - Remove broken `POST /api/updates/download`, `GET /api/updates/status`, and `POST /api/updates/apply` endpoints from `server.js`.
  - Keep lightweight `GET /api/updates/check` (with semver comparison and asset classification for portable ZIP & companion APK).

---

### 2. Replace Datastore Import Fails to Clean Historical Years and Unmentioned Shards
- **Location:** [`pc-server/server.js:2067-2076`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/server.js#L2067-L2076) & [`pc-server/server.js:1066-1108`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/server.js#L1066-L1108)
- **Problem:** When an import is performed with `mode === 'replace'`, the server calls `saveDonations(profile, importedTxs)`. `saveDonations` only groups the imported transactions and overwrites those specific monthly files (`data/YYYY/MM.csv`). Any older years (e.g. `data/2024/`, `data/2025/`) or historical months not present in the imported file are left untouched on disk.
- **Consequences:** "Replace All" does not actually replace the entire store; historical transactions from previous years/months that were not in the import file remain in the database and continue to appear in queries.
- **Fix:** In `mode === 'replace'`, first purge/clean existing `data/YYYY/*.csv` files before writing the imported transactions.

---

### 3. Broken Ledger Clearing in `POST /api/donations/clear`
- **Location:** [`pc-server/server.js:2229-2245`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/server.js#L2229-L2245)
- **Problem:** When a user triggers "Clear All Transactions", the server executes:
  ```javascript
  const profileDir = path.join(DATA_DIR, profile.replace(/[^a-zA-Z0-9_-]/g, '_'));
  if (fs.existsSync(profileDir)) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) { }
  }
  const cacheKeys = Object.keys(donationsCache).filter(k => k.startsWith(`${profile}_`));
  cacheKeys.forEach(k => delete donationsCache[k]);
  ```
  However, the storage engine consolidates all transactions into a unified monthly directory structure (`data/YYYY/MM.csv`) and `donationsCache` keys are indexed as `ledger_YYYY-MM`. `DATA_DIR/<profile>` does not exist, and cache keys do not start with `${profile}_`.
- **Consequences:** The endpoint returns `{ ok: true }` but leaves all CSV ledger files and in-memory caches intact on disk.
- **Fix:** Update `app.post('/api/donations/clear')` to purge all `data/YYYY/*.csv` files (or rewrite them as empty headers) and clear all `ledger_*` entries from `donationsCache`.

---

### 4. Broken Donor Alias / Display Name Filtering in `payments-csv.js`
- **Location:** [`pc-server/public/js/lib/payments-csv.js:351-356, 655-657`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/public/js/lib/payments-csv.js#L351-L356)
- **Problem:** `filterTransactions` checks `tx.displayName` when `filters.alias` is provided:
  ```javascript
  if (filters.alias) {
    const q = filters.alias.toLowerCase().trim();
    const dMatch = (tx.displayName || '').toLowerCase().includes(q);
    if (!dMatch) return false;
  }
  ```
  However, `server.js` stores the formatted display alias in `tx.sender` and the unaliased name in `tx.rawSender`. The property `tx.displayName` is never populated.
- **Consequences:** Entering any query into the "Filter display name..." input in the transaction table returns 0 matching transactions regardless of data. Additionally, `canonicalSupporters` display name sync on line 655 never triggers.
- **Fix:** Update `payments-csv.js` to filter against `tx.sender` (and `tx.displayName || tx.sender`).

---

## 🟠 High Severity (Functional & State Inconsistencies)

### 5. Time Format & Seconds Truncation Discrepancy Between Manual Records and Live Events
- **Location:** [`pc-server/public/js/config.js:4203, 4252`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/public/js/config.js#L4203), [`pc-server/public/config.html:2507`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/public/config.html#L2507), [`pc-server/server.js:1450, 2147`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/server.js#L1450)
- **Problem:**
  - Automated payment alerts and backend event records store time in 24-hour format with seconds: `HH:mm:ss` (e.g. `"14:05:32"` via `d.toTimeString().split(' ')[0]`).
  - The UI Manual Payment modal sets time using `<input type="time" id="input-manual-time">` without `step="1"`, producing a truncated `HH:mm` string (`"14:05"`).
  - When editing an existing transaction with `HH:mm:ss`, the standard HTML5 `<input type="time">` strips the seconds upon submission.
- **Consequences:** CSV ledger contains inconsistent time formats across manual entries vs live notifications, causing inconsistent date-time parsing and potential timestamp reconstruction shifts.
- **Fix:** Add `step="1"` to the HTML time input, and normalize manual entry submission in `config.js` and `server.js` to always guarantee the canonical `HH:mm:ss` format (e.g., appending `:00` if seconds are omitted).

---

### 6. Missing Profile Scoping in Manual Payment Alias Upsert & Delete
- **Location:** [`pc-server/public/js/config.js:4263, 4269`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/public/js/config.js#L4263-L4269)
- **Problem:** When recording or editing a manual transaction, the alias update requests do not pass the active profile:
  - `POST /api/aliases` sends `{ sender: donor, alias: aliasVal }` (missing `profile: activeProf`).
  - `DELETE /api/aliases/:donor` sends `DELETE /api/aliases/${donor}` (missing `?profile=${activeProf}`).
- **Consequences:** The alias modification is saved to or deleted from the server's default profile instead of the specific profile currently being managed.
- **Fix:** Explicitly pass `profile: activeProf` in the JSON body and query parameter.

---

### 7. Inaccurate Active WebSocket Count & Dead Socket Detection
- **Location:** [`pc-server/server.js:2460` & `pc-server/server.js:2810`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/server.js#L2460)
- **Problem:** `getActiveWsCount` is declared twice in `server.js`. The second declaration (line 2810) overrides the first (line 2460) and returns `clientSet.size` directly, counting connecting sockets (`readyState === 0`) as active instead of only `ws.readyState === 1`.
- **Consequences:** Sockets in connecting or terminating states are incorrectly counted in `/api/network-info` and `/health`.
- **Fix:** Remove the duplicate function declaration and ensure only one robust `getActiveWsCount` is used that filters strictly for `ws.readyState === 1` and prunes dead sockets.

---

### 8. Version Desynchronization Across Server, Discovery, and Build Scripts
- **Location:**
  - [`pc-server/server.js:2969, 3000, 3103`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/server.js#L2969)
  - [`pc-server/scripts/sync-version.js`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/scripts/sync-version.js)
  - [`pc-server/scripts/build-bun-sidecar.js:35`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/scripts/build-bun-sidecar.js#L35)
- **Problem:**
  - `server.js` hardcodes `version: '2.2.0'` in the `/health` endpoint, the UDP discovery response packet, and the mDNS TXT record instead of referencing `APP_VERSION` from `constants.js`.
  - `scripts/sync-version.js` syncs `package.json` version into `Cargo.toml`, `tauri.conf.json`, and `build.gradle`, but does not update `constants.js` `APP_VERSION` or `build-bun-sidecar.js` `--windows-version`.
- **Consequences:** Running `npm run version` or bumping the project version causes mDNS broadcast packets and Android companion app handshake to report stale `2.2.0` versions.
- **Fix:** Use `APP_VERSION` in all `server.js` responses, and update `scripts/sync-version.js` to automatically sync `constants.js` and `build-bun-sidecar.js`.

---

## 🟡 Medium Severity (UI Inconsistencies & Redundancies)

### 9. Missing Test Button Element in `preview.html`
- **Location:** [`pc-server/public/preview.html:57`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/public/preview.html#L57)
- **Problem:** `preview.html` defines CSS for `.preview-trigger-btn` and adds an event listener on `document.getElementById('btn-test-preview')`, but `<button id="btn-test-preview">` is omitted from the HTML markup.
- **Consequences:** Opening `/preview` directly in a browser offers no manual test button.
- **Fix:** Add `<button id="btn-test-preview" class="preview-trigger-btn">⚡ Test Alert</button>` inside the HTML body.

---

### 10. Duplicate Route Handler Registrations in `server.js`
- **Location:** [`pc-server/server.js:120-126, 1474-1475, 2088, 2718, 2728`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/server.js)
- **Problem:**
  - `app.get('/config')` and `app.get('/app')` are registered at lines 120-126 and duplicated at lines 1474-1475.
  - `app.get(['/api/updates/check', '/api/version/check'])` is registered at line 2088 and duplicated individually at lines 2718 and 2728.
- **Consequences:** Redundant route stack entries; route definitions are spread across disparate sections.
- **Fix:** Consolidate routes and remove duplicate handlers.

---

### 11. Duplicate `hexToRgb` Function Declaration in `cycling-widget.js`
- **Location:** [`pc-server/public/js/cycling-widget.js:19-23, 74-86`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/public/js/cycling-widget.js#L19-L23)
- **Problem:** `function hexToRgb(hex)` is defined twice within the same IIFE scope.
- **Consequences:** Redundant code, shadowing the first declaration.
- **Fix:** Remove the first incomplete definition and retain the robust implementation.

---

### 12. Hardcoded Port 2907 in `ensureWindowsFirewallRule`
- **Location:** [`pc-server/server.js:572`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/server.js#L572)
- **Problem:** `netsh advfirewall firewall add rule` specifies `localport=2907` as a hardcoded string instead of using the configured `DEFAULT_PORT` or `activeServerPort`.
- **Consequences:** If the app port is modified or running on a fallback port, the firewall rule does not match the active port.
- **Fix:** Dynamically inject `DEFAULT_PORT` into the firewall rule definition.

---

### 13. Phantom / Dead Event Listeners for Consolidated Tabs in `config.js`
- **Location:** [`pc-server/public/js/config.js:3060, 3061`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/public/js/config.js#L3060-L3061)
- **Problem:** `config.js` listens to `btn-copy-lb-url` and `btn-copy-recent-url`, which were old buttons removed when Leaderboard and Recent tabs were unified into the single List Widget tab (`btn-copy-list-url`).
- **Fix:** Clean up obsolete event listeners.

---

## ⚪ Dead Code & Code Cleanup

### 14. Obsolete Windows Service Scripts (`service-install.js`, `service-uninstall.js`)
- **Location:** [`pc-server/service-install.js`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/service-install.js) & [`pc-server/service-uninstall.js`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/service-uninstall.js)
- **Problem:** These scripts require `node-windows`, which is not installed and not present in `package.json`. StreamPe is now a standalone Tauri desktop tray application using Windows Run registry auto-start, making these scripts obsolete and non-functional.
- **Fix:** Safely remove both scripts.

---

### 15. Phantom Reverse Alias Accumulation in `aliases-store.js`
- **Location:** [`pc-server/aliases-store.js:167-188`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/aliases-store.js#L167-L188)
- **Problem:** When an alias is renamed (e.g. from `VIP Rahul` to `Champion Rahul`), `store.aliasToName` inserts the new alias but does not delete the old reverse mapping, accumulating phantom aliases in memory.
- **Fix:** In `setAlias`, delete the previous alias from `store.aliasToName` if one existed for that sender.

---

### 16. Dead Element References in `config.js` (`input-list-name`)
- **Location:** [`pc-server/public/js/config.js:1188`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/public/js/config.js#L1188)
- **Problem:** `setVal('input-list-name', activeList.name)` attempts to populate an `<input id="input-list-name">` that does not exist in `config.html`.
- **Fix:** Clean up dead `setVal` call.

---

### 17. Empty Error Handlers Swallowing Diagnostic Information
- **Location:** [`pc-server/server.js:55, 485, 558, 2017, 2504`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/server.js)
- **Problem:** Multiple `catch (_) {}` blocks throughout registry checks, migration routines, and JSON parsing suppress error output completely.
- **Fix:** Add `log.debug` or `log.warn` messages to aid debugging in production logs.

---

## 🎯 Full Remediation Checklist

- [x] **1.** Remove dead auto-update staging/apply routes (`/api/updates/download`, `/api/updates/status`, `/api/updates/apply`) and streamline `update-manager.js` to check GitHub and provide direct download links.
- [x] **2.** Fix `POST /api/donations/import` in `replace` mode to clean up all unmentioned historical monthly CSV shards and older year directories.
- [x] **3.** Fix `POST /api/donations/clear` to properly purge `data/YYYY/*.csv` files and flush cache.
- [x] **4.** Fix `payments-csv.js` alias filtering (`filters.alias`) and canonical display name updates by referencing `tx.sender`.
- [x] **5.** Enforce `HH:mm:ss` time format across UI `<input type="time" step="1">` and backend parsers.
- [x] **6.** Pass `profile: activeProf` in manual donation alias upsert and delete requests in `config.js`.
- [x] **7.** Deduplicate `getActiveWsCount` in `server.js` and enforce `ws.readyState === 1`.
- [x] **8.** Unify project versioning by replacing hardcoded `'2.2.0'` in `server.js` with `APP_VERSION`, and updating `sync-version.js` to keep `constants.js` and `build-bun-sidecar.js` in sync.
- [x] **9.** Add missing test button in `preview.html`.
- [x] **10.** Remove duplicate route registrations in `server.js` (`/config`, `/app`, `/api/updates/check`, `/api/version/check`).
- [x] **11.** Remove duplicate `hexToRgb` declaration in `cycling-widget.js`.
- [x] **12.** Inject `DEFAULT_PORT` dynamically into `ensureWindowsFirewallRule`.
- [x] **13.** Remove dead copy event listeners (`btn-copy-lb-url`, `btn-copy-recent-url`) in `config.js`.
- [x] **14.** Delete obsolete `service-install.js` and `service-uninstall.js`.
- [x] **15.** Clean up old reverse alias mappings on rename in `aliases-store.js`.
- [x] **16.** Remove dead `input-list-name` reference in `config.js`.
- [x] **17.** Add proper logging to empty catch blocks.

---

## 🔍 Iteration 2: Deep-Dive Code Audit Findings

> Additional issues identified during the second-pass audit of widget configuration listeners, date querying, and script fallbacks.

| # | Severity | Component / File | Issue Description |
| :-: | :--- | :--- | :--- |
| **18** | **MEDIUM** | `server.js` | Date range normalization missing in `/api/donations/query` and `/api/analytics` for `YYYY-MM` month strings (unlike export endpoints). |
| **19** | **MEDIUM** | `public/js/config.js` | Dead legacy event listeners on non-existent elements `select-lb-max` and `select-recent-max`. |
| **20** | **LOW** | `public/js/overlay.js` | WebSocket connection path inconsistency (`ws://${loc.host}/` vs `ws://${loc.host}/obs`). |
| **21** | **LOW** | `scripts/package-release.js` | Hardcoded version fallback `'2.2.0'` in packaging script. |

---

### 18. Date Range Normalization Missing in `/api/donations/query` and `/api/analytics` (Medium Severity)
- **Location:** [`pc-server/server.js:1543-1545, 1596-1598`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/server.js#L1543)
- **Problem:** Export endpoints (`/api/donations/export/csv` and `/api/donations/export/json`) properly normalize 7-character `YYYY-MM` month strings to full dates (`YYYY-MM-01` and `YYYY-MM-lastDay`). However, `/api/donations/query` and `/api/analytics` pass raw `YYYY-MM` strings into `filterTransactions`, causing string comparisons like `txDate > "2026-08"` to discard valid transactions on day 2 or later.
- **Fix:** Add the same `YYYY-MM` to `YYYY-MM-01` / `YYYY-MM-lastDay` normalization in `/api/donations/query` and `/api/analytics`.

---

### 19. Dead Legacy Event Listeners in `config.js` (Medium Severity)
- **Location:** [`pc-server/public/js/config.js:3083-3088`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/public/js/config.js#L3083-L3088)
- **Problem:** `config.js` still registers change listeners for `['lb', 'recent']` (`select-lb-max`, `select-recent-max`, `input-lb-max-custom`, `input-recent-max-custom`). The unified list widget already has its own working handler for `select-list-max` at line 2063.
- **Fix:** Remove the dead legacy listener loop at lines 3083-3088.

---

### 20. WebSocket Connection Path Inconsistency in `overlay.js` (Low Severity)
- **Location:** [`pc-server/public/js/overlay.js:34`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/public/js/overlay.js#L34)
- **Problem:** `overlay.js` connects to `ws://${loc.host}/` while `goal.js`, `list.js`, and `cycling-widget.js` connect to `ws://${loc.host}/obs`.
- **Fix:** Standardize `overlay.js` default connection path to `ws://${loc.host}/obs`.

---

### 21. Stale Hardcoded Fallback Version in `package-release.js` (Low Severity)
- **Location:** [`pc-server/scripts/package-release.js:20`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/scripts/package-release.js#L20)
- **Problem:** Fallback version is hardcoded to `'2.2.0'` instead of importing `APP_VERSION` from `constants.js`.
- **Fix:** Require `APP_VERSION` from `constants.js` for fallback.

---

## 🎯 Iteration 2 Remediation Checklist

- [x] **18.** Add `YYYY-MM` date normalization in `/api/donations/query` and `/api/analytics`.
- [x] **19.** Clean up dead legacy `select-lb-max` / `select-recent-max` event listeners in `config.js`.
- [x] **20.** Standardize WebSocket URL in `overlay.js` to `/obs`.
- [x] **21.** Use `APP_VERSION` from `constants.js` in `scripts/package-release.js`.
