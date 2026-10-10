const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
const token = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY
  : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
if (!hostname || !token) throw new Error("Missing Replit connector runtime configuration.");

async function mcpCall(method, params = {}) {
  const resp = await fetch(`https://${hostname}/api/v2/proxy/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "X-Replit-Token": token,
      "Connector-Name": "whop",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Whop MCP request failed (${resp.status}): ${text}`);
  const lines = text.split("\n").filter((line) => line.startsWith("data:"));
  const lastDataLine = lines.at(-1);
  const envelope = lastDataLine
    ? JSON.parse(lastDataLine.replace(/^data:\s*/, ""))
    : JSON.parse(text);
  if (envelope.error) {
    throw new Error(`Whop MCP error: ${envelope.error.message || "request failed"}`);
  }
  const result = envelope.result;
  const textContent = result?.content?.[0]?.text;
  return textContent ? JSON.parse(textContent) : result;
}

const [command, argsJson] = process.argv.slice(2);
if (command === "--list-tools") {
  const { tools } = await mcpCall("tools/list");
  tools.forEach((tool) => console.log(`${tool.name} — ${tool.description}`));
} else if (command === "--schema") {
  const { tools } = await mcpCall("tools/list");
  const tool = tools.find((item) => item.name === argsJson);
  console.log(tool ? JSON.stringify(tool.inputSchema, null, 2) : `Tool "${argsJson}" not found`);
} else if (command) {
  const result = await mcpCall("tools/call", {
    name: command,
    arguments: JSON.parse(argsJson || "{}"),
  });
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log("Usage: node whop-mcp.mjs --list-tools | --schema <tool> | <tool> '{...}'");
}
