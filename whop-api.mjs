const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
const token = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY
  : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;

const [method, path, bodyJson] = process.argv.slice(2);
if (!hostname || !token) throw new Error("Missing Replit connector runtime configuration.");
if (!method || !path) {
  console.log("Usage: node whop-api.mjs <METHOD> <path> ['{...}']");
  process.exit(0);
}

const resp = await fetch(`https://${hostname}/api/v2/proxy/${path}`, {
  method,
  headers: {
    "Content-Type": "application/json",
    "X-Replit-Token": token,
    "Connector-Name": "whop",
  },
  ...(bodyJson ? { body: bodyJson } : {}),
});
const text = await resp.text();
if (!resp.ok) throw new Error(`Whop request failed (${resp.status}): ${text}`);
console.log(JSON.stringify(JSON.parse(text), null, 2));
