// Connexion par code (un seul champ pour tout le monde), vérifiée côté serveur.
// - Code coach : variable d'environnement COACH_CODE (jamais dans le code de l'app) → token avec la claim coach.
// - Code adhérent : fiche clients/{id} → token portant clientId + code. Les règles Firestore limitent
//   le client à sa propre fiche, et un changement de code par le coach coupe l'accès immédiatement.
import { createHash, timingSafeEqual } from "node:crypto";
import { adminAuth, adminDb, applyCors, readJsonBody } from "./_lib/firebaseAdmin.js";

const MAX_FAILS = 10;               // essais ratés autorisés par IP…
const WINDOW_MS = 15 * 60 * 1000;   // …sur cette fenêtre

const sha = s => createHash("sha256").update(s).digest();

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return String(req.headers["x-real-ip"] || fwd || req.socket?.remoteAddress || "unknown");
}

// Comparaison à durée constante (sur les empreintes, de même longueur)
function isCoachCode(code) {
  const expected = String(process.env.COACH_CODE || "").trim().toUpperCase();
  return expected.length >= 6 && timingSafeEqual(sha(code), sha(expected));
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const code = String(readJsonBody(req).code || "").trim().toUpperCase();
  if (!code || code.length > 64) return res.status(401).json({ error: "invalid" });

  try {
    const db = adminDb();
    // Anti force brute : compteur d'échecs par IP (hachée), inaccessible aux clients via les règles
    const ipHash = sha(clientIp(req)).toString("hex").slice(0, 32);
    const limiterRef = db.collection("_loginAttempts").doc(ipHash);
    const now = Date.now();
    const prev = (await limiterRef.get()).data();
    const state = prev && now - prev.since < WINDOW_MS ? prev : { since: now, fails: 0 };
    if (state.fails >= MAX_FAILS) return res.status(429).json({ error: "locked" });

    if (isCoachCode(code)) {
      const token = await adminAuth().createCustomToken("coach", { coach: true });
      return res.status(200).json({ token, role: "coach" });
    }

    const snap = await db.collection("clients").where("code", "==", code).limit(1).get();
    if (snap.empty) {
      await limiterRef.set({ since: state.since, fails: state.fails + 1 });
      return res.status(401).json({ error: "invalid" });
    }

    const clientId = snap.docs[0].id;
    const token = await adminAuth().createCustomToken(`client_${clientId}`, { clientId, code });
    return res.status(200).json({ token, role: "client", clientId });
  } catch (e) {
    console.error("[login]", e);
    return res.status(500).json({ error: "server" });
  }
}
