import fs from "node:fs";

const envPath = ".env";

function parseEnvFile(contents) {
  const env = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const required = [
  ["JWT_SECRET", (value) => typeof value === "string" && value.trim().length >= 32],
  ["TOKEN_HASH_SECRET", (value) => typeof value === "string" && value.trim().length >= 32],
  ["MAILBOX_ENCRYPTION_KEY", (value) => /^[a-f0-9]{64}$/i.test(value || "")],
  ["INBOUND_WEBHOOK_SECRET", (value) => typeof value === "string" && value.trim().length >= 32],
  ["UNSUBSCRIBE_SECRET", (value) => typeof value === "string" && value.trim().length >= 32],
  ["DELIVERY_WEBHOOK_SECRET", (value) => typeof value === "string" && value.trim().length >= 32],
  ["OWNER_EMAILS", (value) => typeof value === "string" && value.trim().length > 0],
  ["OWNER_PASSWORD", (value) => typeof value === "string" && value.trim().length >= 12],
  ["POSTGRES_APP_PASSWORD", (value) => typeof value === "string" && value.trim().length > 0],
  ["REDIS_URL", (value) => typeof value === "string" && value.trim().length > 0],
  ["PORT", (value) => Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 65535]
];

if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath}. Copy .env.example to .env and fill in the required values.`);
  process.exit(1);
}

const env = parseEnvFile(fs.readFileSync(envPath, "utf8"));
const invalid = required.filter(([key, validator]) => !validator(env[key]));

if (invalid.length > 0) {
  const list = invalid.map(([key]) => `- ${key}`).join("\n");
  console.error("Environment validation failed. Set these values in .env:\n" + list);
  process.exit(1);
}

console.log("Environment validation passed.");
