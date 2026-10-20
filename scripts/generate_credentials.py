#!/usr/bin/env python3
"""
NotaryConnect Lockdown Utility - Cryptographic Provisioning Engine
Generates:
1. RFC 6238 TOTP Base32 Secret and visual QR Code (totp-enrollment-qr.png)
2. 4096-bit RSA Private Key & X.509 PAdES-compliant certificate (Jurisdiction: IN)
3. 256-bit JWT Session Secret
4. Local Wrangler environment file (.dev.vars)
"""

import os
import base64
import secrets
import datetime
from pathlib import Path

# Cryptography & QR libraries installed in the uv venv
from cryptography import x509
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.colormasks import SolidFillColorMask


def generate_totp_seed() -> tuple[str, str]:
    """Generates a 160-bit Base32 secret and corresponding otpauth:// URI."""
    # 20 bytes = 160 bits (Standard RFC 6238 recommendation)
    random_bytes = secrets.token_bytes(20)
    base32_secret = base64.b32encode(random_bytes).decode("utf-8").replace("=", "")

    # Standard otpauth URI recognized by Google Authenticator & 1Password
    issuer = "NotaryConnect"
    account = "firm-operator@law.kroldon.app"
    uri = f"otpauth://totp/{issuer}:{account}?secret={base32_secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30"

    return base32_secret, uri


def create_qr_code(uri: str, output_path: Path):
    """Renders a high-contrast, scannable QR code formatted for mobile authenticators."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(uri)
    qr.make(fit=True)

    # Clean rendering ensuring standard camera readers parse instantly
    img = qr.make_image(fill_color="#09090b", back_color="#ffffff")
    img.save(str(output_path))


def generate_x509_signing_seal() -> tuple[str, str]:
    """Generates 4096-bit RSA Private Key and X.509 certificate tailored for India legal notary sealing."""
    # Generate 4096-bit RSA private key
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=4096,
    )

    # Subject & Issuer distinguished name (India jurisdiction)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Notary Connect"),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, "Secure Document Vault & Tamper-Evident Operations"),
        x509.NameAttribute(NameOID.COMMON_NAME, "NotaryConnect Secure Document Vault"),
    ])

    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Standard 3-year certificate lifespan
    cert_builder = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=3 * 365))
        # PAdES mandatory Key Usage: digitalSignature and nonRepudiation (contentCommitment)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=True,  # non-repudiation
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.BasicConstraints(ca=False, path_length=None),
            critical=True,
        )
        .add_extension(
            x509.SubjectKeyIdentifier.from_public_key(private_key.public_key()),
            critical=False,
        )
    )

    certificate = cert_builder.sign(
        private_key=private_key,
        algorithm=hashes.SHA256(),
    )

    # Serialize PEM format
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    certificate_pem = certificate.public_bytes(
        encoding=serialization.Encoding.PEM
    ).decode("utf-8")

    return private_key_pem, certificate_pem


def generate_jwt_secret() -> str:
    """Generates a 256-bit cryptographically secure hex secret for session cookies."""
    return secrets.token_hex(32)


def main():
    root_dir = Path(__file__).resolve().parent.parent
    qr_output_path = root_dir / "totp-enrollment-qr.png"
    dev_vars_path = root_dir / ".dev.vars"

    print("═════════════════════════════════════════════════════════════════════")
    print("  NotaryConnect Provisioning Engine - Cryptographic Bootstrapper     ")
    print("═════════════════════════════════════════════════════════════════════")

    # 1. TOTP Generation
    base32_secret, uri = generate_totp_seed()
    create_qr_code(uri, qr_output_path)
    print(f"\n[+] TOTP 160-bit Secret (RFC 6238): {base32_secret}")
    print(f"[+] Enrollment QR Code exported to: {qr_output_path.name}")
    print("    -> Scan 'totp-enrollment-qr.png' in Google Authenticator or 1Password.")

    # 2. X.509 PAdES Digital Seal Generation
    print("\n[+] Generating 4096-bit RSA Keypair & X.509 PAdES Certificate (India)...")
    key_pem, cert_pem = generate_x509_signing_seal()
    print("    -> Subject: C=IN, O=Notary Connect, CN=NotaryConnect Secure Document Vault")
    print("    -> Key Usage: Digital Signature, Non-Repudiation (Compliant Part 2)")

    # 3. JWT Session Secret
    jwt_secret = generate_jwt_secret()
    print(f"[+] JWT Session HMAC-SHA256 Secret: {jwt_secret[:8]}...[REDACTED]")

    # 4. Generate .dev.vars for Local Cloudflare Workers / Wrangler execution
    with open(dev_vars_path, "w", encoding="utf-8") as f:
        f.write(f'TOTP_SHARED_SECRET="{base32_secret}"\n')
        f.write(f'JWT_SECRET="{jwt_secret}"\n')
        # Format multiline certificates safely using escaped newlines
        escaped_key = key_pem.replace("\n", "\\n")
        escaped_cert = cert_pem.replace("\n", "\\n")
        f.write(f'SIGNING_KEY_PEM="{escaped_key}"\n')
        f.write(f'SIGNING_CERT_PEM="{escaped_cert}"\n')

    print(f"\n[+] Local environment secrets written to: {dev_vars_path.name}")
    print("    -> Automatically loaded by 'wrangler pages dev'")
    print("═════════════════════════════════════════════════════════════════════")
    print("Production Cloudflare Deployment Instructions:")
    print("Run these commands to inject secrets into your production Cloudflare Pages project:")
    print(f'  npx wrangler pages secret put TOTP_SHARED_SECRET --project-name notaryconnect-lockdown <<< "{base32_secret}"')
    print(f'  npx wrangler pages secret put JWT_SECRET --project-name notaryconnect-lockdown <<< "{jwt_secret}"')
    print("═════════════════════════════════════════════════════════════════════\n")


if __name__ == "__main__":
    main()