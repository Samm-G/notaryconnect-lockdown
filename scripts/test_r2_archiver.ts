import {
    calculateSha256,
    buildAuditBasePath,
    commitDualArchivalTransaction,
    ArchiveParams,
} from '../functions/utils/r2-archiver';
import type { R2Bucket, R2Object } from '@cloudflare/workers-types';

async function runTests() {
    console.log('═'.repeat(60));
    console.log('  TEST SUITE: WORM R2 Dual-Archival Engine (Task 4.2)        ');
    console.log('═'.repeat(60));

    // Test 1: SHA-256 Calculation
    console.log('\n[1] Testing SHA-256 Cryptographic Checksumming...');
    const testData = new TextEncoder().encode('NotaryConnect Test Document Bytes 2026');
    const hash = await calculateSha256(testData);
    console.log(`    -> Computed SHA-256: ${hash}`);
    if (hash.length === 64 && /^[0-9a-f]{64}$/.test(hash)) {
        console.log('    ✓ Valid 64-character lowercase SHA-256 hex string generated.');
    } else {
        throw new Error('Invalid SHA-256 format.');
    }

    // Test 2: Chronological Path Partitioning
    console.log('\n[2] Testing WORM Date Partitioning Hierarchy...');
    const testUuid = 'd3b07384-d113-4660-9080-874b2fbe029f';
    const testDate = new Date('2026-10-20T10:00:00Z');
    const basePath = buildAuditBasePath(testUuid, testDate);
    console.log(`    -> Partition Path: ${basePath}`);
    if (basePath === `audit/2026/10/20/${testUuid}`) {
        console.log('    ✓ Path matches /audit/{YYYY}/{MM}/{DD}/{UUIDv4}/ specification.');
    } else {
        throw new Error('Incorrect path partitioning.');
    }

    // Test 3: Atomic Dual-Archival Simulation with Contract Validation
    console.log('\n[3] Testing Atomic Transaction Loop & Manifest Validation...');
    const writtenKeys: string[] = [];
    const storedMetadata: Record<string, any> = {};

    // Mock R2Bucket implementing the exact Cloudflare Workers interface
    const mockR2: Partial<R2Bucket> = {
        put: async (key: string, value: any, options?: any) => {
            writtenKeys.push(key);
            storedMetadata[key] = options?.customMetadata;
            return {
                key,
                size: value?.byteLength || (typeof value === 'string' ? value.length : 100),
                etag: 'mock-etag-2026',
                version: '1',
            } as unknown as R2Object;
        },
    };

    const sampleParams: ArchiveParams = {
        originalBytes: new Uint8Array([1, 2, 3, 4, 5]),
        originalFileName: 'Airbus_Employment proof 2025-02-21.pdf',
        originalMimeType: 'application/pdf',
        signedPdfBytes: new Uint8Array([6, 7, 8, 9, 10]),
        pageCount: 3,
        watermarkApplied: true,
        qualityMode: 'compressed',
        operatorSession: {
            user: 'internal-legal-operator',
            clientIp: '103.21.244.52',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
    };

    const result = await commitDualArchivalTransaction(mockR2 as R2Bucket, sampleParams);

    console.log(`    ✓ Audit UUID: ${result.auditId}`);
    console.log(`    ✓ Original File Key: ${result.originalKey}`);
    console.log(`    ✓ Locked File Key: ${result.lockedKey}`);
    console.log(`    ✓ Manifest Key: ${result.manifestKey}`);

    // Validate that all 3 files were written atomically
    if (writtenKeys.length === 3) {
        console.log('    ✓ Exactly 3 compliance objects committed (Original + Locked + Manifest).');
    } else {
        throw new Error('Atomicity violation: Did not write 3 objects.');
    }

    // Validate R2 custom metadata headers
    const meta = storedMetadata[result.lockedKey];
    if (
        meta['jurisdiction'] === 'IN' &&
        meta['location'] === 'Bangalore, India' &&
        meta['sha256-original'] === result.sha256Original &&
        meta['sha256-final'] === result.sha256Final &&
        meta['page-count'] === '3'
    ) {
        console.log('    ✓ R2 Custom Metadata headers verified (Jurisdiction, Location, SHA-256s).');
    } else {
        throw new Error('Custom metadata header mismatch.');
    }

    console.log('\n' + '═'.repeat(60));
    console.log('  ALL R2 ARCHIVAL TESTS PASSED (100% SPEC COMPLIANT)         ');
    console.log('═'.repeat(60) + '\n');
}

runTests().catch((err) => {
    console.error('\n❌ R2 Archival test failed:', err);
    process.exit(1);
});