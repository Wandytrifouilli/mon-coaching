// Données de test pour les émulateurs locaux (jamais la prod) : deux clients, des exercices, un programme.
// Usage : émulateurs lancés (`npm run emulators`), puis `npm run seed:emulators`.
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
process.env.GCLOUD_PROJECT ||= "demo-wandy";
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("FIREBASE_SERVICE_ACCOUNT est défini : refus de lancer le seed (risque d'écrire en prod).");
  process.exit(1);
}
const { adminDb } = await import("../api/_lib/firebaseAdmin.js");

const db = adminDb();
await db.doc("clients/1").set({ id: 1, name: "Alex Test", code: "ALEX2025", goal: "Force", since: "Nov 2026", sessions: 0, color: "#E8C547", programs: [10], nutrition: { calories: 2200, proteins: 150, carbs: 250, fats: 70, notes: "" }, sessionLogs: [] });
await db.doc("clients/2").set({ id: 2, name: "Bea Test", code: "BEAT2025", goal: "Cardio", since: "Nov 2026", sessions: 0, color: "#C9A84C", programs: [], nutrition: { calories: 1900, proteins: 120, carbs: 200, fats: 60, notes: "" }, sessionLogs: [] });
await db.doc("exercises/1").set({ id: 1, name: "Squat Barre", muscle: "Jambes", equipment: "Barre", videoUrl: "https://www.youtube.com/embed/ultWZbUMPL8", notes: "Dos droit, genoux alignés" });
await db.doc("exercises/117").set({ id: 117, name: "Squat Pause", muscle: "Jambes", equipment: "Barre", videoUrl: "", notes: "Pause 2-3s en bas" });
await db.doc("programs/10").set({ id: 10, name: "Programme test", category: "Force", weeks: [{ label: "Semaine 1", days: [{ label: "Séance A", exercises: [{ exId: 1, sets: 3, reps: "8", rest: "90s", targetLoad: "" }, { exId: 117, sets: 3, reps: "5", rest: "2min", targetLoad: "" }] }] }] });
await db.doc("foods/1").set({ id: 1, name: "Riz", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 });

console.log("Seed OK — code coach : COACH-TEST (mode émulateur) — codes clients : ALEX2025, BEAT2025");
