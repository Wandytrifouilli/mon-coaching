// Tableau des performances de l'athlète (app client et espace coach).
// RM, haltérophilie, gymnastique, ergomètres, course, benchmarks CrossFit + bilan statistique.
import { useState, useEffect } from "react";
import {
  PERF_GROUPS, BW_TEST, KINDS, RM_REPS, RATIOS, testById, variantOf,
  parseValue, rawValue, display, fmtValue, fmtNum, fmtDate, todayISO, newId,
  entriesOf, bestOf, lastOf, prIds, liftSummary, paceInfo, bodyweight, totals, syncedTests,
} from "./perfCatalog.js";

const T = {
  gold: "#C9A84C", goldLight: "#E8C547", bg: "#080808", green: "#52C07A", red: "#E05252",
  card: "linear-gradient(180deg,#151515 0%,#0f0f0f 100%)", line: "#ffffff0f", line2: "#ffffff1a",
  muted: "#8d8d8d", dim: "#5c5c5c", font: "'Barlow',sans-serif", fontD: "'Barlow Condensed',sans-serif",
};
T.goldGrad = `linear-gradient(135deg,${T.goldLight},${T.gold})`;
const card = { background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 14 };
const btnReset = { border: "none", background: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 };
const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: T.muted };
const isRM = t => t.variants.length === RM_REPS.length && t.variants[0].key === "1rm";
const daysAgo = iso => (Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86400000;

export default function PerfBoard({ client, update, wide = false, coach = false }) {
  const log = client.perfLog || [];
  const sex = client.perfSex || "";
  const [group, setGroup] = useState(coach ? "bilan" : "force");
  const [open, setOpen] = useState({});
  const [form, setForm] = useState(null); // { test, variant, entry? }
  const [flash, setFlash] = useState(null);
  const prs = prIds(log);

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 3500); return () => clearTimeout(t); }, [flash]);

  // Toute modification du journal met aussi à jour les valeurs de référence (1RM, VMA…) si elles sont dépassées
  const saveLog = fn => update(c => {
    const perfLog = fn(c.perfLog || []);
    const tests = syncedTests(perfLog, c.tests || {});
    return { ...c, perfLog, ...(tests !== (c.tests || {}) ? { tests } : {}) };
  });
  const submit = (entry, isNew) => {
    const v = variantOf(testById(entry.test), entry.variant);
    const prev = bestOf(log.filter(e => e.id !== entry.id), entry.test, entry.variant, testById(entry.test).wod ? !!entry.rx : undefined);
    const better = KINDS[v.kind].better;
    if (better !== "none" && (!prev || (better === "low" ? entry.value < prev.value : entry.value > prev.value)))
      setFlash(`${prev ? "Nouveau record" : "Première perf enregistrée"} : ${testById(entry.test).name} · ${v.label}${testById(entry.test).wod ? (entry.rx ? " (RX)" : " (scaled)") : ""}`);
    saveLog(l => (isNew ? [...l, entry] : l.map(e => (e.id === entry.id ? entry : e))));
    setForm(null);
  };
  const remove = id => { saveLog(l => l.filter(e => e.id !== id)); setForm(null); };

  const recent30 = log.filter(e => prs.has(e.id) && daysAgo(e.date) <= 30).length;
  const filled = new Set(log.filter(e => e.test !== "bw").map(e => e.test)).size;
  const groups = [{ id: "bilan", label: "Bilan" }, ...PERF_GROUPS];
  const g = PERF_GROUPS.find(x => x.id === group);

  return (
    <div style={{ fontFamily: T.font, color: "#F5F0E8" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
        {[[log.filter(e => e.test !== "bw").length, "Perfs notées"], [filled, "Tests faits"], [recent30, "Records 30 j"]].map(([v, l]) => (
          <div key={l} style={{ ...card, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontFamily: T.fontD, fontSize: 26, fontWeight: 800, lineHeight: 1, color: v ? T.goldLight : T.dim }}>{v}</div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      <div role="tablist" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 12, scrollbarWidth: "none" }}>
        {groups.map(x => {
          const on = x.id === group;
          return (
            <button key={x.id} role="tab" aria-selected={on} onClick={() => setGroup(x.id)}
              style={{ ...btnReset, flexShrink: 0, height: 36, padding: "0 14px", borderRadius: 12, fontSize: 13.5, fontWeight: 700,
                background: on ? T.goldGrad : "#ffffff0a", color: on ? T.bg : "#ccc", border: on ? "none" : `1px solid ${T.line2}` }}>
              {x.label}
            </button>
          );
        })}
      </div>

      {flash && (
        <div role="status" style={{ ...card, borderColor: T.gold + "66", background: T.gold + "14", color: T.goldLight, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          🏆 {flash}
        </div>
      )}

      {group === "bilan"
        ? <Bilan log={log} sex={sex} prs={prs} wide={wide} onSex={s => update(c => ({ ...c, perfSex: s }))}
            onBw={() => setForm({ test: BW_TEST, variant: BW_TEST.variants[0] })}
            onOpen={e => { const t = testById(e.test); setForm({ test: t, variant: variantOf(t, e.variant), entry: e }); }} />
        : <div style={{ display: "grid", gridTemplateColumns: wide ? "1fr 1fr" : "1fr", gap: 10, alignItems: "start" }}>
            {g.tests.map(t => (
              <TestCard key={t.id} test={t} log={log} prs={prs} open={!!open[t.id]} wide={wide}
                onToggle={() => setOpen(o => ({ ...o, [t.id]: !o[t.id] }))}
                onAdd={v => setForm({ test: t, variant: v })}
                onEdit={e => setForm({ test: t, variant: variantOf(t, e.variant), entry: e })} />
            ))}
          </div>}

      {form && <EntrySheet {...form} log={log} onClose={() => setForm(null)} onSubmit={submit} onDelete={remove} />}
    </div>
  );
}

// ─── Carte d'un test ──────────────────────────────────────────────────────────
function TestCard({ test, log, prs, open, wide, onToggle, onAdd, onEdit }) {
  const primary = test.primary.map(k => variantOf(test, k));
  const others = test.variants.filter(v => !test.primary.includes(v.key));
  const hist = entriesOf(log, test.id).reverse();
  const lift = isRM(test) ? liftSummary(log, test.id) : null;
  const bw = bodyweight(log);
  const count = hist.length;
  const expandable = others.length > 0 || count > 0;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.fontD, fontSize: 20, fontWeight: 800, letterSpacing: -.2, lineHeight: 1.15 }}>{test.name}</div>
          {(test.desc || test.sub) && <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3, lineHeight: 1.4 }}>{test.desc || test.sub}</div>}
        </div>
        {expandable && (
          <button onClick={onToggle} aria-expanded={open} aria-label={open ? "Réduire" : "Voir tout"}
            style={{ ...btnReset, width: 34, height: 34, borderRadius: 11, flexShrink: 0, background: open ? T.gold + "22" : "#ffffff0d",
              color: open ? T.goldLight : "#ccc", fontSize: 22, fontWeight: 600, lineHeight: "34px", textAlign: "center", border: `1px solid ${T.line2}` }}>
            {open ? "−" : "+"}
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: primary.length > 1 ? "1fr 1fr" : "1fr", gap: 8 }}>
        {primary.map(v => <Tile key={v.key} test={test} v={v} log={log} big onClick={() => onAdd(v)} />)}
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          {others.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${wide ? 3 : others.length >= 5 ? 3 : 2},1fr)`, gap: 8, marginBottom: 12 }}>
              {others.map(v => <Tile key={v.key} test={test} v={v} log={log} onClick={() => onAdd(v)} />)}
            </div>
          )}

          {lift?.ref && (
            <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              {lift.est && (!lift.real || lift.est > lift.real) && <Line k="1RM estimé" v={`${fmtNum(lift.est)} kg`} sub={`d'après ton ${lift.estFrom}`} />}
              {bw && !test.sub && <Line k="Force relative" v={`× ${fmtNum(lift.ref / bw, 2)}`} sub={`poids de corps ${fmtNum(bw)} kg`} />}
              <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>Charges de travail (sur {fmtNum(lift.ref)} kg)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[60, 70, 75, 80, 85, 90, 95].map(p => (
                  <span key={p} style={{ fontSize: 12, padding: "5px 9px", borderRadius: 9, background: "#ffffff0a", border: `1px solid ${T.line}` }}>
                    <b style={{ color: T.goldLight }}>{p} %</b> {fmtNum(Math.round(lift.ref * p / 100 * 2) / 2)} kg
                  </span>
                ))}
              </div>
            </div>
          )}

          {count > 0 && <Trend test={test} log={log} />}

          {count > 0 && (
            <>
              <div style={{ ...eyebrow, margin: "14px 0 6px" }}>Historique · {count}</div>
              {hist.slice(0, 12).map(e => {
                const v = variantOf(test, e.variant);
                return (
                  <button key={e.id} onClick={() => onEdit(e)}
                    style={{ ...btnReset, width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${T.line}`, textAlign: "left" }}>
                    <span style={{ fontSize: 12, color: T.muted, width: 62, flexShrink: 0 }}>{fmtDate(e.date)}</span>
                    <span style={{ fontSize: 13, color: "#bbb", flexShrink: 0 }}>{v?.label}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.note}</span>
                    {test.wod && <span style={{ fontSize: 10.5, fontWeight: 800, color: e.rx ? T.goldLight : T.muted }}>{e.rx ? "RX" : "SCALED"}</span>}
                    {prs.has(e.id) && <span style={{ fontSize: 10.5, fontWeight: 800, color: T.green }}>PR</span>}
                    <span style={{ fontWeight: 800, fontSize: 14.5 }}>{fmtValue(v?.kind, e.value, test)}</span>
                  </button>
                );
              })}
              {count > 12 && <div style={{ fontSize: 12, color: T.dim, paddingTop: 6 }}>+ {count - 12} perfs plus anciennes</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Tile({ test, v, log, big, onClick }) {
  const best = bestOf(log, test.id, v.key);
  const d = display(v.kind, best?.value, test);
  const pace = best && paceInfo(test, v, best.value);
  const tries = entriesOf(log, test.id, v.key).length;
  // 1RM jamais testé : on affiche l'estimation tirée des autres RM
  const est = !best && v.key === "1rm" ? liftSummary(log, test.id)?.est : null;
  return (
    <button onClick={onClick} aria-label={`${test.name} ${v.label} : ${best ? fmtValue(v.kind, best.value, test) : "ajouter"}`}
      style={{ ...btnReset, textAlign: "left", borderRadius: 14, padding: big ? "11px 12px" : "9px 10px", minWidth: 0,
        background: best ? T.gold + "0f" : "#ffffff06", border: `1px solid ${best ? T.gold + "33" : T.line}` }}>
      <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
        <span style={{ fontFamily: T.fontD, fontSize: big ? 28 : 21, fontWeight: 800, lineHeight: 1, color: best ? T.goldLight : T.dim }}>{best ? d.v : "+"}</span>
        {best && d.u && <span style={{ fontSize: 11.5, color: T.muted }}>{d.u}</span>}
        {best && test.wod && <span style={{ fontSize: 10, fontWeight: 800, color: best.rx ? T.goldLight : T.muted, marginLeft: 4 }}>{best.rx ? "RX" : "SC"}</span>}
      </div>
      <div style={{ fontSize: 11, color: T.dim, marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {best ? (pace?.text || `${fmtDate(best.date)}${tries > 1 ? ` · ${tries} essais` : ""}`) : est ? `≈ ${fmtNum(est)} kg estimé` : "Ajouter"}
      </div>
    </button>
  );
}

const Line = ({ k, v, sub }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13.5 }}>
    <span style={{ color: T.muted }}>{k}</span>
    <b style={{ color: T.goldLight }}>{v}</b>
    {sub && <span style={{ fontSize: 12, color: T.dim }}>{sub}</span>}
  </div>
);

// Courbe de progression de la variante la plus testée + gain depuis la première perf
function Trend({ test, log }) {
  const v = [...test.variants].sort((a, b) => entriesOf(log, test.id, b.key).length - entriesOf(log, test.id, a.key).length)[0];
  const es = entriesOf(log, test.id, v.key);
  if (es.length < 2) return null;
  const low = KINDS[v.kind].better === "low";
  const first = es[0].value, best = bestOf(log, test.id, v.key).value, last = es.at(-1).value;
  const gain = first ? (low ? (first - best) / first : (best - first) / first) * 100 : 0;
  const vals = es.map(e => e.value), min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const W = 300, H = 56;
  const pts = es.map((e, i) => [es.length === 1 ? W / 2 : i / (es.length - 1) * W, low ? 6 + (e.value - min) / span * (H - 12) : H - 6 - (e.value - min) / span * (H - 12)]);
  const diff = last - es.at(-2).value;
  const up = low ? diff < 0 : diff > 0;
  return (
    <div style={{ background: "#ffffff06", border: `1px solid ${T.line}`, borderRadius: 14, padding: "10px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap", fontSize: 12.5 }}>
        <span style={{ color: T.muted }}>Progression · {v.label}</span>
        <span>
          <b style={{ color: gain > 0 ? T.green : T.muted }}>{gain > 0 ? "+" : ""}{fmtNum(gain)} %</b>
          <span style={{ color: T.dim }}> depuis le {fmtDate(es[0].date)}</span>
        </span>
      </div>
      <svg viewBox={`-4 0 ${W + 8} ${H}`} width="100%" height={H} style={{ display: "block", marginTop: 6 }} aria-hidden="true">
        <polyline points={pts.map(p => p.join(",")).join(" ")} fill="none" stroke={T.gold} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4 : 2.6} fill={i === pts.length - 1 ? T.goldLight : T.gold} />)}
      </svg>
      <div style={{ fontSize: 12, color: T.dim }}>
        Dernière : {fmtValue(v.kind, last, test)} ({diff === 0 ? "=" : up ? "mieux" : "moins bien"} que la précédente)
      </div>
    </div>
  );
}

// ─── Bilan : totaux, ratios, force relative, records récents ──────────────────
function Bilan({ log, sex, prs, wide, onSex, onBw, onOpen }) {
  const tot = totals(log, sex);
  const bw = tot.bw;
  const ref = id => liftSummary(log, id)?.ref || null;
  // Un total peut s'appuyer sur un 1RM estimé (à partir d'un 3RM, 5RM…) : on le signale
  const est = ids => (ids.some(id => !liftSummary(log, id)?.real) ? " · inclut des 1RM estimés" : "");
  const tiles = [
    ["Total powerlifting", tot.pl && `${fmtNum(tot.pl)} kg`, `Squat + couché + soulevé${tot.pl ? est(["back_squat", "bench", "deadlift"]) : ""}`],
    ["Score DOTS", tot.dots && fmtNum(tot.dots, 1), !bw ? "Poids de corps requis" : !sex ? "Choisis homme / femme" : "Total ajusté au poids"],
    ["CrossFit Total", tot.cf && `${fmtNum(tot.cf)} kg`, `Squat + strict press + soulevé${tot.cf ? est(["back_squat", "strict_press", "deadlift"]) : ""}`],
    ["Total haltéro", tot.oly && `${fmtNum(tot.oly)} kg`, `Snatch + Clean & Jerk${tot.oly ? est(["snatch", "clean_jerk"]) : ""}`],
  ];
  const ratios = RATIOS.map(r => ({ ...r, a1: ref(r.a), b1: ref(r.b) })).filter(r => r.a1 && r.b1);
  const rel = [["back_squat", "Back Squat"], ["front_squat", "Front Squat"], ["deadlift", "Soulevé de terre"], ["bench", "Développé couché"],
    ["strict_press", "Strict Press"], ["snatch", "Snatch"], ["clean_jerk", "Clean & Jerk"]].map(([id, n]) => [n, ref(id)]).filter(x => x[1]);
  const records = log.filter(e => prs.has(e.id)).sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 10);
  const bwHist = entriesOf(log, "bw", "kg");
  const lastBw = lastOf(log, "bw", "kg");

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={eyebrow}>Poids de corps</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 4 }}>
            <span style={{ fontFamily: T.fontD, fontSize: 28, fontWeight: 800, color: bw ? T.goldLight : T.dim }}>{bw ? fmtNum(bw) : "—"}</span>
            {bw && <span style={{ fontSize: 12, color: T.muted }}>kg · {fmtDate(lastBw.date)}{bwHist.length > 1 ? ` · ${bwHist[0].value < bw ? "+" : ""}${fmtNum(bw - bwHist[0].value)} kg depuis le ${fmtDate(bwHist[0].date)}` : ""}</span>}
          </div>
        </div>
        <button onClick={onBw} style={{ ...btnReset, height: 38, padding: "0 14px", borderRadius: 12, background: T.goldGrad, color: T.bg, fontWeight: 800, fontSize: 13.5 }}>
          {bw ? "Mettre à jour" : "Renseigner"}
        </button>
        <div style={{ display: "flex", gap: 4, background: "#ffffff0a", borderRadius: 12, padding: 3, width: "100%" }}>
          {[["M", "Homme"], ["F", "Femme"]].map(([k, l]) => (
            <button key={k} onClick={() => onSex(sex === k ? "" : k)} aria-pressed={sex === k}
              style={{ ...btnReset, flex: 1, height: 32, borderRadius: 9, fontSize: 13, fontWeight: 700, background: sex === k ? T.gold + "2a" : "transparent", color: sex === k ? T.goldLight : T.muted }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(4,1fr)" : "1fr 1fr", gap: 8 }}>
        {tiles.map(([l, v, sub]) => (
          <div key={l} style={card}>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 700 }}>{l}</div>
            <div style={{ fontFamily: T.fontD, fontSize: 26, fontWeight: 800, lineHeight: 1.1, marginTop: 4, color: v ? T.goldLight : T.dim }}>{v || "—"}</div>
            <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>{v && l === "Total powerlifting" && bw ? `× ${fmtNum(tot.pl / bw, 2)} le poids de corps${est(["back_squat", "bench", "deadlift"])}` : sub}</div>
          </div>
        ))}
      </div>

      {rel.length > 0 && bw && (
        <div style={card}>
          <div style={{ ...eyebrow, marginBottom: 8 }}>Force relative (1RM / poids de corps)</div>
          {rel.map(([n, v]) => {
            const r = v / bw;
            return (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <span style={{ fontSize: 13.5, width: 130, flexShrink: 0 }}>{n}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#ffffff0d", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, r / 3 * 100)}%`, height: "100%", background: T.goldGrad }} />
                </div>
                <b style={{ fontSize: 13.5, color: T.goldLight, width: 48, textAlign: "right" }}>× {fmtNum(r, 2)}</b>
              </div>
            );
          })}
        </div>
      )}

      <div style={card}>
        <div style={{ ...eyebrow, marginBottom: 4 }}>Ratios entre mouvements</div>
        <div style={{ fontSize: 12, color: T.dim, marginBottom: 8 }}>Repères indicatifs : un ratio bas montre le mouvement à travailler.</div>
        {ratios.length === 0
          ? <div style={{ fontSize: 13, color: T.muted }}>Renseigne au moins deux mouvements liés (ex. front squat et back squat) pour voir les ratios.</div>
          : ratios.map(r => {
            const p = r.a1 / r.b1 * 100, ok = p >= r.min && p <= r.max;
            return (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${T.line}` }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, flexShrink: 0, background: ok ? T.green : p < r.min ? T.red : T.gold }} />
                <span style={{ flex: 1, fontSize: 13.5, minWidth: 0 }}>{r.label}</span>
                <span style={{ fontSize: 11.5, color: T.dim, flexShrink: 0 }}>repère {r.min}–{r.max} %</span>
                <b style={{ fontSize: 14, width: 52, textAlign: "right", color: ok ? T.green : p < r.min ? T.red : T.goldLight }}>{fmtNum(p, 0)} %</b>
              </div>
            );
          })}
      </div>

      <div style={card}>
        <div style={{ ...eyebrow, marginBottom: 6 }}>Records récents</div>
        {records.length === 0
          ? <div style={{ fontSize: 13, color: T.muted }}>Tes records apparaîtront ici dès ta première perf.</div>
          : records.map(e => {
            const t = testById(e.test), v = variantOf(t, e.variant);
            return (
              <button key={e.id} onClick={() => onOpen(e)}
                style={{ ...btnReset, width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${T.line}`, textAlign: "left" }}>
                <span style={{ fontSize: 12, color: T.muted, width: 62, flexShrink: 0 }}>{fmtDate(e.date)}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t?.name} · <span style={{ color: T.muted }}>{v?.label}</span></span>
                <b style={{ fontSize: 14, color: T.goldLight }}>{fmtValue(v?.kind, e.value, t)}</b>
              </button>
            );
          })}
      </div>
    </div>
  );
}

// ─── Saisie d'une perf ────────────────────────────────────────────────────────
function EntrySheet({ test, variant, entry, log, onClose, onSubmit, onDelete }) {
  const k = variant.kind;
  const [val, setVal] = useState(entry ? rawValue(k, entry.value, test) : "");
  const [date, setDate] = useState(entry?.date || todayISO());
  const [note, setNote] = useState(entry?.note || "");
  const [rx, setRx] = useState(entry ? !!entry.rx : true);
  const [err, setErr] = useState("");
  const [sure, setSure] = useState(false);
  const best = bestOf(log.filter(e => e.id !== entry?.id), test.id, variant.key);
  const parsed = parseValue(k, val, test);
  const numeric = !["time", "amrap"].includes(k);

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    if (!(parsed > 0)) { setErr(k === "time" ? "Temps invalide. Exemple : 3:45 ou 1:02:30." : k === "amrap" ? "Score invalide. Exemple : 18+7 (tours + reps)." : "Valeur invalide."); return; }
    if (!date) { setErr("Choisis une date."); return; }
    onSubmit({ id: entry?.id || newId(), test: test.id, variant: variant.key, value: Math.round(parsed * 100) / 100, date, note: note.trim(), ...(test.wod ? { rx } : {}) }, !entry);
  };
  const input = { width: "100%", height: 48, borderRadius: 14, border: `1px solid ${T.line2}`, background: "#ffffff08", color: "#F5F0E8", fontSize: 16, padding: "0 14px", fontFamily: T.font, outline: "none" };
  const extra = parsed > 0 && (variant.reps > 1 ? `≈ ${fmtNum(Math.round(parsed * (1 + Math.min(variant.reps, 12) / 30) * 2) / 2)} kg de 1RM estimé` : paceInfo(test, variant, parsed)?.text);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#000000b3", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div role="dialog" aria-modal="true" aria-label={`${test.name} ${variant.label}`} onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", background: "#111", borderTop: `1px solid ${T.line2}`, borderRadius: "24px 24px 0 0",
          padding: "18px 18px calc(18px + env(safe-area-inset-bottom))", fontFamily: T.font, color: "#F5F0E8" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "#ffffff22", margin: "0 auto 14px" }} />
        <div style={eyebrow}>{entry ? "Modifier la perf" : "Nouvelle perf"}</div>
        <div style={{ fontFamily: T.fontD, fontSize: 26, fontWeight: 800, marginTop: 2 }}>{test.name} · {variant.label}</div>
        {test.desc && <div style={{ fontSize: 13, color: T.muted, marginTop: 4, lineHeight: 1.45 }}>{test.desc}</div>}
        {best && <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>Record actuel : <b style={{ color: T.goldLight }}>{fmtValue(k, best.value, test)}</b> ({fmtDate(best.date)})</div>}

        <label style={{ display: "block", fontSize: 12.5, color: T.muted, margin: "16px 0 6px" }}>
          {k === "time" ? "Temps (min:s)" : k === "amrap" ? "Score (tours + reps)" : `Résultat (${KINDS[k].unit})`}
        </label>
        <input autoFocus value={val} onChange={e => { setVal(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && save()}
          inputMode={numeric ? "decimal" : k === "time" ? "text" : "text"} placeholder={KINDS[k].placeholder} style={{ ...input, fontSize: 22, fontWeight: 800, textAlign: "center" }} />
        {extra && <div style={{ fontSize: 12.5, color: T.goldLight, marginTop: 6, textAlign: "center" }}>{extra}</div>}
        {err && <div role="alert" style={{ fontSize: 13, color: T.red, marginTop: 6 }}>{err}</div>}

        <div style={{ display: "grid", gridTemplateColumns: test.wod ? "1fr 1fr" : "1fr", gap: 10, marginTop: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12.5, color: T.muted, marginBottom: 6 }}>Date</label>
            <input type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} style={{ ...input, colorScheme: "dark" }} />
          </div>
          {test.wod && (
            <div>
              <label style={{ display: "block", fontSize: 12.5, color: T.muted, marginBottom: 6 }}>Version</label>
              <div style={{ display: "flex", gap: 4, background: "#ffffff0a", borderRadius: 14, padding: 3, height: 48 }}>
                {[[true, "RX"], [false, "Scaled"]].map(([b, l]) => (
                  <button key={l} onClick={() => setRx(b)} aria-pressed={rx === b}
                    style={{ ...btnReset, flex: 1, borderRadius: 11, fontWeight: 800, fontSize: 13.5, background: rx === b ? T.gold + "2a" : "transparent", color: rx === b ? T.goldLight : T.muted }}>{l}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <label style={{ display: "block", fontSize: 12.5, color: T.muted, margin: "12px 0 6px" }}>Note (facultatif)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder={test.wod ? "Charges utilisées, adaptations…" : "Conditions, ressenti…"} style={input} maxLength={140} />

        <button onClick={save} style={{ ...btnReset, width: "100%", height: 52, borderRadius: 16, marginTop: 18, background: T.goldGrad, color: T.bg, fontWeight: 800, fontSize: 15.5 }}>
          {entry ? "Enregistrer" : "Ajouter la perf"}
        </button>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={onClose} style={{ ...btnReset, flex: 1, height: 44, borderRadius: 14, border: `1px solid ${T.line2}`, color: "#ccc", fontWeight: 700 }}>Annuler</button>
          {entry && (
            <button onClick={() => (sure ? onDelete(entry.id) : setSure(true))}
              style={{ ...btnReset, flex: 1, height: 44, borderRadius: 14, border: `1px solid ${T.red}55`, color: T.red, fontWeight: 700, background: sure ? T.red + "1a" : "transparent" }}>
              {sure ? "Confirmer la suppression" : "Supprimer"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
