// Tests des règles Firestore — à lancer via `npm run test:emulators` (émulateur, jamais la prod).
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { setLogLevel } from "firebase/firestore";

setLogLevel("silent"); // les refus attendus ne polluent pas la sortie

let env;
const coach = () => env.authenticatedContext("coach-uid", { coach: true, email: "coach@test.fr" }).firestore();
const client = (id = "1", code = "ALEX2025") => env.authenticatedContext(`client_${id}`, { clientId: id, code }).firestore();
const stranger = () => env.authenticatedContext("random-uid", { email: "x@test.fr" }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
  env = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT || "demo-wandy",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
  });
});

after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await db.doc("clients/1").set({ id: 1, name: "Alex", code: "ALEX2025", sessionLogs: [] });
    await db.doc("clients/2").set({ id: 2, name: "Thomas", code: "THOM2025", sessionLogs: [] });
    await db.doc("programs/10").set({ id: 10, name: "Full body" });
    await db.doc("exercises/5").set({ id: 5, name: "Squat" });
    await db.doc("foods/7").set({ id: 7, name: "Riz" });
    await db.doc("settings/mealTemplate").set({ meals: [] });
    await db.doc("_loginAttempts/abc").set({ since: 0, fails: 3 });
  });
});

describe("non authentifié", () => {
  test("ne lit rien", async () => {
    await assertFails(anon().doc("clients/1").get());
    await assertFails(anon().collection("clients").get());
    await assertFails(anon().doc("programs/10").get());
    await assertFails(anon().doc("exercises/5").get());
    await assertFails(anon().doc("foods/7").get());
  });
  test("ne peut pas chercher un client par code", async () => {
    await assertFails(anon().collection("clients").where("code", "==", "ALEX2025").get());
  });
  test("n'écrit rien", async () => {
    await assertFails(anon().doc("clients/1").set({ code: "HACK" }));
    await assertFails(anon().doc("programs/99").set({ id: 99 }));
  });
});

describe("compte connecté sans rôle (ex. inscription e-mail sauvage)", () => {
  test("n'a accès à rien", async () => {
    await assertFails(stranger().doc("clients/1").get());
    await assertFails(stranger().doc("programs/10").get());
    await assertFails(stranger().doc("foods/7").get());
    await assertFails(stranger().doc("programs/10").set({ id: 10 }));
  });
});

describe("client", () => {
  test("lit sa propre fiche", async () => {
    await assertSucceeds(client().doc("clients/1").get());
  });
  test("ne lit pas la fiche d'un autre client", async () => {
    await assertFails(client().doc("clients/2").get());
  });
  test("ne liste pas les clients", async () => {
    await assertFails(client().collection("clients").get());
    await assertFails(client().collection("clients").where("code", "==", "THOM2025").get());
  });
  test("lit programmes, exercices et aliments", async () => {
    await assertSucceeds(client().collection("programs").get());
    await assertSucceeds(client().collection("exercises").get());
    await assertSucceeds(client().collection("foods").get());
  });
  test("ne modifie pas programmes, exercices, aliments, réglages", async () => {
    await assertFails(client().doc("programs/10").set({ id: 10, name: "pirate" }));
    await assertFails(client().doc("exercises/5").delete());
    await assertFails(client().doc("foods/8").set({ id: 8 }));
    await assertFails(client().doc("settings/mealTemplate").set({ meals: [1] }));
  });
  test("met à jour sa fiche (séance enregistrée)", async () => {
    await assertSucceeds(client().doc("clients/1").set({ id: 1, name: "Alex", code: "ALEX2025", sessionLogs: [{ day: 1 }] }));
  });
  test("ne change ni son code ni son id", async () => {
    await assertFails(client().doc("clients/1").set({ id: 1, name: "Alex", code: "AUTRE", sessionLogs: [] }));
    await assertFails(client().doc("clients/1").set({ id: 2, name: "Alex", code: "ALEX2025", sessionLogs: [] }));
  });
  test("ne supprime pas sa fiche et n'en crée pas", async () => {
    await assertFails(client().doc("clients/1").delete());
    await assertFails(client("3", "NEW2025").doc("clients/3").set({ id: 3, code: "NEW2025" }));
  });
  test("n'écrit pas la fiche d'un autre client", async () => {
    await assertFails(client().doc("clients/2").set({ id: 2, name: "Thomas", code: "THOM2025", sessionLogs: [1] }));
  });
  test("accès coupé dès que le coach change le code", async () => {
    await env.withSecurityRulesDisabled(ctx => ctx.firestore().doc("clients/1").update({ code: "NOUV2026" }));
    await assertFails(client().doc("clients/1").get());
    await assertFails(client().doc("clients/1").set({ id: 1, name: "Alex", code: "NOUV2026" }));
  });
  test("fiche supprimée : lecture refusée", async () => {
    await env.withSecurityRulesDisabled(ctx => ctx.firestore().doc("clients/1").delete());
    await assertFails(client().doc("clients/1").get());
  });
  test("ne touche pas aux compteurs anti force brute", async () => {
    await assertFails(client().doc("_loginAttempts/abc").get());
    await assertFails(client().doc("_loginAttempts/abc").delete());
  });
});

describe("coach", () => {
  test("lit et liste tout", async () => {
    await assertSucceeds(coach().collection("clients").get());
    await assertSucceeds(coach().doc("settings/mealTemplate").get());
  });
  test("crée, modifie, supprime clients et programmes", async () => {
    await assertSucceeds(coach().doc("clients/3").set({ id: 3, code: "CAMI2025" }));
    await assertSucceeds(coach().doc("clients/1").set({ id: 1, code: "ALEX2026" }));
    await assertSucceeds(coach().doc("clients/2").delete());
    await assertSucceeds(coach().doc("programs/11").set({ id: 11 }));
    await assertSucceeds(coach().doc("settings/mealTemplate").set({ meals: [1] }));
  });
});
