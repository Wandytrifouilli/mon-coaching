// Tests bout en bout des fonctions api/ contre les émulateurs Auth + Firestore (`npm run test:emulators`).
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, setLogLevel } from "firebase/firestore";
import { adminAuth, adminDb } from "../api/_lib/firebaseAdmin.js";
import clientLogin from "../api/client-login.js";
import chat from "../api/chat.js";

assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, "lancer via les émulateurs");
assert.ok(!process.env.FIREBASE_SERVICE_ACCOUNT, "FIREBASE_SERVICE_ACCOUNT ne doit pas être défini pendant les tests");
delete process.env.ANTHROPIC_API_KEY; // aucun appel réel à l'API Anthropic
setLogLevel("silent");

const projectId = process.env.GCLOUD_PROJECT;
const app = initializeApp({ apiKey: "demo-key", projectId }, "test");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
const db = getFirestore(app);
const [fsHost, fsPort] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
connectFirestoreEmulator(db, fsHost, Number(fsPort));

// Appelle un handler Vercel avec des objets req/res minimaux
function call(handler, { method = "POST", body = {}, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.statusCode = c; return this; },
      json(o) { resolve({ status: this.statusCode, body: o, headers: this.headers }); return this; },
      end() { resolve({ status: this.statusCode, headers: this.headers }); return this; },
    };
    Promise.resolve(handler({ method, body, headers }, res)).catch(reject);
  });
}

before(async () => {
  await adminDb().doc("clients/1").set({ id: 1, name: "Alex", code: "ALEX2025", sessionLogs: [] });
  await adminDb().doc("clients/2").set({ id: 2, name: "Thomas", code: "THOM2025", sessionLogs: [] });
  await adminDb().doc("programs/10").set({ id: 10, name: "Full body" });
  const coachUser = await adminAuth().createUser({ email: "coach@test.fr", password: "motdepasse-test" });
  await adminAuth().setCustomUserClaims(coachUser.uid, { coach: true });
  await adminAuth().createUser({ email: "intrus@test.fr", password: "motdepasse-test" });
});

describe("api/client-login", () => {
  test("code valide (minuscules tolérées) : token client utilisable", async () => {
    const r = await call(clientLogin, { body: { code: " alex2025 " }, headers: { "x-real-ip": "1.1.1.1" } });
    assert.equal(r.status, 200);
    assert.equal(r.body.clientId, "1");
    const cred = await signInWithCustomToken(auth, r.body.token);
    assert.equal(cred.user.uid, "client_1");
    const own = await getDoc(doc(db, "clients", "1"));
    assert.equal(own.data().name, "Alex");
    await assert.rejects(getDoc(doc(db, "clients", "2")), /permission/i);
    await setDoc(doc(db, "clients", "1"), { ...own.data(), sessionLogs: [{ day: 1 }] });
    await assert.rejects(setDoc(doc(db, "programs", "10"), { id: 10, name: "pirate" }), /permission/i);
    await signOut(auth);
  });

  test("code inconnu : 401", async () => {
    const r = await call(clientLogin, { body: { code: "NOPE2025" }, headers: { "x-real-ip": "2.2.2.2" } });
    assert.equal(r.status, 401);
    assert.equal(r.body.token, undefined);
  });

  test("méthode GET refusée", async () => {
    const r = await call(clientLogin, { method: "GET" });
    assert.equal(r.status, 405);
  });

  test("force brute : blocage après 10 échecs, même avec un bon code", async () => {
    const headers = { "x-real-ip": "3.3.3.3" };
    for (let i = 0; i < 10; i++) {
      const r = await call(clientLogin, { body: { code: `FAUX${i}` }, headers });
      assert.equal(r.status, 401);
    }
    const blocked = await call(clientLogin, { body: { code: "ALEX2025" }, headers });
    assert.equal(blocked.status, 429);
    const otherIp = await call(clientLogin, { body: { code: "ALEX2025" }, headers: { "x-real-ip": "4.4.4.4" } });
    assert.equal(otherIp.status, 200);
  });

  test("pas d'en-tête CORS pour une origine non autorisée", async () => {
    const r = await call(clientLogin, { body: { code: "ALEX2025" }, headers: { origin: "https://pirate.example", "x-real-ip": "5.5.5.5" } });
    assert.equal(r.headers["Access-Control-Allow-Origin"], undefined);
  });
});

describe("api/chat", () => {
  const body = { system: "Tu es un coach.", messages: [{ role: "user", content: "Bonjour" }] };

  test("sans token : 401", async () => {
    const r = await call(chat, { body });
    assert.equal(r.status, 401);
  });

  test("token client : 403", async () => {
    const { body: login } = await call(clientLogin, { body: { code: "THOM2025" }, headers: { "x-real-ip": "6.6.6.6" } });
    const cred = await signInWithCustomToken(auth, login.token);
    const r = await call(chat, { body, headers: { authorization: `Bearer ${await cred.user.getIdToken()}` } });
    assert.equal(r.status, 403);
    await signOut(auth);
  });

  test("compte e-mail sans claim coach : 403", async () => {
    const cred = await signInWithEmailAndPassword(auth, "intrus@test.fr", "motdepasse-test");
    const r = await call(chat, { body, headers: { authorization: `Bearer ${await cred.user.getIdToken()}` } });
    assert.equal(r.status, 403);
    await signOut(auth);
  });

  test("coach : authentifié, requête validée (s'arrête faute de clé API en test)", async () => {
    const cred = await signInWithEmailAndPassword(auth, "coach@test.fr", "motdepasse-test");
    const headers = { authorization: `Bearer ${await cred.user.getIdToken()}` };
    const bad = await call(chat, { body: { messages: [{ role: "system", content: "x" }] }, headers });
    assert.equal(bad.status, 400);
    const huge = await call(chat, { body: { messages: [{ role: "user", content: "x".repeat(200000) }] }, headers });
    assert.equal(huge.status, 400);
    const ok = await call(chat, { body, headers });
    assert.equal(ok.status, 500);
    assert.match(ok.body.error, /Clé API manquante/);
    // Le coach lit toutes les fiches
    assert.equal((await getDoc(doc(db, "clients", "2"))).data().name, "Thomas");
    await signOut(auth);
  });
});
