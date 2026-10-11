import { Whop } from "@whop/sdk";

let clientPromise;

async function initWhopClient() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const replitToken = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;

  if (!hostname || !replitToken) {
    throw new Error("Whop connector runtime configuration is missing.");
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=whop`,
    {
      headers: { Accept: "application/json", "X-Replit-Token": replitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Could not load Whop connection (${response.status}).`);
  }

  const data = await response.json();
  const settings = data.items?.[0]?.settings;
  if (!settings?.api_key) {
    throw new Error("Whop is connected but its API credentials are unavailable.");
  }

  return new Whop({ apiKey: settings.api_key });
}

export function getWhopClient() {
  if (!clientPromise) {
    clientPromise = initWhopClient().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }
  return clientPromise;
}
