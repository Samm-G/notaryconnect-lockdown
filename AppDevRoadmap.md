# App Development Roadmap

**System Name:** NotaryConnect Lockdown Utility  
**Subdomain:** `law.kroldon.app`  
**Stack Summary:** Cloudflare Pages (Frontend + Edge Functions), Cloudflare R2 (WORM Compliance Storage), WebAssembly / Edge Processing Engine  

---

```
[Phase 1] Cloud Infrastructure, DNS & Storage Foundation
   │
   ▼
[Phase 2] 24-Hour TOTP Authentication & Edge Session Gate
   │
   ▼
[Phase 3] Word Conversion, Watermarking & 300 DPI Rasterization Engine
   │
   ▼
[Phase 4] PAdES Digital Signing & Atomic Cloudflare R2 Dual-Archival
   │
   ▼
[Phase 5] Frontend Drag-and-Drop UI, Real-Time Telemetry & Downloader
   │
   ▼
[Phase 6] Security Auditing, Legal UAT & Production Cutover
```

---

## Phase 1: Cloud Infrastructure, DNS & Storage Foundation

### 1.1 Objective
Establish the Cloudflare hosting environment, configure the target subdomain `law.kroldon.app`, provision the R2 audit storage bucket, and secure all environment variables and cryptographic key stores.

### 1.2 Key Implementation Tasks
1. Route `law.kroldon.app` through Cloudflare DNS with Full (Strict) SSL/TLS enabled.
2. Initialize a Cloudflare Pages project linked to the Git repository.
3. Provision an R2 bucket named `kroldon-notary-audit` with appropriate CORS and access policies.
4. Generate self-signed or CA-issued X.509 signing certificates for firm branding and store the private key/passphrase in Cloudflare Pages Secrets (`SIGNING_KEY_PEM`, `SIGNING_CERT_PEM`).
5. Configure standard edge security headers in a `_headers` configuration file.

### 1.3 Acceptance Criteria Checklist
- [ ] Subdomain `law.kroldon.app` resolves over HTTPS with a valid Cloudflare Edge SSL certificate.
- [ ] Cloudflare R2 bucket `kroldon-notary-audit` is provisioned and bound to the Pages environment via `wrangler.toml` / Pages dashboard.
- [ ] R2 bucket permissions enforce restricted writes (only accessible via authenticated backend worker bindings).
- [ ] Environment secrets (`JWT_SECRET`, `TOTP_SHARED_SECRET`, `SIGNING_KEY_PEM`) are securely injected and unavailable in client bundles.

### 1.4 Verification & Test Cases

| Test ID         | Scenario                  | Verification Steps                                                                           | Expected Result                                                                       |
| :-------------- | :------------------------ | :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| **TC-INFRA-01** | Subdomain & SSL Handshake | Execute `curl -Iv https://law.kroldon.app` via terminal.                                     | Returns `HTTP/2 200` (or `302/401` to auth); TLS 1.3 negotiated; HSTS header present. |
| **TC-INFRA-02** | R2 Edge Binding Access    | Trigger a test edge worker script writing a zero-byte test object to `kroldon-notary-audit`. | Object writes successfully; verify object presence via Cloudflare R2 dashboard.       |
| **TC-INFRA-03** | Public R2 Access Denial   | Attempt to fetch the test object directly via public browser URL without signing headers.    | Access denied (`HTTP 403 Forbidden`).                                                 |

---

## Phase 2: 24-Hour TOTP Authentication & Edge Session Gate

### 2.1 Objective
Implement the zero-leak authentication barrier requiring an RFC 6238-compliant TOTP code to enter the utility, issuing an encrypted 24-hour session cookie.

### 2.2 Key Implementation Tasks
1. Implement a Cloudflare Pages Function middleware (`functions/_middleware.ts`) to intercept all incoming requests to `law.kroldon.app`.
2. Build the TOTP verification endpoint (`/api/auth/verify`) using `otpauth` or native Web Crypto HMAC.
3. Configure JWT generation with an exact 24-hour expiration ($T + 86400\text{ seconds}$).
4. Set cookie options: `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`.
5. Implement rate-limiting on `/api/auth/verify` to block brute-force attempts (>5 attempts = 15-minute lock).
6. Implement a logout endpoint (`/api/auth/logout`) that clears the session cookie.

### 2.3 Acceptance Criteria Checklist
- [ ] Direct navigation to `law.kroldon.app` redirects unauthenticated users to `/login`.
- [ ] Valid 6-digit TOTP input generates a signed 24-hour cookie and redirects to `/app`.
- [ ] Expired or incorrect TOTP codes are rejected with descriptive, non-leaking error messages.
- [ ] Rate-limiter triggers after 5 consecutive failed entries from the same IP.
- [ ] Session cookie automatically expires after exactly 24 hours.

### 2.4 Verification & Test Cases

| Test ID        | Scenario                           | Verification Steps                                                                 | Expected Result                                                             |
| :------------- | :--------------------------------- | :--------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| **TC-AUTH-01** | Unauthenticated Route Interception | Open an incognito browser window and access `https://law.kroldon.app/app`.         | Immediate redirect to `/login`; no application shell or drop-zone exposed.  |
| **TC-AUTH-02** | Valid TOTP Verification            | Enter the current valid 6-digit code from Google Authenticator / 1Password.        | Session cookie set; redirected to `/app`; drop-zone UI loads.               |
| **TC-AUTH-03** | Expired/Invalid Code Entry         | Enter `000000` or an expired code.                                                 | Authentication rejected with `HTTP 401`; user remains on login screen.      |
| **TC-AUTH-04** | Brute Force Protection             | Script 6 rapid invalid TOTP POST requests to `/api/auth/verify`.                   | 6th attempt returns `HTTP 429 Too Many Requests`; IP locked for 15 minutes. |
| **TC-AUTH-05** | Session Expiration (24h)           | Mint a mock session token with `exp = current_time - 1 second` and request `/app`. | Middleware treats token as expired; forces redirect to `/login`.            |

---

## Phase 3: Word Conversion, Watermarking & 300 DPI Rasterization Engine

### 3.1 Objective
Build the document ingestion and processing pipeline that handles Word/PDF parsing, applies the mandatory watermark, and rasterizes pages to an image-only, unalterable format.

### 3.2 Key Implementation Tasks
1. Implement client-side/edge file validation enforcing:
   * Formats: `.pdf`, `.docx`, `.doc`.
   * Size limit: $\le 25\text{ MB}$.
   * Page count: $\le 5\text{ pages}$.
2. Integrate document conversion:
   * For `.docx`/`.doc`: Render document layout to intermediate vector PDF while preserving legal formatting, footnotes, and margins.
3. Build the Watermark Engine:
   * Overlay `NotaryConnect - Confidential` diagonally (-45°) across every page at 15%–20% opacity.
4. Implement the 300 DPI Rasterization Engine:
   * Render each vector page onto an off-screen HTML5 Canvas / WASM buffer at $300\text{ DPI}$ ($2550 \times 3300\text{ pixels}$ for standard Letter size).
   * Encode the canvas to high-quality JPEG/PNG streams.
   * Recompile the images into a clean, single PDF via `pdf-lib` without text or vector layers.

### 3.3 Acceptance Criteria Checklist
- [ ] Input files $> 5$ pages are rejected prior to pipeline execution.
- [ ] Word documents (`.docx`, `.doc`) convert without dropped signature lines, broken tables, or altered margins.
- [ ] Watermark `NotaryConnect - Confidential` appears across every page without obscuring underlying text.
- [ ] Output PDF contains **zero selectable text, form fields, or extractable font tables**.
- [ ] Output PDF visual resolution meets the 300 DPI standard (fine legal text remains crisp when printed).

### 3.4 Verification & Test Cases

| Test ID        | Scenario                          | Verification Steps                                                                                                                  | Expected Result                                                                                                                   |
| :------------- | :-------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| **TC-CORE-01** | 5-Page Threshold Enforcement      | Upload a 6-page test PDF or `.docx`.                                                                                                | UI displays warning: *"Document exceeds 5-page limit"*; processing halts immediately.                                             |
| **TC-CORE-02** | Text Unselectability (Flattening) | Open processed PDF in Adobe Acrobat, Chrome, and Apple Preview; execute `Ctrl+A` / `Cmd+A` and attempt mouse cursor drag over text. | No text can be highlighted or selected; copy-paste clipboard is completely empty.                                                 |
| **TC-CORE-03** | Watermark Placement & Visibility  | Inspect all pages of a 3-page affidavit.                                                                                            | Centered diagonal text `NotaryConnect - Confidential` clearly visible on all 3 pages; underlying affidavit clauses fully legible. |
| **TC-CORE-04** | Layout Integrity Check            | Upload a complex `.docx` affidavit with nested tables and notary seal placeholders.                                                 | Converted output matches the original Word print layout without text shifts or page overflows.                                    |

---

## Phase 4: PAdES Digital Signing & Atomic Cloudflare R2 Dual-Archival

### 4.1 Objective
Cryptographically sign the flattened PDF using the firm's private key to provide tamper-evidence, and enforce atomic dual-upload of both original and locked files to Cloudflare R2 before authorizing user download.

### 4.2 Key Implementation Tasks
1. Implement the PAdES-compliant digital signing worker:
   * Apply an X.509 digital signature with cryptographic timestamp and firm metadata to the rasterized PDF.
2. Build the Atomic Dual-Archival R2 Service:
   * Generate a unique `UUIDv4` per transaction.
   * Calculate `SHA-256` checksums for both the source file and locked output.
   * Write to R2 path: `/audit/{YYYY}/{MM}/{DD}/{UUIDv4}/original_{filename}`.
   * Write to R2 path: `/audit/{YYYY}/{MM}/{DD}/{UUIDv4}/locked_{filename}.pdf`.
   * Attach metadata headers: hashes, timestamp, operator session ID, page count.
3. Implement the Transactional Gate:
   * Block client download release until Cloudflare R2 returns verified `HTTP 200` write receipts for both assets.

### 4.3 Acceptance Criteria Checklist
- [ ] Processed PDF displays a valid digital signature badge in Adobe Acrobat Reader indicating the document has not been modified since signing.
- [ ] Post-sign file tampering (modifying a single pixel or byte) flags the signature as **Invalid / Tampered**.
- [ ] Both source document and final locked PDF are stored in Cloudflare R2 under the specified directory structure.
- [ ] The user is never granted a download link if the R2 upload fails or times out.

### 4.4 Verification & Test Cases

| Test ID       | Scenario                               | Verification Steps                                                          | Expected Result                                                                                                        |
| :------------ | :------------------------------------- | :-------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **TC-SEC-01** | Cryptographic Signature Validation     | Open locked PDF in Adobe Acrobat Reader DC.                                 | Signature panel shows: *"Signed and all signatures are valid. Document has not been modified since it was certified."* |
| **TC-SEC-02** | Tamper Evidence Invalidation           | Alter 1 byte of the signed PDF using a hex editor; re-open in Adobe Reader. | Signature panel alerts: *"The document has been altered or corrupted since the signature was applied."*                |
| **TC-R2-01**  | Dual Archival Integrity                | Complete a successful document conversion. Inspect Cloudflare R2 bucket.    | Both `original_*` and `locked_*` exist under the identical date/UUID path with identical calculated SHA-256 headers.   |
| **TC-R2-02**  | Network Failure Fallback (Atomic Gate) | Simulate an R2 network timeout during archival.                             | Pipeline aborts; user receives error: *"Compliance Archival Failed. Release aborted."*; no file downloaded.            |

---

## Phase 5: Frontend Drag-and-Drop UI, Real-Time Telemetry & Downloader

### 5.1 Objective
Construct a responsive user interface deployed on Cloudflare Pages featuring drag-and-drop ingestion, live stage telemetry, and a one-click download card.

### 5.2 Key Implementation Tasks
1. Build the main application shell with Tailwind CSS:
   * Prominent drag-and-drop drop-zone with file type and size indicators.
   * Header containing firm branding, active session countdown timer, and "Lock / Sign Out" button.
2. Build the real-time stage progress indicator:
   * Stage 1: File Ingestion & Format Validation
   * Stage 2: Watermark Overlay & 300 DPI Flattening
   * Stage 3: Cryptographic Tamper-Seal Application
   * Stage 4: Cloudflare R2 Compliance Archival
3. Implement the completion state:
   * Green verification checkmark.
   * Audit ID badge and SHA-256 fingerprint preview.
   * "Download Locked PDF" CTA button that triggers immediate browser download.
4. Add client-side in-memory cleanup to release large canvas buffers immediately following download.

### 5.3 Acceptance Criteria Checklist
- [ ] UI works responsively across desktop resolutions (1080p, 1440p, 4K, laptop screens).
- [ ] Drag-and-drop handles accidental drops outside the target area without browser page takeover.
- [ ] Real-time progress bar accurately reflects the active processing stage.
- [ ] Completion card provides the generated Audit Reference ID and download button.
- [ ] File memory buffers are flushed from client RAM upon completion.

### 5.4 Verification & Test Cases

| Test ID      | Scenario                      | Verification Steps                                              | Expected Result                                                                                               |
| :----------- | :---------------------------- | :-------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| **TC-UI-01** | Drag-and-Drop Ingestion       | Drag a `.docx` file from desktop directly into the drop target. | Drop-zone highlights; file name, size, and page count preview load instantly.                                 |
| **TC-UI-02** | Invalid Drop Handling         | Drop an unsupported format (e.g., `.png`, `.exe`, `.xlsx`).     | Drop rejected with an immediate red toaster: *"Unsupported file format. Please drop a .pdf, .docx, or .doc"*. |
| **TC-UI-03** | End-to-End Download Trigger   | Click "Download Locked PDF" upon completion.                    | Browser initiates download of `{original_name}_LOCKED_NOTARY.pdf`; file opens cleanly.                        |
| **TC-UI-04** | Session Timer & Manual Logout | Click "Sign Out" in the top-right header.                       | Cookie cleared; user redirected immediately to the login screen; back-button access blocked.                  |

---

## Phase 6: Security Auditing, Legal UAT & Production Cutover

### 6.1 Objective
Perform end-to-end integration testing, verify legal acceptance with real affidavits, run security and load tests, and finalize DNS routing to launch `law.kroldon.app`.

### 6.2 Key Implementation Tasks
1. Conduct end-to-end testing with sample legal affidavits, deeds, and multi-page notary contracts.
2. Upload resulting PDFs into commercial notary and electronic signature platforms (e.g., DocuSign, Notarize, Adobe Acrobat Sign) to confirm acceptance without font/layer errors.
3. Perform security audit: verify zero text-scraping via automated headless tools (Tesseract OCR excluded as agreed, verifying strictly DOM/vector selection is dead).
4. Validate Cloudflare security rules: WAF rules, DDoS mitigation, and HTTP security headers.
5. Final DNS cutover: bind `law.kroldon.app` directly to the production Cloudflare Pages project.

### 6.3 Acceptance Criteria Checklist
- [ ] 100% of test affidavits pass notary platform upload checks without formatting or font errors.
- [ ] Total processing time for a standard 5-page document remains under **6 seconds**.
- [ ] Security scan confirms `A+` grade on SSL Labs and SecurityHeaders.com.
- [ ] Full chain of custody documented: test uploads can be tracked from R2 storage back to operator sessions.
- [ ] Production cutover complete on `law.kroldon.app`.

### 6.4 Verification & Test Cases

| Test ID       | Scenario                          | Verification Steps                                                                        | Expected Result                                                                                  |
| :------------ | :-------------------------------- | :---------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| **TC-UAT-01** | Third-Party Notary Tool Ingestion | Upload locked affidavit to Adobe Acrobat Sign and DocuSign for signature field placement. | Document loads without font errors, visual clipping, or layer rendering warnings.                |
| **TC-UAT-02** | End-to-End Latency Benchmark      | Process a maximum-load document (5 full pages of text and notary tables).                 | Time from file drop to "Download Ready" does not exceed 6 seconds.                               |
| **TC-UAT-03** | Security Headers Validation       | Query production domain headers via `securityheaders.com`.                                | Score `A` or `A+`; CSP, HSTS, X-Frame-Options, X-Content-Type-Options verified active.           |
| **TC-UAT-04** | Complete Chain of Custody Audit   | Pick a random completed document ID. Query Cloudflare R2 via CLI using that ID.           | Original doc, signed doc, and metadata manifest match exactly with timestamp and SHA-256 hashes. |

---

## Roadmap Timeline & Milestone Schedule

```
Week 1                 Week 2                 Week 3                 Week 4
[ Phase 1: Infra ]     [ Phase 3: Core ]      [ Phase 4: Sign/R2 ]   [ Phase 6: UAT ]
[ Phase 2: TOTP  ] ──► [ Engine Pipeline ] ──► [ Phase 5: UI/UX   ] ──► [ Launch law.   ]
                                                                     [ kroldon.app  ]
```

* **Week 1:** Infrastructure Setup, R2 Provisioning, 24-Hour TOTP Authentication Gate.
* **Week 2:** Document Conversion Pipeline, Watermark Injection & 300 DPI Rasterization Engine.
* **Week 3:** Cryptographic Signing Integration, Cloudflare R2 Dual-Archival, Complete UI/UX Implementation.
* **Week 4:** Security Hardening, Notary Platform Ingestion Testing, Performance Tuning & Final DNS Cutover on `law.kroldon.app`.