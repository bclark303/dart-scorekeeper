export type DatabaseSetupRuntime =
  | "vercel"
  | "cloudflare"
  | "self-hosted"
  | "node";

export type DatabaseSetupProvider = "sqlite" | "turso" | "d1";

export type DatabaseSetupStatus = {
  runtime: DatabaseSetupRuntime;
  current: {
    configured: boolean;
    healthy: boolean;
    provider: DatabaseSetupProvider | "unknown";
    target: "local" | "remote" | null;
    source: "runtime-file" | "environment" | "development-default" | "none";
    message: string;
  };
  account: {
    ready: boolean;
    secretConfigured: boolean;
  };
  capabilities: {
    canPersistFromApp: boolean;
    canUseLocalSqlite: boolean;
    canUseTurso: boolean;
    canUseD1: boolean;
    d1AdapterAvailable: boolean;
    setupTokenRequired: boolean;
  };
};

export type DatabaseConnectionDraft =
  | {
      provider: "sqlite";
      fileUrl: string;
    }
  | {
      provider: "turso";
      url: string;
      authToken: string;
    }
  | {
      provider: "d1";
      bindingName: string;
    };

export type DatabaseSetupActionResponse = {
  ok: boolean;
  message: string;
  status?: DatabaseSetupStatus;
};
