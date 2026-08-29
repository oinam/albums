import { existsSync } from "node:fs";

/** Loads .env into process.env if present. Real environment variables win. */
export function loadEnv(path = ".env"): void {
  if (!existsSync(path)) return;
  process.loadEnvFile(path);
}
