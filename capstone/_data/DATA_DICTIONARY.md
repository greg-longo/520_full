# Capstone Cohort — Data Dictionary

**Synthetic, fictional teaching data. No real student records.** Generated reproducibly (seed 520) by `cohort_generator.py`; frozen for embedding in `cohort_frozen.py`; findings re-validated by `verify_findings.py`.

100 students, plus 2 intentional duplicate rows = **102 raw rows, 14 columns.**

## Columns

| Column | Type | Notes |
|---|---|---|
| `student_id` | int | 1001–1100 (unique; 2 IDs repeat as the duplicate rows) |
| `hs_gpa` | float | High-school GPA, 1.5–4.0 |
| `hs_clubs` | int | Number of HS clubs, 0–6 |
| `hs_sports` | int (0/1) | Played a HS sport |
| `hs_attendance` | float | HS attendance rate, ~0.7–1.0 (**one bad value = 1.4**, an impossible data-entry error) |
| `hs_pop_density` | int | **BIAS FEATURE** — population density of HS area (people/sq mi). A geographic SES proxy. |
| `need_based_aid` | int (0/1) | **BIAS FEATURE** — received need-based financial aid. A socioeconomic signal. |
| `ug_gpa` | float | Undergraduate GPA, 1.5–4.0 |
| `internships` | int | Undergrad internships, 0–4 |
| `logins_per_week` | float | LMS logins/week (**~15% missing**, missing more for strugglers) |
| `time_on_task_hrs` | float | LMS hours/week (same missingness) |
| `submission_rate` | string | Assignment submission rate, stored as a **percent string like `"84%"`** (object dtype — needs cleaning). Empty `""` where missing. |
| `course_score` | float | Continuous outcome, 40–100 |
| `success` | int (0/1) | Binary outcome (top ~60%). The label models predict. |

## Intentional data-quality quirks (the stages discover these)

1. **Missingness correlated with outcome** — LMS columns (`logins_per_week`, `time_on_task_hrs`, `submission_rate`) are missing for ~15 students, and ~73% of those are strugglers. Naive row-deletion biases the engagement finding. *(M4 cleaning; seeds finding F.)*
2. **Dtype problem** — `submission_rate` is a `"84%"` string, so the column is object dtype; can't do math until cleaned. *(M4.)*
3. **Duplicates** — 2 exact duplicate rows from an "export glitch." *(M4.)*
4. **Impossible value** — one `hs_attendance = 1.4` (>1.0). *(M4.)*

## The three findings (verified to hold after a standard clean)

- **A — Early LMS engagement is the strongest signal.** An engagement index (logins + time-on-task + submission rate) correlates with `course_score` ~**0.65**, beating `ug_gpa` (~0.49). Engagement predicts the outcome better than prior grades.
- **B — HS extracurriculars wash out.** `hs_clubs` correlates ~**0.43** with the outcome on its own, but the partial correlation controlling for `hs_gpa` drops to ~**−0.03**. The apparent effect was a confound: good students join more clubs *and* do better; clubs add nothing once you account for GPA.
- **D — The bias features predict — and that's the trap.** Adding `hs_pop_density` + `need_based_aid` raises cross-validated model accuracy (~**0.84 → 0.85+**). They carry real signal because they proxy socioeconomic status, which has a true effect. That is exactly why excluding them is a deliberate, costly judgment call — not a free one. The model gets "better" by encoding disadvantage.

## How the model works (for stage authoring)

Three unobserved latents drive everything: `capability`, `conscientiousness`, `ses` (socioeconomic status).
- Engagement is mostly conscientiousness with low noise → best observed predictor (finding A).
- Clubs are driven *only* by `hs_gpa` → no independent path to the outcome (finding B).
- `ses` has a real outcome effect, and the bias features proxy `ses` → they predict (finding D).

Expansion findings C/E/F (work experience, internships, missingness) can be added later from the same latents without breaking A/B/D.
