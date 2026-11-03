

  
COMMANDS:

      npm install

      Syntax checks:
      npx tsc --noEmit



Changes:

FRONTEND CHANGES (DONE - Check once):
- Make changes in the frontend not to overwhelm the paralegals with technical information.
For example:
  - After conversion: Hide the "Cryptographic Checksums (SHA-256)" and "R2 Compliance Trail Committed:" sections inside info element (however required). Keep the "AUDIT ID: ..." visible.
- Change the page layout minimalist, flat style and simple.
- Change the button "Execute 300DPI.." text to something simple like "Generate read-only file".
- Accept drop zone as the entire screen, instead of a toast message. Even if the user drops files outside the area, the file must get uploaded.
- In the header:
  - Move the "Lockdown v0.1.0" to the footer of the page.
  - Remove the "law.kroldon.app".
  - Remove the Edge Ready badge in the top right.

BACKEND CHANGES:
- Make the suffix "_LOCKED_NOTARY" configurable from env. Change it to "_NC"
- Add to the script, option to clear the r2 storage as well.


LATER TESTS PROMPT:
- Make sure the popular Phone OS OCRs (Oppo, Vivo, Samsumg, Redmi, Apple) also do not work on the text.
- Make sure text isnt selectable in most of the text editors. (generally used with Windows, Mac and Linux OS).



PHASES TASKS:

[Phase 1: Cloud Infrastructure, DNS & Storage Foundation]

      Task 1.1: Project Skeleton, Git, uv Environment & Grey-Yellow Styling Baseline

      Task 1.2: Cloudflare Edge Bindings & Declarative Headers

      Task 1.3: Cryptographic Seed & Seal Generator (TOTP QR & X.509 PAdES Certificate)

      Task 1.4: Cloudflare Edge Health & Binding Verification Endpoint

[Phase 2] 24-Hour TOTP Authentication & Edge Session Gate:

      Task 2.1: Cryptographic Authentication Engine (Web Crypto TOTP, Fingerprinting & JWT)
      
      Task 2.2: Edge Rate Limiter & Auth Endpoints (/api/auth/*)

      Task 2.3: Edge Routing Update & Document Gatekeeper (functions/_middleware.ts)

      Task 2.4: Grey & Yellow Frontend Authentication Screen & Session State

Phase 3: Word Conversion, Watermarking & 300 DPI Rasterization Engine:

      Task 3.1: Document Ingestion, Defensive Sniffing & Processing Configuration

      Task 3.2: Modern .docx to Vector Canvas Normalization Engine

      Task 3.3: 300 DPI Anti-Tampering Rasterization, Watermark Burn-in & PDF Repacking Engine

      Task 3.4: Real-Time Pipeline Telemetry & RAM Sanitization

Phase 4: PAdES Digital Signing & Atomic Cloudflare R2 Dual-Archival

      Task 4.1: Cryptographic PAdES Digital Signing Engine on Edge (functions/utils/pades-signer.ts)

      Task 4.2: WORM R2 Dual-Archival & Audit Manifest Service (functions/utils/r2-archiver.ts)

      Task 4.3: Atomic Ingestion & Signing Endpoint (functions/api/archive.ts)

      Task 4.4: Frontend Integration & Telemetry Card

Phase 5: Frontend Drag-and-Drop UI, Real-Time Telemetry & Downloader Polish

      Task 5.1: Zero-Dependency Toast Notification Stack & Global Drop Interceptor

      Task 5.2: Document Metric Inspector Card & Layout Detection

      Task 5.3: Session Countdown 5-Minute Warning & Graceful Lockout Handler

      Task 5.4: Downloader Polish, Final Responsiveness & Memory Sanitization

Phase 6: Security Auditing, Legal UAT & Production Cutover

      Task 6.1: Comprehensive Automated Audit & Test Runner (scripts/run_audit_suite.ts)

      Task 6.2: Hidden Administrative Chain of Custody Inspector Modal (UI)

      Task 6.3: R2 Data Stats & Compliance Backup Extraction Utility (scripts/r2_data_extractor.ts)

      Task 6.4: Cloudflare Production Deployment & DNS Cutover Runbook





# RETIREVING UPLOADED DOCS:

Here are the exact terminal commands to interact with your **live Cloudflare production server** (`https://law.kroldon.app` or your `*.workers.dev` / `*.pages.dev` URL).

---

### Method 1: Using the Automated CLI Pipeline Tool (Recommended)

Our `scripts/r2_data_extractor.ts` script automatically authenticates using `JWT_SECRET` from your local `.dev.vars` file. Simply pass `TEST_BASE_URL` pointing to your production URL.

*(Replace `https://law.kroldon.app` with your production URL, or your `https://notaryconnect-lockdown.<subdomain>.workers.dev` URL).*

---

#### 1. View Live Production Storage Stats
Shows total documents, storage consumed in MB, page counts, and activity breakdown by date:

```bash
TEST_BASE_URL="https://law.kroldon.app" npx tsx scripts/r2_data_extractor.ts
```

> **Note:** This also automatically writes a clean `r2_stats_report.json` file in your current directory.

---

#### 2. Retrieve Full Data Dump (Downloads Everything to Your Machine)
Downloads all original files, locked `_NC.pdf` files, and audit manifests, and compiles **`r2_analytics_dataset.csv`** (for Excel/Pandas) and **`r2_analytics_dataset.json`**:

```bash
TEST_BASE_URL="https://law.kroldon.app" npx tsx scripts/r2_data_extractor.ts --dump
```

To specify a custom local destination folder:
```bash
TEST_BASE_URL="https://law.kroldon.app" npx tsx scripts/r2_data_extractor.ts --dump ./my_prod_backup
```

---

#### 3. Clear / Purge Live Production R2 Storage
Deletes all stored compliance documents and manifests from the live bucket.

**With safety prompt (requires typing `DELETE`):**
```bash
TEST_BASE_URL="https://law.kroldon.app" npx tsx scripts/r2_data_extractor.ts --clear
```

**Force purge without confirmation:**
```bash
TEST_BASE_URL="https://law.kroldon.app" npx tsx scripts/r2_data_extractor.ts --clear --force
```

---

### Method 2: Direct Raw `curl` Commands (Zero-Script)

If you want to run direct API queries from any bash shell without Node/TypeScript:

#### 1. Extract your production secret into a shell variable
```bash
JWT_SECRET=$(grep '^JWT_SECRET=' .dev.vars | cut -d '=' -f2 | tr -d '"')
PROD_URL="https://law.kroldon.app"
```

#### 2. View Stats via `curl`
```bash
curl -s -H "Authorization: Bearer $JWT_SECRET" "$PROD_URL/api/admin/export?action=stats"
```

#### 3. List All Stored Files via `curl`
```bash
curl -s -H "Authorization: Bearer $JWT_SECRET" "$PROD_URL/api/admin/export?action=list"
```

#### 4. Purge All Records via `curl`
```bash
curl -s -H "Authorization: Bearer $JWT_SECRET" "$PROD_URL/api/admin/export?action=clear"
```

---

### Method 3: Cloudflare Native Wrangler CLI

You can also use Wrangler's direct R2 commands authenticated through your Cloudflare account:

```bash
# List all objects in the bucket
npx wrangler r2 object list kroldon-notary-audit --prefix audit/

# Download a specific file directly
npx wrangler r2 object get kroldon-notary-audit/audit/2026/10/22/<UUID>/manifest.json --file ./manifest.json

# Delete an entire object directly
npx wrangler r2 object delete kroldon-notary-audit/audit/2026/10/22/<UUID>/manifest.json
```