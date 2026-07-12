/** Payload di POST /auth/login. */
export interface LoginRequest {
    username: string;
    pwd: string;
}

/**
 * Risposta di POST /auth/login. Gli errori arrivano come HTTP (ProblemDetails), tradotti per status
 * code in `AuthService.login`.
 */
export interface LoginResult {
    valid: boolean;
    token?: string;
}
