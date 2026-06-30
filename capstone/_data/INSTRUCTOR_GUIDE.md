# Capstone — Instructor Guide & Answer Key

**The Academic Success Report** · DTSC 520 Capstone · Eastern University

Internal reference. Do not distribute to students. Covers every decision and code task with the correct answer and the reasoning, plus access/admin notes. This guide grows as stages are built — **currently covers Stages 1–2** (the rest will be added as they ship).

---

## Access & admin

- **Where it lives:** `site/capstone/index.html` is the briefing-room hub (the six "clearance" lamps). `commission.html` is the actual capstone. The student reaches the commission only after all six lamps are lit.
- **Unlock rule:** a module's lamp lights only when **every sim in that module is complete** (read from `localStorage`). All six lit → the commission opens.
- **Instructor override:** on the hub, click **"Instructor access"** (bottom of page) and enter the passphrase **`eastern-cabinet-2026`**. This lights all six lamps immediately for demos, grading, or transfer students. (Note: this is client-side / honor-system on a static site — robust server-side gating comes when the Eastern auth backend ships.)
- **Mute / reduced motion:** sound toggle is bottom-left. Honors `prefers-reduced-motion` (typewriter and animations become instant).
- **Data:** a synthetic, fictional 102-row cohort (100 students + 2 intentional duplicates). No real student records. Generated reproducibly; see `DATA_DICTIONARY.md`.

## Scoring & honors

- Decisions score: **good = 4 pts, partial/"warn" = 2 pts, wrong = 0 pts.**
- Code tasks are pass/fail (assert-graded) and gate progression.
- Final honors tiers (at the finale, once built) reward **judgment + code**, not just completion: **Cabinet Commendation / Approved with Revisions / Sent Back for Review.** Taking the biased-feature shortcut should cost the top tier.
- **Choice order is randomized every load** — there is no "always B." Use the answer *text* below, not a letter.

---

## STAGE 1 — Frame the Investigation (Module 1)

### Decision 1 · Scope — "How do you scope what this observational dataset can deliver?"
**Correct (4 pts):** *Promise associations and clearly actionable signals, but flag that causal claims need a controlled study or natural experiment.*
- **Why:** Observational data yields association, not causation. The honest deliverable scopes claims correctly.
- Partial (2): "report only features significant after controlling for everything" — controls help but don't equal cause; stated with false certainty.
- Wrong (0): "treat the model's strongest features as causal levers to fund" — prediction ≠ lever (foreshadows the extracurriculars confound).
- Wrong (0): "decline to make any claims / demand a randomized trial" — over-correction; most IR is observational and still useful.

### Code task · The fairness rule — complete `is_sensitive(name)`
**Correct solution:**
```python
def is_sensitive(name):
    return name in {"hs_pop_density", "need_based_aid"}
```
- **Why these two:** `hs_pop_density` is a **geographic proxy** for race/income; `need_based_aid` is a **direct socioeconomic** signal. Both let a model encode disadvantage as "risk." The other four (`ug_gpa`, `logins_per_week`, `internships`, `submission_rate`) are legitimate academic/behavioral features — excluding them would weaken an honest model.
- **In-sim hint:** "Make a set of the two sensitive names and return `name in` that set."
- The starter (`pass`) deliberately **fails** — students must write the rule.

### Decision 3 · Workflow — "What's the most serious problem with: load → join → compute → clean → model → report?"
*(This decision is NOT shuffled — the pipeline ordering needs to read in sequence.)*
**Correct (4 pts):** *Cleaning happens after joining — you'd merge six messy tables then untangle the combined mess, and metrics get computed on dirty data.*
- **Why:** Correct spine is **load → clean → join → compute → model & fairness → report.** Clean each table before joining; never compute metrics on uncleaned data.
- Partial (2): "no separate fairness step" — true and worth noting (models reconstruct sensitive signals from correlates), but the ordering flaw is the more immediate, results-poisoning problem.
- Wrong (0): "reporting should come earlier and repeat" — conclusions are reported once trustworthy.
- Wrong (0): "compute metrics before joining" — makes it worse; per-table metrics on dirty data are equally untrustworthy and the analysis needs the join.

---

## STAGE 2 — Assemble the Data (Module 2)

### Code task · complete `profile_cohort(table)` → `(n_records, n_on_aid, pct_on_aid)`
**Correct solution:**
```python
def profile_cohort(table):
    n_records = len(table)
    n_on_aid = 0
    for v in table['need_based_aid']:
        if v == 1:
            n_on_aid += 1
    pct_on_aid = round(100 * n_on_aid / n_records, 1)
    return (n_records, n_on_aid, pct_on_aid)
```
**Expected values (verified):** `n_records = 102`, `n_on_aid = 58`, `pct_on_aid = 56.9`.
- **Teaching point — why 102, not 100:** the raw extract still contains its **2 duplicate rows**. A student who deduplicates here (expecting 100) fails with the message: *"the raw extract still includes its duplicate rows — we clean later."* This reinforces the workflow order: don't clean ad hoc; clean at the cleaning stage.
- The starter (zeros + `# YOUR CODE HERE`) deliberately **fails** — real task, not click-to-win.

### Decision · First read — "What do the signs (102 rows, '84%' strings, blanks) tell you?"
**Correct (4 pts):** *These are exactly the issues for the dedicated cleaning step — note them and clean deliberately.*
- **Why:** Two extra rows = expected duplicates; "84%" = text-typed column; blanks = missing values. Catalog now, fix together at the cleaning stage.
- Partial (2): "quickly strip %, convert, drop dupes now" — right operations, wrong moment; ad hoc cleaning scatters steps and goes undocumented.
- Wrong (0): "data is corrupted, bounce it back to the source team" — this is normal, not corruption; stalls the project over routine cleaning.
- Wrong (0): "blanks are probably random, so drop those rows" — **dangerous**: missingness here is **not** random (engagement records go missing more for struggling students), so dropping rows would bias the engagement finding. Students confront this directly at the cleaning stage.

---

## The three findings the report builds toward

The capstone assembles a report that lands on three honest, slightly counter-intuitive findings (validated to hold in the synthetic data):

- **A — Early LMS engagement is the strongest signal.** Engagement (logins, time-on-task, submission rate) predicts course outcome better than prior GPA (~0.65 vs ~0.49).
- **B — HS extracurriculars wash out.** Clubs look predictive (~0.43) but the effect vanishes after controlling for HS GPA (~−0.03). A confound, not a cause.
- **D — The biased features predict — and that's the trap.** `hs_pop_density` + `need_based_aid` genuinely raise model accuracy, which is *why* excluding them is a real, costly choice. The model "improves" by encoding disadvantage.

*(C, E, F held as expansion findings — see `CAPSTONE_SPEC.md` §9.)*

---

## Stages 3–6 + Finale

*To be added to this guide as each stage is built.* Planned:
- **Stage 3 (Compute / NumPy):** vectorized engagement index — sets up finding A.
- **Stage 4 (Clean & Join / pandas):** the merge showpiece + handling the non-random missingness.
- **Stage 5 (Visualize / matplotlib):** the finding charts; the "honest axis" ethics beat.
- **Stage 6 (Ship / git):** versioning and the PR/report write-up.
- **Finale:** assemble the report, the final ethics judgment, certificate + honors tier.

---

*Prepared for DTSC 520 — Eastern University — Greg Longo*
