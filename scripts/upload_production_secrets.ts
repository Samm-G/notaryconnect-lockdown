import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const WORKER_NAME = 'notaryconnect-lockdown';

function uploadSecret(name: string, value: string) {
    console.log(`Uploading secret [${name}] to Cloudflare Worker [${WORKER_NAME}]...`);
    try {
        // Pipe secret directly to avoid shell escaping issues with multiline certificates
        execSync(`npx wrangler secret put ${name} --name ${WORKER_NAME}`, {
            input: value,
            stdio: ['pipe', 'inherit', 'inherit'],
        });
        console.log(`✓ Secret [${name}] uploaded successfully.\n`);
    } catch (err: unknown) {
        console.error(`❌ Failed to upload secret [${name}]:`, err instanceof Error ? err.message : err);
        process.exit(1);
    }
}

async function main() {
    const devVarsPath = path.resolve('.dev.vars');
    if (!fs.existsSync(devVarsPath)) {
        throw new Error('.dev.vars not found. Run scripts/generate_credentials.py first.');
    }

    const content = fs.readFileSync(devVarsPath, 'utf-8');
    let totpSecret = '';
    let jwtSecret = '';
    let signingKeyPem = '';
    let signingCertPem = '';

    for (const line of content.split('\n')) {
        if (line.startsWith('TOTP_SHARED_SECRET=')) {
            totpSecret = line.replace('TOTP_SHARED_SECRET=', '').replace(/^"|"$/g, '').trim();
        }
        if (line.startsWith('JWT_SECRET=')) {
            jwtSecret = line.replace('JWT_SECRET=', '').replace(/^"|"$/g, '').trim();
        }
        if (line.startsWith('SIGNING_KEY_PEM=')) {
            signingKeyPem = line
                .replace('SIGNING_KEY_PEM=', '')
                .replace(/^"|"$/g, '')
                .replace(/\\n/g, '\n')
                .trim();
        }
        if (line.startsWith('SIGNING_CERT_PEM=')) {
            signingCertPem = line
                .replace('SIGNING_CERT_PEM=', '')
                .replace(/^"|"$/g, '')
                .replace(/\\n/g, '\n')
                .trim();
        }
    }

    console.log('═'.repeat(64));
    console.log('   NOTARYCONNECT - WORKER PRODUCTION SECRETS UPLOADER           ');
    console.log('═'.repeat(64) + '\n');

    uploadSecret('TOTP_SHARED_SECRET', totpSecret);
    uploadSecret('JWT_SECRET', jwtSecret);
    uploadSecret('SIGNING_KEY_PEM', signingKeyPem);
    uploadSecret('SIGNING_CERT_PEM', signingCertPem);

    console.log('═'.repeat(64));
    console.log('✓ ALL 4 CRYPTOGRAPHIC SECRETS DEPLOYED TO CLOUDFLARE WORKER');
    console.log('═'.repeat(64) + '\n');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});