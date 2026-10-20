export interface SessionData {
    authenticated: boolean;
    user?: string;
    jurisdiction?: string;
    expiresAt?: number;
    secondsRemaining?: number;
    reason?: string;
}

export interface VerifyResponse {
    success?: boolean;
    message?: string;
    error?: string;
    remainingAttempts?: number;
    lockoutSecondsRemaining?: number;
}