/**
 * Payload di sessione dal claim "session" del JWT. Rispecchia a mano il record C#
 * `backend/Models/SessionInfo.cs` (niente codegen); chiavi camelCase (serializzazione JSON "Web").
 * Esempio del template — adatta i campi di dominio insieme al record C#.
 */
export interface SessionInfo {
    userId: string;
    displayName: string;
    roles: string[];
}
