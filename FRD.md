# Functional Requirements Document (FRD)

**System Name:** NotaryConnect Lockdown Utility  
**Subdomain:** `law.kroldon.app`  
**Target Audience:** Internal Law Firm Staff (Paralegals, Associates, Legal Assistants)  
**Primary Output:** Tamper-evident, watermarked, rasterized (non-selectable/non-editable) PDFs for notary submission  

---

## 1. System Overview & Objective

The application provides an internal drag-and-drop web utility hosted on **Cloudflare Pages**. It accepts legal documents (affidavits, deeds, contracts in `.pdf`, `.docx`, `.doc`), converts them into flattened image-based PDFs to prevent text selection and structural editing, stamps a mandatory **"NotaryConnect - Confidential"** watermark, applies an **X.509 digital signature** to ensure tamper evidence, and securely archives both the original and processed files into **Cloudflare R2** for quality control (QC) and legal auditability.

---

## 2. User Roles & Access Control

| Role                            | Permissions                                                                              |
| :------------------------------ | :--------------------------------------------------------------------------------------- |
| **Internal Legal Operator**     | Authenticate via TOTP, upload documents, view conversion status, download locked PDFs.   |
| **System / Compliance Auditor** | Direct access to Cloudflare R2 bucket to review audit trails, timestamps, and QC copies. |

---

## 3. Module Breakdown & Detailed Functional Requirements

```
                       [ USER @ law.kroldon.app ]
                                  │
                                  ▼
                    [ FR-1: 24-Hour TOTP Gate ]
                                  │
                                  ▼
                   [ FR-2: Drag-and-Drop Ingestion ]
                    (Validates .pdf, .docx, .doc <= 5 pgs)
                                  │
                                  ▼
                 [ FR-3 & FR-4: Document Pipeline ]
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
    [Watermarking]        [Rasterization]        [Cryptographic]
  "NotaryConnect -          (300 DPI             Digital Signature
    Confidential"         Image Flatten)         (Tamper Evident)
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
       [ FR-5: QC Audit Archive ]      [ FR-6: Locked PDF Download ]
       (Cloudflare R2 Storage)         (Delivered to Operator)
```

---

### Module 1: Authentication & Session Management (FR-1)

* **FR-1.1: TOTP Gatekeeper**  
  * The application root (`law.kroldon.app`) must present an authentication challenge prior to displaying any document tooling.
  * Access requires a 6-digit Time-Based One-Time Password (TOTP) compatible with standard authenticator apps (e.g., Google Authenticator, 1Password, Microsoft Authenticator).
* **FR-1.2: Session Lifespan (24 Hours)**  
  * Upon successful TOTP validation, the system issues an encrypted, `HttpOnly`, `Secure`, `SameSite=Strict` session cookie.
  * The session must remain active for exactly **24 hours (1 day)** without prompting for re-authentication.
  * After 24 hours, the session expires automatically, redirecting the user back to the TOTP entry screen.
* **FR-1.3: Manual Logout**  
  * Provide an explicit "Lock / Sign Out" button in the navigation header that immediately invalidates the session token.

---

### Module 2: Document Ingestion & Validation (FR-2)

* **FR-2.1: Drag-and-Drop UI**  
  * Provide a clean, clutter-free drop-zone supporting both mouse drag-and-drop and standard file picker dialog.
* **FR-2.2: Supported Formats**  
  * The system must accept:
    * Portable Document Format: `.pdf` (MIME: `application/pdf`)
    * Microsoft Word: `.docx` (MIME: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
    * Legacy Microsoft Word: `.doc` (MIME: `application/msword`)
* **FR-2.3: Ingestion Guardrails**  
  * **Page-Count Guardrail:** The system must reject or trigger a blocking confirmation if the document exceeds **5 pages**.
  * **File-Size Limit:** Restrict uploads to a maximum of **25 MB** per file.
  * **Batch Limit:** Single-document processing per transaction to ensure deliberate operator review before notary dispatch.
* **FR-2.4: Malformed File Detection**  
  * Perform pre-processing checks to detect password-protected, encrypted, or corrupted files, displaying actionable error alerts (e.g., *"Document is password-protected. Please unlock before uploading."*).

---

### Module 3: Document Transformation Pipeline (FR-3)

* **FR-3.1: Word-to-PDF Normalization**  
  * Word files (`.docx`, `.doc`) must be converted to an intermediate vector PDF preserving fonts, margins, line wraps, signature lines, tables, and footnotes without layout shifts.
* **FR-3.2: Watermark Injection**  
  * The system must inject the exact string:  
    `NotaryConnect - Confidential`
  * **Visual Configuration:**
    * Position: Centered diagonally across every page (approx. -45° angle).
    * Styling: Sans-serif font, semi-transparent (15%–20% opacity) so underlying text and notary fields remain legible.
    * Layer: Burned into the background/foreground before rasterization.
* **FR-3.3: Page Flattening / Rasterization (Anti-Selection & Anti-Edit Engine)**  
  * Every page of the document must be rendered into a high-density bitmap image at **300 DPI** (ensuring fine print, legal clauses, and line rulings remain razor-sharp for print and notary stamping).
  * The system must rebuild a new PDF consisting strictly of these raster images.
  * **Zero Vector/Text Remnants:** All selectable text, structural bookmarks, font tables, form fields, and vector paths must be entirely eradicated. Highlighting or text-scraping via standard PDF readers (Acrobat, Preview, Chrome PDF Viewer) must be physically impossible.

---

### Module 4: Tamper-Evident Cryptographic Signing (FR-4)

* **FR-4.1: X.509 Certificate Application**  
  * The finalized, flattened PDF must be digitally signed using a private cryptographic key belonging to the firm (stored securely in Cloudflare Secrets / KMS).
  * The signature must adhere to the **PAdES (PDF Advanced Electronic Signatures)** standard.
* **FR-4.2: Integrity Invalidation Warning**  
  * If any party attempts to modify, inject pages, crop, or alter pixels in the downloaded PDF after the fact, standard PDF readers must flag the document with:
    * *"The signature is invalid / Document has been altered after signing."*
* **FR-4.3: Signature Metadata**  
  * The signature block must include:
    * **Signer:** `Kroldon Law Firm / NotaryConnect Vault`
    * **Signing Reason:** `Affidavit Non-Repudiation & Lockdown Integrity`
    * **Timestamp:** Cryptographic UTC timestamp.

---

### Module 5: Cloudflare R2 Audit Logging & Archival (FR-5)

* **FR-5.1: Automatic Dual-Archival**  
  * Every completed transaction must write two distinct objects to Cloudflare R2 before download is unlocked:
    1. `original_{UUID}.[ext]` — The exact unaltered file uploaded by the operator.
    2. `locked_{UUID}.pdf` — The final signed, watermarked, flattened PDF delivered to the operator.
* **FR-5.2: Directory Hierarchy & Naming Convention**  
  Objects must be organized chronologically:  
  `r2://kroldon-notary-audit/{YYYY}/{MM}/{DD}/{UUIDv4}/`  
  * Example:  
    `.../2026/10/20/d3b07384-d113-4660-9080-874b2fbe029f/original_affidavit.docx`  
    `.../2026/10/20/d3b07384-d113-4660-9080-874b2fbe029f/locked_affidavit.pdf`
* **FR-5.3: Metadata Manifest**  
  * Attach R2 object metadata (or write an adjacent `manifest.json`):
    * `upload-timestamp-utc`: ISO 8601 string.
    * `operator-session-hash`: Pseudonymous identifier of the authenticated session.
    * `sha256-original`: SHA-256 checksum of the source document.
    * `sha256-final`: SHA-256 checksum of the locked output.
    * `page-count`: Number of processed pages.

---

### Module 6: Output & Delivery (FR-6)

* **FR-6.1: Direct Download Trigger**  
  * Provide an immediate "Download Locked PDF" CTA button upon pipeline completion.
  * Filename format: `{original_name}_LOCKED_NOTARY.pdf`.
* **FR-6.2: Processing Status & Visual Feedback**  
  * Real-time progress states:
    1. *Uploading & Verifying format...*
    2. *Watermarking & Flattening pages (1 of X)...*
    3. *Applying cryptographic digital seal...*
    4. *Archiving to R2 compliance vault...*
    5. *Ready for download.*
* **FR-6.3: Client-Side Reset**  
  * Clear in-memory buffers immediately after the download triggers or upon navigating away, preventing memory leaks on low-power devices.

---

## 4. Edge Cases & Exception Handling

| Scenario                                     | System Behavior                                                     | User Notification                                                                                                               |
| :------------------------------------------- | :------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------ |
| **Document exceeds 5 pages**                 | Pipeline halts immediately during the validation step.              | Modal alert: *"Document exceeds the 5-page limit for standard notary lockdown (Detected: X pages). Please split the document."* |
| **Corrupted / unparseable Word file**        | Engine rejects conversion without partial output.                   | Alert: *"Unable to parse Word document formatting. Please save as a standard .docx in Microsoft Word and retry."*               |
| **R2 bucket upload failure (network issue)** | PDF download is **blocked** to prevent un-audited document release. | Error notification: *"Compliance Archival Failed. Document cannot be released without an audit copy. Please retry."*            |
| **TOTP code expired during entry**           | Challenge fails.                                                    | Alert: *"Code expired or invalid. Please check your authenticator clock and enter the current code."*                           |
| **Unsupported file type (e.g., .jpg, .txt)** | Drag-and-drop zone immediately rejects the file drop.               | Visual toaster: *"Invalid file type. Only .pdf, .docx, and .doc are permitted."*                                                |

---

*Once you have reviewed and approved this FRD, we will proceed to the **Non-Functional Requirements Document (NFRD)** and the **Technical Architecture & Implementation Roadmap**.*