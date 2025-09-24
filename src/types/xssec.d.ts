// Minimal type definitions for @sap/xssec v3.x
declare module '@sap/xssec' {
  export function createSecurityContext(
    token: string,
    credentials: any,
    callback: (error: any, securityContext?: any) => void
  ): void;
}
