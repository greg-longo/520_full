# Contributing to the DTSC 520 site

Thanks for helping. This page covers what is safe to edit here, the house style,
and how a change gets from your branch to students. Read it once before your
first pull request.

**The live site is the `main` branch.** GitHub Pages republishes within a minute
or two of every merge, so nothing goes to `main` except through a reviewed pull
request.

## The loop

```
git switch main
git pull
git switch -c fix/short-description      # one branch per piece of work
# ...edit, then...
git add -A
git commit -m "Fix contrast on the Morning Brief landing page"
git push -u origin fix/short-description
```

Then open a pull request on GitHub. Keep each PR to one topic (one sim, one
quiz, one bug); small PRs get reviewed and merged the same day. Delete the
branch after it is merged.

To preview locally, serve the folder *above* this repo under the name
`520_full`, because pages load their shared files from `/520_full/...`:

```
mkdir -p /tmp/preview && ln -sfn "$PWD" /tmp/preview/520_full
cd /tmp/preview && python3 -m http.server 8000
# open http://localhost:8000/520_full/index.html
```

Pages that need sign-in show a gate; for local testing, run this once in the
browser console, then reload:
`localStorage.setItem('dtsc520_auth', JSON.stringify({email:'you@eastern.edu', name:'You', idToken:'x', exp: 4102444800000}))`

## What you can edit here, and what you can't

This repo holds only the published website. The teaching notebooks and the
scripts that build pages from them live in a private folder, on purpose: the
notebooks contain worked solutions and this repo is public.

**Safe to edit directly:**

- Every simulation under `sims/`, and `modules/module6/branch_crisis_sim.html`
- Quizzes: `modules/moduleN/quiz.html`
- The Module 0 and Module 6 pages (`modules/module0/index.html`, `modules/module6/index.html`)
- The capstone (`capstone/`), achievements, and the tool pages (`glossary/`, `cohort/`, `help/`, `codegrade/`, `environment/`, `search/`)
- Shared scripts and styles in `assets/`, **except** `assets/module-layout.css` (see below)

**Do not edit here; your change will be overwritten:**

| File | Why | Instead |
|---|---|---|
| `modules/module1/index.html` to `modules/module5/index.html` | Generated from the teaching notebooks on every rebuild | Describe the change in an issue or PR comment and it will be made in the notebook source |
| `assets/module-layout.css` | Inlined into the generated module pages at build time | Same: open an issue |
| `notebooks/*.ipynb` | Published copies of private source notebooks | Same |
| `search-index.json`, `assets/glossary-data.js` | Generated | Leave them alone |

## House style

These rules come from real corrections. Please follow them in anything students read.

- **No em dashes** (and no ` - ` used as a clause dash). Use a period, comma, colon or parentheses.
- **American spelling**: color, analyze, behavior.
- **Concise and direct.** No closing summary paragraph that restates what was just said.
- **Story continuity.** The teaching notebooks and capstone use the Institutional Research cohort and **Amy Lee**. The sims keep their own worlds (StatDeck Analytics, the St. Davids Eagles, Jonah Reyes, ARIA). Do not reuse a first or last name across worlds, and avoid names that AI tools produce by default.
- **Facts get checked.** If a page states a number, it should be computed from the data the page uses.

## Quality bar

- **Accessibility (WCAG 2.1 AA).** Text contrast at least 4.5:1 in *both* the dark and the light theme (most sims have a light theme in Display settings). Every animation respects `prefers-reduced-motion`. Every input is labeled and everything works with the keyboard alone.
- **Quizzes and decision sims**: the correct option must not be the longest one, and correct answers should be spread across positions. Each quiz question needs `feedbackCorrect` and `feedbackWrong`.
- **No build step.** Plain HTML, CSS and JavaScript; in-browser Python is Pyodide 0.26.4. Do not add a bundler or framework.
- **Attribution footer** on every tool.

## Never commit

- Passwords, API keys or tokens (the history is public and permanent)
- Student data of any kind
- Anything named `*_MASTER*`, solution or answer-key files (`.gitignore` blocks most of these; do not force-add around it)

## Questions

Open an issue, or ask in the PR. If you are unsure whether a file is generated, ask before editing it.
