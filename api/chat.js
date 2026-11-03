// Proxy IA Coach : réservé au coach authentifié (ID token Firebase avec la claim coach).
// Modèle et max_tokens sont imposés ici : le navigateur n'envoie que le prompt système et la conversation.
import Anthropic from "@anthropic-ai/sdk";
import { adminAuth, applyCors, readJsonBody } from "./_lib/firebaseAdmin.js";

const MODEL = "claude-sonnet-5-5";
const MAX_TOKENS = 16000;
const MAX_MESSAGES = 40;
const MAX_CHARS = 120000; // prompt système + conversation

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const idToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!idToken) return res.status(401).json({ error: "Non authentifié" });
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (decoded.coach !== true) return res.status(403).json({ error: "Accès réservé au coach" });
  } catch {
    return res.status(401).json({ error: "Session expirée, reconnecte-toi" });
  }

  const body = readJsonBody(req);
  const system = typeof body.system === "string" ? body.system : "";
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const valid = messages.length > 0 && messages.length <= MAX_MESSAGES &&
    messages.every(m => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content);
  const size = system.length + messages.reduce((n, m) => n + (m?.content?.length || 0), 0);
  if (!valid || size > MAX_CHARS) return res.status(400).json({ error: "Requête invalide" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Clé API manquante sur le serveur" });

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: "medium" },
      // Si le modèle décline la demande, l'API la relance sur un modèle de repli dans le même appel
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });
    if (response.stop_reason === "refusal") {
      return res.status(422).json({ error: "L'IA a refusé cette demande. Reformule-la." });
    }
    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    return res.status(200).json({ text });
  } catch (e) {
    console.error("[chat]", e);
    const status = e instanceof Anthropic.APIError && e.status ? e.status : 500;
    return res.status(status).json({ error: e instanceof Anthropic.APIError ? "Erreur API Anthropic" : "Erreur serveur" });
  }
}
