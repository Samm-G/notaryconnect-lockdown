
Changes:

FRONTEND CHANGES:
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

LATER TESTS PROMPT:
- Make sure the popular Phone OS OCRs (Oppo, Vivo, Samsumg, Redmi, Apple) also do not work on the text.
- Make sure text isnt selectable in most of the text editors. (generally used with Windows, Mac and Linux OS).


  
COMMANDS:

      npm install

      Syntax checks:
      npx tsc --noEmit


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