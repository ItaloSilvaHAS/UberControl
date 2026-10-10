import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getWhopClient } from "./server/whopClient.js";
import { normalizeTransactionBatch } from "./server/dataValidation.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5000;
const app = express();
let adminClient;
const accessCache = new Map();
const ACCESS_CACHE_MS = 15_000;

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
}));

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    const error = new Error("Database server configuration is missing.");
    error.status = 503;
    throw error;
  }
  if (!adminClient) {
    adminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

function requireBillingConfig() {
  const companyId = process.env.WHOP_COMPANY_ID;
  const planId = process.env.WHOP_PLAN_ID;
  if (!companyId || !planId) {
    const error = new Error("Billing is not configured.");
    error.status = 503;
    throw error;
  }
  return { companyId, planId };
}

async function getUser(req) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }
  const { data, error } = await getSupabaseAdmin().auth.getUser(match[1]);
  if (error || !data?.user) {
    const invalid = new Error("Your session has expired. Sign in again.");
    invalid.status = 401;
    throw invalid;
  }
  if (!data.user.email_confirmed_at) {
    const unverified = new Error("Confirm your email before continuing.");
    unverified.status = 403;
    throw unverified;
  }
  return data.user;
}

async function findMembership(userId, force = false) {
  const { companyId, planId } = requireBillingConfig();
  const cached = accessCache.get(userId);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.membership;

  const whop = await getWhopClient();
  let membership = null;

  for (const status of ["active", "canceling"]) {
    let cursor;
    for (let pageIndex = 0; pageIndex < 20; pageIndex += 1) {
      const page = await whop.memberships.list({
        account_id: companyId,
        plan_id: planId,
        status,
        first: 100,
        ...(cursor ? { after: cursor } : {}),
      });
      const match = page.data?.find((item) =>
        item.metadata?.ubercontrol_supabase_user_id === userId
      );
      if (match) {
        membership = match;
        break;
      }
      if (!page.page_info?.has_next_page || !page.page_info.end_cursor) break;
      cursor = page.page_info.end_cursor;
    }
    if (membership) break;
  }

  accessCache.set(userId, {
    membership,
    expiresAt: Date.now() + ACCESS_CACHE_MS,
  });
  return membership;
}

async function requirePaidUser(req) {
  const user = await getUser(req);
  let membership;
  try {
    membership = await findMembership(user.id);
  } catch {
    const error = new Error("Não foi possível confirmar sua assinatura agora. Tente novamente em instantes.");
    error.status = 503;
    throw error;
  }
  if (!membership) {
    const error = new Error("Assinatura ativa necessária.");
    error.status = 402;
    throw error;
  }
  return { user, membership };
}

function sendError(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  if (status >= 500) console.error("API request failed:", error?.name || "Error");
  res.status(status).json({
    error: status === 500 ? "Não foi possível concluir a solicitação." : error.message,
    code: status === 402 ? "subscription_required" : undefined,
  });
}

async function readSettings(userId) {
  const { data, error } = await getSupabaseAdmin()
    .from("driver_settings")
    .select("daily_goal")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Settings query failed.");
  return { dailyGoal: Number(data?.daily_goal || 0) };
}

app.get("/api/config", (_req, res) => {
  const url = process.env.SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || "";
  res.set("Cache-Control", "no-store");
  res.json({
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
    supabaseReady: Boolean(url && anonKey && process.env.SUPABASE_SERVICE_ROLE_KEY),
    billingReady: Boolean(process.env.WHOP_COMPANY_ID && process.env.WHOP_PLAN_ID),
    monthlyPrice: 19.9,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/billing/status", async (req, res) => {
  try {
    const user = await getUser(req);
    const membership = await findMembership(user.id, true);
    res.json({
      active: Boolean(membership),
      manageUrl: membership?.manage_url || null,
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/billing/checkout", rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
}), async (req, res) => {
  try {
    const user = await getUser(req);
    const existingMembership = await findMembership(user.id, true);
    if (existingMembership) {
      return res.json({ active: true });
    }
    const { companyId, planId } = requireBillingConfig();
    const whop = await getWhopClient();
    const checkout = await whop.checkoutConfigurations.create({
      account_id: companyId,
      plan_id: planId,
      metadata: { ubercontrol_supabase_user_id: user.id },
    });
    const purchaseUrl = checkout?.purchase_url;
    const parsed = purchaseUrl ? new URL(purchaseUrl) : null;
    if (!parsed || parsed.protocol !== "https:" ||
        !(parsed.hostname === "whop.com" || parsed.hostname.endsWith(".whop.com"))) {
      throw new Error("Whop did not return a valid checkout URL.");
    }
    res.json({ purchaseUrl: parsed.toString() });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/transactions", async (req, res) => {
  try {
    const { user } = await requirePaidUser(req);
    const { data, error } = await getSupabaseAdmin()
      .from("driver_transactions")
      .select("id,type,value,date,time,category,km,hours,description,created_at")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error("Transaction query failed.");
    res.json({
      transactions: (data || []).map((row) => ({
        id: row.id,
        type: row.type,
        value: Number(row.value),
        date: row.date,
        time: row.time || "",
        category: row.category || "",
        km: Number(row.km || 0),
        hours: Number(row.hours || 0),
        description: row.description || "",
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.put("/api/transactions", async (req, res) => {
  try {
    const { user } = await requirePaidUser(req);
    const normalized = normalizeTransactionBatch(req.body?.transactions);
    const { error } = await getSupabaseAdmin().rpc("replace_driver_transactions", {
      p_user_id: user.id,
      p_transactions: normalized,
    });
    if (error) throw new Error("Transaction save failed.");
    res.json({ saved: normalized.length });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/settings", async (req, res) => {
  try {
    const { user } = await requirePaidUser(req);
    res.json(await readSettings(user.id));
  } catch (error) {
    sendError(res, error);
  }
});

app.put("/api/settings", async (req, res) => {
  try {
    const { user } = await requirePaidUser(req);
    const dailyGoal = Number(req.body?.dailyGoal);
    if (!Number.isFinite(dailyGoal) || dailyGoal < 0 || dailyGoal > 1_000_000_000) {
      return res.status(400).json({ error: "Informe uma meta diária válida." });
    }
    const { error } = await getSupabaseAdmin()
      .from("driver_settings")
      .upsert({ user_id: user.id, daily_goal: dailyGoal }, { onConflict: "user_id" });
    if (error) throw new Error("Settings save failed.");
    res.json({ dailyGoal });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/vendor/supabase.js", (_req, res) => {
  res.sendFile(path.join(ROOT, "node_modules/@supabase/supabase-js/dist/umd/supabase.js"));
});
app.get("/vendor/chart.js", (_req, res) => {
  res.sendFile(path.join(ROOT, "node_modules/chart.js/dist/chart.umd.js"));
});

for (const file of ["index.html", "style.css", "script.js", "auth.js"]) {
  app.get(file === "index.html" ? "/" : `/${file}`, (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(ROOT, file));
  });
}

app.use("/api", (_req, res) => res.status(404).json({ error: "Rota não encontrada." }));
app.use((_req, res) => res.status(404).send("Página não encontrada."));
app.use((error, _req, res, _next) => sendError(res, error));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`UberControl ouvindo na porta ${PORT}`);
});
