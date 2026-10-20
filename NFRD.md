# Non-Functional Requirements Document (NFRD)

**System Name:** NotaryConnect Lockdown Utility  
**Subdomain:** `law.kroldon.app`  
**Hosting / Infrastructure:** Cloudflare Pages, Cloudflare Workers / Functions, Cloudflare R2  
**Document Classification:** Internal Legal Operations  

---

## 1. Security & Cryptographic Integrity Requirements (SEC)

Because this tool processes sensitive legal affidavits, deeds, and evidentiary documents, security and non-repudiation are the highest priorities.

### SEC-01: Authentication & Session Security (TOTP Gate)
* **Algorithm Standard:** The TOTP engine must adhere strictly to **RFC 6238** (HMAC-SHA1/SHA256, 30-second time-step windows, 6-digit output).
* **Brute-Force & Rate Limiting:** 
  * Cloudflare WAF / Pages Functions must limit TOTP verification attempts to **5 consecutive failed attempts per IP per 15 minutes**.
  * After 5 failures, enforce a progressive backoff or temporary IP lockout.
* **Session Token Specification:**
  * Post-authentication session tokens must be signed JSON Web Tokens (JWT) using **HMAC-SHA256 (HS256)** or **Ed25519 (EdDSA)**.
  * Tokens must be stored in browser cookies with the following mandatory flags:  
    `HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`
  * The token payload must contain: `sub` (operator identifier), `iat` (issued at), `exp` (exact UTC timestamp at $T + 24\text{ hours}$), and a unique `jti` (JWT ID) to enable server-side invalidation.
* **Replay & Hijacking Mitigation:** Session tokens must include an encrypted client-binding fingerprint (e.g., hash of user-agent + network prefix).

### SEC-02: Cryptographic Tamper Evidence (PDF Signing)
* **Signature Specification:** Applied signatures must comply with **PAdES Part 2 (ISO 32000-1 / ETSI TS 102 778-2)**.
* **Key & Certificate Management:**
  * The X.509 private key must **never** be exposed client-side or committed to source control.
  * The key must reside inside **Cloudflare Secrets** or a dedicated Key Management Service (KMS).
  * Digital signature hashing algorithm must be **SHA-256 or SHA-512** (MD5 and SHA-1 are strictly prohibited).
* **Integrity Guarantee:** Any post-processing byte alteration, page re-ordering, or form-field injection must cause standard viewers (Adobe Acrobat Reader, Apple Preview, Foxit) to render an explicit certificate invalidation warning.

### SEC-03: Data-in-Transit & Edge Hardening
* **Transport Encryption:** All connections must enforce **TLS 1.3** (TLS 1.2 minimum fallback; TLS 1.0 and 1.1 disabled).
* **HTTP Security Headers:** Cloudflare Pages must inject:
  * `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  * `X-Content-Type-Options: nosniff`
  * `X-Frame-Options: DENY`
  * `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.kroldon.app https://*.r2.cloudflarestorage.com; object-src 'none'; frame-ancestors 'none';`
  * `Referrer-Policy: strict-origin-when-cross-origin`

### SEC-04: Data-at-Rest Security
* **R2 Bucket Encryption:** All objects written to Cloudflare R2 must be encrypted at rest using **AES-256 (Server-Side Encryption)**.
* **Zero Residual In-Memory Footprint:** 
  * Files processed in-memory (whether in-browser via WebAssembly or in edge workers) must be overwritten and released from memory buffers immediately upon download dispatch or upload finalization.

---

## 2. Performance & Latency Requirements (PERF)

Given the operational workload of **20–30 documents per day (max 5 pages each)**, the application must operate near real-time to avoid legal workflow bottlenecks.

| Metric                               | Target SLA                     | Maximum Acceptable Bound                            |
| :----------------------------------- | :----------------------------- | :-------------------------------------------------- |
| **Initial Page Load (LCP)**          | $< 1.2\text{ seconds}$         | $< 2.5\text{ seconds}$ on 4G/broadband              |
| **Word-to-PDF Conversion**           | $< 2.0\text{ seconds}$         | $< 4.0\text{ seconds}$ for a 5-page document        |
| **300 DPI Rasterization (per page)** | $\approx 400\text{ ms}$ / page | $< 800\text{ ms}$ / page                            |
| **Watermark + Signature Injection**  | $< 500\text{ ms}$              | $< 1.2\text{ seconds}$                              |
| **R2 Dual-Archival Ingestion**       | $< 1.5\text{ seconds}$         | $< 3.0\text{ seconds}$                              |
| **Total Pipeline Turnaround**        | **$< 6.0\text{ seconds}$**     | **$< 10.0\text{ seconds}$** (from drop to download) |

### PERF-01: Raster Rendering Quality vs. File Size Optimization
* **Resolution Benchmark:** Rasterization must maintain **300 DPI** output to guarantee microscopic clarity for small legal fonts (6pt–8pt legal notices, notary stamps, and footnotes).
* **Compression Algorithm:** Rasterized pages must be encoded using high-quality JPEG (quality index `85%`) or optimized Deflate/FlateDecode PNG streams to prevent excessive file sizes:
  * Target output size for a locked 5-page legal document: **between 1.5 MB and 5.0 MB**.

---

## 3. Reliability, Availability & Durability (REL)

### REL-01: System Availability
* **Uptime SLA:** The front-end hosted on Cloudflare Pages and the backend edge endpoints must achieve a minimum of **99.9% uptime** (excluding planned Cloudflare platform maintenance).

### REL-02: Data Durability & Archival Guarantee
* **R2 Durability:** All documents stored in Cloudflare R2 inherit **99.999999999% (11 9s)** annual durability.
* **Transactional Atomicity (All-or-Nothing Rule):**  
  * A user **must never** receive a download link unless the dual-archival process to Cloudflare R2 returns an `HTTP 200 OK` confirmation.
  * If the network drops or R2 fails during archival, the transaction aborts with an audit failure alert to avoid undocumented document releases.

### REL-03: Fault Recovery
* Edge processing jobs that encounter memory timeouts or unhandled rendering faults must fail gracefully within **15 seconds** with user-intelligible error diagnostics, rather than hanging indefinitely.

---

## 4. Legal Auditability & Chain of Custody (AUD)

### AUD-01: Immutability of Records
* Objects stored in Cloudflare R2 under `/audit/` must be treated as **WORM (Write Once, Read Many)** data.
* Neither the client front-end nor the standard operator session token shall have `DELETE` or `PUT` (overwrite) permissions on previously committed audit files.

### AUD-02: Cryptographic Checksumming
* For every processed document, the system must calculate and log:
  1. `SHA-256(Original_Document_Bytes)`
  2. `SHA-256(Final_Locked_PDF_Bytes)`
* These hashes must be recorded directly into the R2 object headers and an accompanying audit event log to establish an unshakeable legal chain of custody for court or notary scrutiny.

---

## 5. Usability & User Interface Experience (UX)

### UX-01: Operational Simplicity (Zero-Config Workflow)
* The UI must require **no configuration sliders or formatting decisions** from the legal assistant. Once authenticated, the entire workflow must be:
  1. Drag and drop file.
  2. Automatic processing progress visualization.
  3. Click "Download Locked PDF" (or auto-trigger download).

### UX-02: Real-Time Pipeline Telemetry
* Users must be informed of the exact pipeline stage via non-blocking UI indicators:
  * `[1/4] Parsing document layout...`
  * `[2/4] Applying "NotaryConnect - Confidential" watermark & rasterizing (300 DPI)...`
  * `[3/4] Cryptographically sealing with digital signature...`
  * `[4/4] Archiving compliance record in R2...`

### UX-03: Visual Verification
* The completion card must display a **green verification badge** confirming:
  * Page count verified ($\le 5$).
  * Tamper-evident seal applied.
  * R2 Audit ID generated.

---

## 6. Compatibility & Portability (COMP)

### COMP-01: Browser Compatibility
* Full operational support (including drag-and-drop file API, canvas/Wasm rendering, Web Cryptography API) on the current and preceding two versions of:
  * Google Chrome / Chromium-based browsers
  * Microsoft Edge (standard Windows enterprise environment)
  * Apple Safari (macOS)
  * Mozilla Firefox

### COMP-02: PDF Reader Portability
* The resulting locked PDF must render uniformly without errors or missing font dialogs on:
  * Adobe Acrobat Reader DC (Windows / Mac)
  * Web browsers (Chrome PDF Viewer, Firefox PDF.js)
  * macOS Preview
  * Commercial notary e-sign platforms (e.g., DocuSign, Notarize, PandaDoc)

---

## 7. Scalability & Operational Constraints (OPS)

* **Baseline Load:** 20–30 documents/day, primarily distributed across business hours (9:00 AM – 6:00 PM local time).
* **Burst Capacity:** The serverless architecture on Cloudflare Pages and Workers must inherently accommodate bursts of up to **50 concurrent conversions** without degradation or queue backpressure.
* **Zero Local Maintenance Footprint:** The application must require no server patching, OS maintenance, or manual container reboots. All infrastructure must run fully managed on Cloudflare's serverless edge.