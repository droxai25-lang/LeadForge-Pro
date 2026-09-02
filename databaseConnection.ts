const UNCONFIGURED_DATABASE_URL =
  "postgresql://leadforge_app:unconfigured@127.0.0.1:55432/leadforge_prod?schema=public";

export function resolveDatabaseConnectionString(environment: NodeJS.ProcessEnv): string {
  const password = environment.POSTGRES_APP_PASSWORD?.trim();
  if (!password) return environment.DATABASE_URL?.trim() || UNCONFIGURED_DATABASE_URL;

  const containerized = environment.CONTAINERIZED === "true";
  const host = containerized ? "postgres" : "127.0.0.1";
  const rawPort = containerized ? "5432" : environment.POSTGRES_HOST_PORT || "55432";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("POSTGRES_HOST_PORT must be an integer between 1 and 65535.");
  }

  return `postgresql://leadforge_app:${encodeURIComponent(password)}@${host}:${port}/leadforge_prod?schema=public`;
}
