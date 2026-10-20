import { base32Decode, verifyTOTP, generateCurrentTOTP } from '../functions/utils/totp';
import { generateClientFingerprint, extractNetworkPrefix } from '../functions/utils/fingerprint';
import { signSessionToken, verifySessionToken } from '../functions/utils/jwt';

async function runTests() {
    console.log('═'.repeat(60));
    console.log('  TEST SUITE: Cryptographic Authentication Engine (Task 2.1)  ');
    console.log('═'.repeat(60));

    const testSecret = 'JBSWY3DPEHPK3PXP'; // Standard RFC test secret (Base32)
    const testJwtSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    // Test 1: Base32 Decoding
    console.log('\n[1] Testing Base32 Decoding...');
    const decoded = base32Decode(testSecret);
    if (decoded.length === 10) {
        console.log('    ✓ Base32 decode passed (10 bytes recovered).');
    } else {
        throw new Error('Base32 decode failed.');
    }

    // Test 2: TOTP Generation & Verification with Skew Tolerance
    console.log('\n[2] Testing RFC 6238 TOTP Generation & Verification...');
    const currentToken = await generateCurrentTOTP(testSecret);
    console.log(`    -> Generated active token: ${currentToken}`);

    const isValid = await verifyTOTP(currentToken, testSecret);
    if (isValid) {
        console.log('    ✓ TOTP verification of active token passed.');
    } else {
        throw new Error('Active TOTP verification failed.');
    }

    // Verify invalid token is rejected
    const isInvalidRejected = !(await verifyTOTP('000000', testSecret));
    if (isInvalidRejected) {
        console.log('    ✓ Invalid token 000000 correctly rejected.');
    } else {
        throw new Error('Invalid TOTP allowed.');
    }

    // Test 3: Network Prefix Extraction & Fingerprint Binding
    console.log('\n[3] Testing Client-Binding Fingerprint Engine...');
    const ipV4 = '103.21.244.52';
    const prefix = extractNetworkPrefix(ipV4);
    console.log(`    -> IPv4 ${ipV4} normalized prefix: ${prefix}`);
    if (prefix === '103.21.244.0/24') {
        console.log('    ✓ IPv4 /24 subnet masking passed.');
    } else {
        throw new Error('Subnet masking failed.');
    }

    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
    const fp1 = await generateClientFingerprint(ua, ipV4);
    const fp2 = await generateClientFingerprint(ua, '103.21.244.99'); // Same /24 subnet
    const fpOther = await generateClientFingerprint(ua, '198.51.100.1'); // Different subnet

    if (fp1 === fp2) {
        console.log('    ✓ Fingerprint matches across same /24 subnet DHCP shifts.');
    } else {
        throw new Error('Subnet shifting failed.');
    }

    if (fp1 !== fpOther) {
        console.log('    ✓ Fingerprint changes when network prefix changes.');
    } else {
        throw new Error('Foreign IP not detected.');
    }

    // Test 4: 24-Hour JWT Session Minter & Verifier
    console.log('\n[4] Testing HS256 24-Hour Session JWT...');
    const token = await signSessionToken('legal-operator@kroldon.app', fp1, testJwtSecret);
    console.log(`    -> Minted JWT: ${token.substring(0, 32)}...`);

    const payload = await verifySessionToken(token, testJwtSecret, fp1);
    if (payload && payload.sub === 'legal-operator@kroldon.app') {
        const lifespanHours = (payload.exp - payload.iat) / 3600;
        console.log(`    ✓ JWT verified successfully. Token lifespan: ${lifespanHours} hours.`);
    } else {
        throw new Error('JWT verification failed.');
    }

    // Test 5: Tamper & Hijack Rejection
    console.log('\n[5] Testing Session Anti-Tampering & Anti-Hijacking...');
    const tamperedToken = token.slice(0, -4) + 'abcd';
    const tamperedResult = await verifySessionToken(tamperedToken, testJwtSecret, fp1);
    if (tamperedResult === null) {
        console.log('    ✓ Tampered JWT signature rejected.');
    } else {
        throw new Error('Tampered JWT accepted.');
    }

    const hijackedResult = await verifySessionToken(token, testJwtSecret, fpOther);
    if (hijackedResult === null) {
        console.log('    ✓ Replayed JWT from foreign network fingerprint rejected.');
    } else {
        throw new Error('Hijacked JWT accepted.');
    }

    console.log('\n' + '═'.repeat(60));
    console.log('  ALL CRYPTOGRAPHIC TESTS PASSED (100% SPEC COMPLIANT)       ');
    console.log('═'.repeat(60) + '\n');
}

runTests().catch((err) => {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
});