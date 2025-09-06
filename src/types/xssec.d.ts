declare module '@sap/xssec' {
  export function createSecurityContext(token: string, credentials: any, callback: (error: any, securityContext?: any) => void): void;
  
  export interface SecurityContext {
    getTokenInfo(): {
      getGivenName(): string;
      getFamilyName(): string;
      getLogonName(): string;
      getEmail(): string;
      getIdentityZone(): string;
    };
    getGrantedScopes(): string[];
  }
}