import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8788';

function getJwtSecret(): string {
    const devVarsPath = path.resolve('.dev.vars');
    if (fs.existsSync(devVarsPath)) {
        const lines = fs.readFileSync(devVarsPath, 'utf-8').split('\n');
        for (const line of lines) {
            if (line.startsWith('JWT_SECRET=')) {
                return line.replace('JWT_SECRET=', '').replace(/^"|"$/g, '').trim();
            }
        }
    }
    return process.env.JWT_SECRET || '';
}

async function fetchStats(jwtSecret: string) {
    console.log('\nConnecting to Cloudflare R2 compliance vault...');

    const response = await fetch(`${BASE_URL}/api/admin/export?action=stats`, {
        headers: {
            Authorization: `Bearer ${jwtSecret}`,
        },
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to fetch stats (${response.status}): ${errText}`);
    }

    const stats: any = await response.json();

    console.log('\n' + '═'.repeat(64));
    console.log('       CLOUDFLARE R2 COMPLIANCE VAULT - DATA STATISTICS         ');
    console.log('═'.repeat(64));
    console.log(`Bucket Name:          ${stats.bucket}`);
    console.log(`Jurisdiction:         ${stats.jurisdiction}`);
    console.log(`Generated Timestamp:  ${stats.generatedUtc}`);
    console.log('─'.repeat(64));
    console.log(`Total Audit Records:  ${stats.totals.distinctAuditTransactions} transactions`);
    console.log(`Original Files:       ${stats.totals.originalDocumentsArchived} files`);
    console.log(`Locked PAdES PDFs:    ${stats.totals.lockedPadesPdfDelivered} files`);
    console.log(`Audit Manifests:      ${stats.totals.auditManifestsCommitted} committed`);
    console.log(`Total Objects:        ${stats.totals.totalComplianceObjects}`);
    console.log(`Total Storage Used:   ${stats.totals.totalStorageFormatted}`);
    console.log('─'.repeat(64));
    console.log('Activity Breakdown by Date (UTC):');

    const dates = Object.keys(stats.activityByDate);
    if (dates.length === 0) {
        console.log('  (No archived records found)');
    } else {
        for (const d of dates) {
            console.log(`  • ${d}: ${stats.activityByDate[d]} files committed`);
        }
    }

    // Save stats report locally
    const reportPath = path.resolve('r2_stats_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
    console.log('─'.repeat(64));
    console.log(`✓ Local stats report saved to: ${path.basename(reportPath)}`);
    console.log('═'.repeat(64) + '\n');
}

async function executeFullDump(jwtSecret: string, targetOutputDir?: string) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const now = new Date();
    const timestampStr = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(
        now.getUTCDate()
    )}_${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;

    const dumpDir = path.resolve(targetOutputDir || `r2_dump_${timestampStr}`);

    console.log('\n' + '═'.repeat(64));
    console.log('       CLOUDFLARE R2 FULL DATA EXTRACTION & ANALYTICS PIPELINE   ');
    console.log('═'.repeat(64));
    console.log(`Destination Directory: ${dumpDir}\n`);

    if (!fs.existsSync(dumpDir)) {
        fs.mkdirSync(dumpDir, { recursive: true });
    }

    // 1. Query catalog
    console.log('[1/4] Cataloging R2 objects...');
    const listRes = await fetch(`${BASE_URL}/api/admin/export?action=list`, {
        headers: { Authorization: `Bearer ${jwtSecret}` },
    });

    if (!listRes.ok) {
        throw new Error(`Failed to list R2 objects: ${listRes.status}`);
    }

    const listData: any = await listRes.json();
    const objects: any[] = listData.objects || [];
    console.log(`      Found ${objects.length} compliance objects to extract.`);

    if (objects.length === 0) {
        console.log('\nR2 bucket is currently empty. Nothing to extract.');
        return;
    }

    // 2. Extract objects locally
    console.log('\n[2/4] Downloading objects & preserving WORM directory tree...');
    let downloadedBytes = 0;
    const manifestPaths: string[] = [];

    for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const key = obj.key;
        const progress = Math.round(((i + 1) / objects.length) * 100);

        const localFilePath = path.join(dumpDir, key);
        const localDir = path.dirname(localFilePath);

        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        const downloadRes = await fetch(
            `${BASE_URL}/api/admin/export?action=get&key=${encodeURIComponent(key)}`,
            {
                headers: { Authorization: `Bearer ${jwtSecret}` },
            }
        );

        if (!downloadRes.ok) {
            console.warn(`      ⚠ Failed to download: ${key}`);
            continue;
        }

        const buffer = Buffer.from(await downloadRes.arrayBuffer());
        fs.writeFileSync(localFilePath, buffer);
        downloadedBytes += buffer.length;

        if (key.endsWith('manifest.json')) {
            manifestPaths.push(localFilePath);
        }

        console.log(`      [${progress}%] Extracted: ${key} (${buffer.length} bytes)`);
    }

    // 3. Aggregate flat analytics dataset (for Pandas / Excel / SQL)
    console.log('\n[3/4] Parsing manifests & compiling flat analytics dataset...');
    const analyticsRows: any[] = [];

    for (const mPath of manifestPaths) {
        try {
            const manifestContent = JSON.parse(fs.readFileSync(mPath, 'utf-8'));
            analyticsRows.push({
                audit_id: manifestContent.auditId,
                timestamp_utc: manifestContent.timestampUtc,
                jurisdiction: manifestContent.jurisdiction,
                location: manifestContent.location,
                operator_user: manifestContent.operator?.sessionUser,
                operator_ip_prefix: manifestContent.operator?.clientIpPrefix,
                original_filename: manifestContent.originalDocument?.fileName,
                original_size_bytes: manifestContent.originalDocument?.fileSize,
                original_sha256: manifestContent.originalDocument?.sha256,
                locked_filename: manifestContent.lockedDocument?.fileName,
                locked_size_bytes: manifestContent.lockedDocument?.fileSize,
                locked_sha256: manifestContent.lockedDocument?.sha256,
                page_count: manifestContent.lockedDocument?.pageCount,
                watermark_applied: manifestContent.lockedDocument?.watermarkApplied,
                quality_mode: manifestContent.lockedDocument?.qualityMode,
                r2_base_path: manifestContent.r2Storage?.basePath,
            });
        } catch {
            // Ignore malformed manifests
        }
    }

    // Write JSON dataset
    const jsonDatasetPath = path.join(dumpDir, 'r2_analytics_dataset.json');
    fs.writeFileSync(jsonDatasetPath, JSON.stringify(analyticsRows, null, 2));

    // Write CSV dataset for Excel / Pandas
    const csvDatasetPath = path.join(dumpDir, 'r2_analytics_dataset.csv');
    if (analyticsRows.length > 0) {
        const headers = Object.keys(analyticsRows[0]).join(',');
        const csvLines = analyticsRows.map((row) =>
            Object.values(row)
                .map((val) => `"${String(val).replace(/"/g, '""')}"`)
                .join(',')
        );
        fs.writeFileSync(csvDatasetPath, [headers, ...csvLines].join('\n'));
    }

    // 4. Generate Export Report
    console.log('[4/4] Finalizing export summary report...');
    const reportPayload = {
        exportedAtUtc: new Date().toISOString(),
        totalObjectsExtracted: objects.length,
        totalBytesExtracted: downloadedBytes,
        totalMbExtracted: (downloadedBytes / (1024 * 1024)).toFixed(2) + ' MB',
        manifestsExtracted: manifestPaths.length,
        extractedDirectory: dumpDir,
        analyticsDatasetJson: 'r2_analytics_dataset.json',
        analyticsDatasetCsv: 'r2_analytics_dataset.csv',
    };

    const reportPath = path.join(dumpDir, 'dump_summary.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportPayload, null, 2));

    console.log(`\n✓ Full R2 Data Extraction & Analytics Pipeline Complete.`);
    console.log(`  • Extracted files stored in: ${dumpDir}`);
    console.log(`  • Analytics CSV for Excel/Pandas: ${path.basename(csvDatasetPath)}`);
    console.log(`  • Analytics JSON: ${path.basename(jsonDatasetPath)}`);
    console.log('═'.repeat(64) + '\n');
}

async function main() {
    const args = process.argv.slice(2);
    const jwtSecret = getJwtSecret();

    if (!jwtSecret) {
        console.error('❌ Error: JWT_SECRET not found in .dev.vars or environment.');
        process.exit(1);
    }

    if (args.includes('--dump')) {
        const customDir = args[args.indexOf('--dump') + 1];
        await executeFullDump(jwtSecret, customDir?.startsWith('--') ? undefined : customDir);
    } else {
        await fetchStats(jwtSecret);
        console.log('Tip: Run with "--dump" to extract the entire R2 vault and build CSV/JSON analytics datasets:');
        console.log('  npx tsx scripts/r2_data_extractor.ts --dump [optional_output_dir]\n');
    }
}

main().catch((err) => {
    console.error('\n❌ Extraction failed:', err.message);
    process.exit(1);
});