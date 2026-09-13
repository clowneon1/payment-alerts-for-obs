# StreamPe Android App - Bug Bounty & Code Audit Report

This document outlines all bugs, architectural inconsistencies, and code issues identified during the comprehensive multi-iteration code audit of `android-app/`.

---

## 📋 Complete Identified Bugs & Issues Summary

| # | Severity | Component / File | Issue Description | Status |
|---|---|---|---|---|
| **1** | **HIGH** | `AppConstants.kt:13`, `build.gradle:14`, `ServerDiscoveryManager.kt:20` | **Version Desynchronization & Stale Update Checks:** Hardcoded `"2.2.0"` in `AppConstants.APP_VERSION` and `ServerDiscoveryManager.kt:20` causes `UpdateChecker.kt` to send outdated User-Agent headers and triggers false update detections against itself. | ✅ Resolved |
| **2** | **HIGH** | `accessibility_service_config.xml:6` | **`canRetrieveWindowContent="false"` Disables Shade Traversal:** XML declares `canRetrieveWindowContent="false"`, which causes the Android OS to block `windows` node inspection, preventing the accessibility fallback reader from extracting redacted notifications. | ✅ Resolved |
| **3** | **HIGH** | `NotificationService.kt:91`, `PaymentParser.kt`, `AlertLog.kt` | **Non-Payment Notifications Ingestion in Recent Alerts:** `NotificationService` logs every notification from allowed packages into `AlertLog` without payment validation, causing non-payment events (OTPs, promotional spam, recharge confirmations) to appear in "Recent Alerts / Recent Donations". Fixed with modular `PaymentRules.kt`. | ✅ Resolved |
| **4** | **HIGH** | `WebSocketManager.kt:35, 93-96, 148-150` | **Thread Safety Bug in `WebSocketManager.messageQueue`:** Non-thread-safe `ArrayDeque` accessed concurrently across binder, accessibility, UI, and OkHttp threads, leading to potential `ConcurrentModificationException`. | ✅ Resolved |
| **5** | **MEDIUM** | `NotificationForwarderService.kt:50-54` | **Double-Slash WebSocket URL Malformation:** Unlike `ConnectFragment.kt` and `HomeActivity.kt`, `NotificationForwarderService` connects using `prefs.serverUrl + "/android"` without `.trimEnd('/')`. Trailing slashes produce `ws://ip:port//android`, causing connection drops. | ✅ Resolved |
| **6** | **MEDIUM** | `PaymentAccessibilityService.kt:240-255` | **Missing `alertId` in Accessibility Payloads:** `NotificationService.kt` generates a unique `UUID` for `alertId`, but `PaymentAccessibilityService` omits `alertId`, causing payload schema inconsistency and weaker server-side deduplication. | ✅ Resolved |
| **7** | **MEDIUM** | `AndroidManifest.xml:17-25`, `AppSelectorFragment.kt:23-30` | **Amazon Pay Standalone App in `<queries>` & App Selector:** Ensure standalone `com.amazon.pay.android` is included alongside shopping package in `<queries>` and `TARGET_PACKAGES` (alongside PhonePe, Google Pay, WhatsApp). | ✅ Resolved |
| **8** | **MEDIUM** | `ServerDiscoveryManager.kt:50, 188-192, 224-242` | **Concurrent Access to `discoveredServers` Map:** Standard `mutableMapOf` mutated across UDP background thread, unicast probe thread, mDNS listener, and UI thread without thread safety. | ✅ Resolved |
| **9** | **MEDIUM** | `ConnectFragment.kt:128, 139, 151, 158` | **Fragment Lifecycle Context Attachment Crash:** `requireContext()` in asynchronous discovery callbacks can throw `IllegalStateException` if user navigates or rotates device while scan completes. | ✅ Resolved |
| **10** | **MEDIUM** | `UpdateChecker.kt:34-40`, `HealthCheck.kt:20-26` | **Unclosed OkHttp Response Socket Leak:** `client.newCall().execute()` and `onResponse` do not use `response.use { ... }`, leaking connection pool sockets over time. | ✅ Resolved |
| **11** | **LOW** | `BootReceiver.kt:21` | **Foreground Service Launch Compatibility:** Uses direct `context.startForegroundService()` instead of `ContextCompat.startForegroundService(context, serviceIntent)`. | ✅ Resolved |
| **12** | **LOW** | `pc-server/scripts/sync-version.js` & `package-release.js` | **Build Version Sync Missing `AppConstants.kt`:** Build scripts sync `build.gradle` `versionName`, but must also sync `AppConstants.kt` `APP_VERSION` to prevent future version drift. | ✅ Resolved |
| **13** | **LOW** | `WebSocketManager.kt:156-165` | **Server IP Dynamic Reconnect Preference Sync:** Mid-session server IP updates via `network_changed` are not persisted to `AppPrefs.serverUrl`, causing restart to revert to stale IP. | ✅ Resolved |
| **14** | **LOW** | `NotificationForwarderService.kt:73` | **Safe WakeLock Release on Service Destroy:** Calling `wakeLock?.release()` unconditionally can throw `RuntimeException: WakeLock under-locked` if lock timed out. | ✅ Resolved |
| **15** | **LOW** | `AlertLogActivity.kt:134-137` | **Empty `fullJson` Guard in Retrigger Action:** If `fullJson` is blank on legacy/corrupt entries, fallback to synthesizing valid payload JSON. | ✅ Resolved |
| **16** | **LOW** | `app/build.gradle:38-47` | **Missing Unit Test Dependencies:** Add `testImplementation 'junit:junit:4.13.2'` and `testImplementation 'org.json:json:20231013'` for automated Kotlin unit testing. | ✅ Resolved |

---

## 🔍 Detailed Analysis & Remediation Plan

### 1. Version Desynchronization & Stale Update Checks
- **Files**:
  - `android-app/app/src/main/java/com/clowneon1/streampe/AppConstants.kt` (Line 13)
  - `android-app/app/build.gradle` (Line 14)
  - `android-app/app/src/main/java/com/clowneon1/streampe/ServerDiscoveryManager.kt` (Line 20)
- **Root Cause**:
  `AppConstants.APP_VERSION` is hardcoded as `"2.2.0"`, while current app releases and `pc-server` are `2.2.8`.
- **Impact**:
  1. `UpdateChecker.kt:30` checks if remote tag version > local `APP_VERSION`. Since local is stuck at `2.2.0`, it will constantly prompt users that an update is available even when running `2.2.8`.
  2. Outgoing HTTP requests in `UpdateChecker.kt` specify `User-Agent: StreamPe-Android/2.2.0`.
  3. UDP discovery packet in `ServerDiscoveryManager.kt:20` reports version `"2.2.0"`.
- **Remediation**:
  - Update `APP_VERSION` to `"2.2.8"` (and `versionName "2.2.8"` / `versionCode 20208`).
  - Update `pc-server/scripts/sync-version.js` and `package-release.js` to automatically sync `AppConstants.kt` `APP_VERSION = "..."` whenever a version bump happens.

---

### 2. `canRetrieveWindowContent="false"` in Accessibility Config
- **File**: `android-app/app/src/main/res/xml/accessibility_service_config.xml` (Line 6)
- **Root Cause**:
  Declares `android:canRetrieveWindowContent="false"`.
- **Impact**:
  On Android 12+, Android OS denies window content retrieval to accessibility services without `canRetrieveWindowContent="true"`, breaking Path B (shade walking for notifications redacted by Android System Intelligence).
- **Remediation**:
  Change to `android:canRetrieveWindowContent="true"`.

---

### 3. Non-Payment Notification Ingestion in "Recent Alerts / Recent Donations"
- **Files**:
  - `android-app/app/src/main/java/com/clowneon1/streampe/NotificationService.kt` (Line 91)
  - `android-app/app/src/main/java/com/clowneon1/streampe/PaymentParser.kt`
  - `android-app/app/src/main/java/com/clowneon1/streampe/AlertLog.kt`
- **Root Cause**:
  In `NotificationService.kt`, when any notification arrives from an allowed app (PhonePe, GPay, Amazon, etc.), it immediately calls `AlertLog.add(AlertLog.fromJson(payload))` without running payment validation rules. Non-payment events (e.g. OTPs, cashbacks, promotional ads, security warnings, recharge receipts) are saved to `alert_log.json` and shown in the Recent Alerts UI with blank donor/amount fields.
- **Impact**:
  The Recent Alerts screen gets cluttered with non-payment noise.
- **Remediation**:
  1. Create a dedicated rules file `PaymentRules.kt` to house all app-specific regex patterns, extractors, and rules for PhonePe, GPay, Amazon Pay, and generic UPI.
  2. Import and consume `PaymentRules` inside `PaymentParser.kt` to keep the parser clean, modular, and easy to maintain.
  3. In `NotificationService.kt`: Run incoming notification text through `PaymentParser.parse(title, text, bigText, pkg, appName)`.
  4. Only persist confirmed payment notifications to `AlertLog` (with parsed `sender` and `amount` populated), preventing OTPs and promo spam from polluting "Recent Alerts".
  5. Also populate `sender` and `amount` directly in the forwarded WebSocket payload for faster server processing.

---

### 4. Thread Safety Bug in `WebSocketManager.messageQueue`
- **File**: `android-app/app/src/main/java/com/clowneon1/streampe/WebSocketManager.kt` (Lines 35, 93-96, 148-150)
- **Root Cause**:
  `private val messageQueue = ArrayDeque<String>(MAX_QUEUE)` is not thread-safe. It is mutated from multiple concurrent threads (`NotificationService` binder thread pool, `PaymentAccessibilityService` thread, UI thread, and OkHttp WebSocket thread).
- **Impact**:
  Can throw `ConcurrentModificationException` or corrupt the internal `ArrayDeque` backing array during high-throughput live alert dispatch.
- **Remediation**:
  Use `ConcurrentLinkedQueue<String>` or synchronize all accesses to `messageQueue`.

---

### 5. Double-Slash WebSocket URL Malformation in `NotificationForwarderService`
- **File**: `android-app/app/src/main/java/com/clowneon1/streampe/NotificationForwarderService.kt` (Lines 50-54)
- **Root Cause**:
  ```kotlin
  val wsUrl = prefs.serverUrl
      .replace("http://", "ws://")
      .replace("https://", "wss://") + "/android"
  ```
  If `prefs.serverUrl` was saved as `http://192.168.1.100:2907/` (with a trailing slash), `wsUrl` becomes `ws://192.168.1.100:2907//android`.
- **Impact**:
  WebSockets may fail to handshake on strict HTTP/WS reverse proxies or servers.
- **Remediation**:
  Use `prefs.serverUrl.trimEnd('/') + "/android"`.

---

### 6. Missing `alertId` in `PaymentAccessibilityService` Payloads
- **File**: `android-app/app/src/main/java/com/clowneon1/streampe/PaymentAccessibilityService.kt` (Lines 240-255)
- **Root Cause**:
  When creating the alert JSON payload in `PaymentAccessibilityService.kt`, `alertId` is omitted.
- **Impact**:
  The PC server expects `alertId` for idempotency and alert history tracking. Payloads from accessibility shade walker lack unique IDs.
- **Remediation**:
  Add `put("alertId", UUID.randomUUID().toString())` to `PaymentAccessibilityService.kt`.

---

### 7. Amazon Pay Standalone App Coverage in `<queries>` & App Selector
- **Files**:
  - `android-app/app/src/main/AndroidManifest.xml` (Lines 17-25)
  - `android-app/app/src/main/java/com/clowneon1/streampe/AppSelectorFragment.kt` (Lines 23-30)
  - `android-app/app/src/main/java/com/clowneon1/streampe/AppSelectorActivity.kt` (Lines 128-135)
- **Scope**:
  StreamPe officially supports **Amazon Pay**, **PhonePe**, and **Google Pay** (plus WhatsApp for testing).
- **Root Cause**:
  While PhonePe and Google Pay are declared, the new standalone Amazon Pay UPI app (`com.amazon.pay.android`) was missing alongside `in.amazon.mShop.android.shopping` and `com.amazon.mShop.android.shopping`.
- **Remediation**:
  Ensure all Amazon Pay package variants (`com.amazon.pay.android`, `in.amazon.mShop.android.shopping`, `com.amazon.mShop.android.shopping`), PhonePe (`com.phonepe.app`), Google Pay (`com.google.android.apps.nbu.paisa.user`), and WhatsApp are in `<queries>` and `TARGET_PACKAGES`.

---

### 8. Concurrent Access to `discoveredServers` Map in `ServerDiscoveryManager`
- **File**: `android-app/app/src/main/java/com/clowneon1/streampe/ServerDiscoveryManager.kt` (Lines 50, 188-192, 224-242)
- **Root Cause**:
  `discoveredServers = mutableMapOf<String, DiscoveredServer>()` is mutated concurrently from UDP broadcast threads, unicast probe threads, mDNS resolve callbacks, and the main thread.
- **Impact**:
  Risk of `ConcurrentModificationException` during local network scanning.
- **Remediation**:
  Use `java.util.concurrent.ConcurrentHashMap<String, DiscoveredServer>()`.

---

### 9. Fragment Lifecycle Context Attachment Crash in `ConnectFragment`
- **File**: `android-app/app/src/main/java/com/clowneon1/streampe/ConnectFragment.kt` (Lines 128, 139, 151, 158)
- **Root Cause**:
  `updateDiscoveredServersUI()` calls `requireContext()` directly in an asynchronous UI callback. If the user navigates away or rotates screen while scanning, `requireContext()` throws `IllegalStateException`.
- **Impact**:
  App crash when switching tabs during an active Wi-Fi scan.
- **Remediation**:
  Use `val ctx = context ?: return` and `isAdded` checks before view construction.

---

### 10. Unclosed OkHttp Response Socket Leak in `UpdateChecker` & `HealthCheck`
- **Files**:
  - `android-app/app/src/main/java/com/clowneon1/streampe/UpdateChecker.kt` (Lines 34-40)
  - `android-app/app/src/main/java/com/clowneon1/streampe/HealthCheck.kt` (Lines 20-26)
- **Root Cause**:
  `client.newCall().execute()` and `onResponse(call, response)` do not close `Response` with `response.use { ... }` or `response.close()`.
- **Impact**:
  Leaks OkHttp socket connections over time until GC runs.
- **Remediation**:
  Wrap all responses in `.use { ... }`.

---

### 11. Safe Foreground Service Launch Compatibility
- **File**: `android-app/app/src/main/java/com/clowneon1/streampe/BootReceiver.kt` (Line 21)
- **Root Cause**:
  Directly invokes `context.startForegroundService(serviceIntent)` without `ContextCompat` abstraction.
- **Impact**:
  Potential crashes on OEM-specific forks or older platforms if foreground start APIs differ.
- **Remediation**:
  Use `androidx.core.content.ContextCompat.startForegroundService(context, serviceIntent)`.

---

### 12. Build & Version Sync Automation for `AppConstants.kt`
- **Files**:
  - `pc-server/scripts/sync-version.js`
  - `pc-server/scripts/package-release.js`
- **Root Cause**:
  The automated release scripts update `android-app/app/build.gradle` (`versionName` & `versionCode`), but not `AppConstants.kt`.
- **Impact**:
  Future releases will cause version drift in `APP_VERSION` unless manually remembered.
- **Remediation**:
  Add regex replacement in `sync-version.js` and `package-release.js` to update `APP_VERSION = "..."` in `AppConstants.kt` automatically.

---

### 13. Server IP Dynamic Reconnect Preference Sync
- **File**: `android-app/app/src/main/java/com/clowneon1/streampe/WebSocketManager.kt` (Lines 156-165)
- **Root Cause**:
  When the PC server broadcasts `network_changed` after an IP switch, `WebSocketManager` updates its runtime `serverUrl` but does not persist the new HTTP URL back to `AppPrefs.serverUrl`.
- **Impact**:
  On subsequent app launches or service restarts, the app tries to connect to the stale IP instead of the new one.
- **Remediation**:
  Persist the updated URL to `AppPrefs(context)` whenever `network_changed` is handled.

---

### 14. Safe WakeLock Release on Service Destroy
- **File**: `android-app/app/src/main/java/com/clowneon1/streampe/NotificationForwarderService.kt` (Line 73)
- **Root Cause**:
  Calling `wakeLock?.release()` unconditionally in `onDestroy()` can throw `RuntimeException: WakeLock under-locked` if the wake lock timed out or was already released.
- **Impact**:
  Service crash during background teardown on some Android devices.
- **Remediation**:
  Guard with `if (wakeLock?.isHeld == true) { try { wakeLock?.release() } catch (_: Exception) {} }`.

---

### 15. Empty `fullJson` Guard in Retrigger Action
- **File**: `android-app/app/src/main/java/com/clowneon1/streampe/AlertLogActivity.kt` (Lines 134-137)
- **Root Cause**:
  If `entry.fullJson` is blank on legacy/corrupt entries, clicking retrigger sends an empty string.
- **Remediation**:
  Synthesize a valid JSON payload if `entry.fullJson.isBlank()`.

---

### 16. Missing Unit Test Dependencies in `app/build.gradle`
- **File**: `android-app/app/build.gradle` (Lines 38-47)
- **Root Cause**:
  Missing `testImplementation 'junit:junit:4.13.2'` and `testImplementation 'org.json:json:20231013'`.
- **Remediation**:
  Add JUnit 4 and JSON library dependencies so unit tests for `PaymentParser` and `PaymentRules` can be run automatically.
