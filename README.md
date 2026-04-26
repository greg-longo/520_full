# DTSC 520 - Introduction to Data Science

An interactive course website for DTSC 520 at Eastern University's School of Mathematics and Computational Sciences. Built as a static site with no dependencies - just HTML, CSS, and JavaScript.

**Live site:** https://greg-longo.github.io/520_full/

---

## About

This site provides students with module content, quizzes, interactive Python sandboxes, and simulations covering the full DTSC 520 curriculum - from Python fundamentals and data wrangling to visualization and version control.

### Simulations

- **The Dirty Dataset** - Data cleaning role-play set in a sports analytics context (Module 4)
- **Python Field Training** - Hands-on Python fundamentals with real in-browser code execution (Module 2)
- **The Branch Crisis** - Git branching and merge conflict scenario (Module 6)
- **Debug the Pipeline** - Diagnose a broken pandas pipeline from live DataFrame output (Module 4)

---

## Running Locally

No build step required. Clone the repo and open `index.html` directly in your browser:

```bash
git clone https://github.com/greg-longo/520_full.git
cd 520_full
open index.html
```

Or serve it with Python for full functionality (recommended for the Python sandbox features):

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000 in your browser.

---

## Credits

Course content and module material created by **Jamie Andrews**.

Site design, simulations, and interactive tools created by **Greg Longo** with the assistance of [Claude Cowork](https://claude.ai) (Anthropic).

&copy; Eastern University. All rights reserved.
