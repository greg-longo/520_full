# Git & GitHub Workflow — DTSC 520 Site

How we work on this repo. Read it once end to end, then keep it open for the first few weeks.

You've seen `clone`, `add`, `commit`, and `push` before. The new part here is **branches and pull requests**, which is how teams keep a live website from breaking while someone is mid-edit.

---

## The one-paragraph version

`main` is the live website. You never commit to it. Every piece of work starts as a **branch** off `main`, gets committed and pushed to GitHub, and becomes a **pull request** that Greg reviews. When he merges it, it goes live. Nothing you push publishes anything until that merge happens — which means you can push freely and often without any risk of breaking the site for students.

---

## 0. One-time setup

### Clone the repo

Pick a normal folder on your computer — Documents, or a `code` folder. **Do not put it in Google Drive, Dropbox, or OneDrive.** Cloud-sync folders corrupt git repositories; this has already happened once on this project.

```bash
cd ~/Documents
git clone https://github.com/greg-longo/520_full.git
cd 520_full
```

### Tell git who you are

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@eastern.edu"
```

### Confirm where you are

```bash
git status
```

You should see `On branch main` and `nothing to commit, working tree clean`. If you see anything else, stop and ask.

### Run the site locally

The site is static, but it must be served over HTTP (not opened as a `file://` path) or sign-in breaks.

**Serve from the folder *above* the clone, not from inside it.** Every page links its CSS and JS with absolute paths like `/520_full/assets/shell.js` (236 of them), because that's the path GitHub Pages serves from. If you serve from inside the repo, every one of those 404s and the site loads unstyled and broken.

```bash
cd ~/Documents        # the folder that CONTAINS 520_full
python -m http.server 8000
```

Then open **http://localhost:8000/520_full/** in your browser. Leave that terminal running; open a second terminal window for git commands.

Port 8000 specifically — Google sign-in is only authorized for `http://localhost:8000`. On another port you'll be stuck signed out, which means no credits, no achievements, and an empty desk.

---

## 1. Starting a piece of work

Always start from an up-to-date `main`.

```bash
git checkout main
git pull
git checkout -b desk/tray-empty-state
```

`git checkout -b` creates a new branch and switches to it in one step.

**Branch naming.** Lowercase, hyphens, prefix by area:

- `desk/…` — workspace, store, sprites (e.g. `desk/mobile-drag-fix`)
- `rewards/…` — achievements, toasts, HUD pills (e.g. `rewards/locked-badge-hints`)
- `fix/…` — a bug that doesn't fit either (e.g. `fix/focus-ring-store-cards`)

**One branch = one idea.** If you're fixing a mobile bug and you notice the store copy is bad, that's a second branch. Mixed-up branches are painful to review and painful to undo.

---

## 2. While you work

Commit small and often. A commit is a save point you can return to, not a milestone — you do not need to finish the feature first.

```bash
git status                    # what changed
git diff                      # exactly what changed, line by line
git add workspace.html        # stage the specific files you meant to change
git commit -m "Show a friendly empty state in the item tray"
```

Prefer `git add <file>` over `git add -A` so you never sweep up a file you didn't mean to.

**Commit messages:** imperative mood, one line, says what changed and why it matters.

- Good: `Fix drag offset on touch devices so items land where you drop them`
- Good: `Add keyboard focus ring to store cards`
- Bad: `updates`, `fixed stuff`, `asdf`

Push whenever you stop for a break, and at minimum at the end of every work session. Pushing is a backup.

```bash
git push -u origin desk/tray-empty-state    # first push of a new branch
git push                                    # every push after that
```

---

## 3. Opening a pull request

When the work is ready for review, go to https://github.com/greg-longo/520_full. GitHub will show a banner for your recently pushed branch with a **Compare & pull request** button. Base branch is `main`, compare branch is yours.

Write the description like this:

```
## What
One or two sentences on what changed.

## Why
The problem this solves, or the thing that felt bad.

## How I checked it
- [ ] Chrome desktop
- [ ] Safari or Firefox
- [ ] Phone / narrow window
- [ ] Keyboard only (Tab, arrows, Enter, Esc)
- [ ] Signed out
- [ ] Brand-new student with zero items owned
- [ ] Reduced motion on (macOS: System Settings → Accessibility → Display → Reduce motion)

## Screenshots
Before and after, if it's visual.

## Notes for Greg
Anything you're unsure about, or any Code.gs change that needs deploying.
```

That checklist is the actual bar for this project. Fill it in honestly — "I didn't test Safari" is a fine thing to write, and much better than a surprise later.

Then tag Greg as a reviewer and move on to your next branch. **Do not merge your own pull request**, even if GitHub offers the button.

---

## 4. Responding to review

Greg will leave comments. To address them, just commit more work to the same branch and push — the pull request updates automatically. No new PR needed.

```bash
# still on desk/tray-empty-state
git add workspace.html
git commit -m "Use the maroon accent for the tray hint per review"
git push
```

When he merges it, clean up:

```bash
git checkout main
git pull
git branch -d desk/tray-empty-state           # delete your local copy
git push origin --delete desk/tray-empty-state # delete the GitHub copy
```

---

## 5. Keeping your branch fresh

If Greg merges other work while your branch is open, pull those changes into your branch so you're building on current code:

```bash
git checkout main
git pull
git checkout desk/tray-empty-state
git merge main
```

If git reports a **merge conflict**, don't panic and don't guess. Open the conflicted file, find the `<<<<<<<` / `=======` / `>>>>>>>` markers, and decide what the file should actually say. If it isn't obvious, message Greg — a bad conflict resolution silently deletes someone's work. You can always back out with `git merge --abort`.

---

## 6. Rules specific to this repo

1. **Never commit to `main`.** Branch protection should block it; the rule stands regardless.
2. **Never `git push --force`.** There is no situation in this project that requires it.
3. **Never clone into a cloud-synced folder** (Drive, Dropbox, iCloud, OneDrive). It corrupts git objects.
4. **Never commit secrets.** No API keys, no student data, no exported Sheet contents. If you see something that looks like a credential, tell Greg rather than committing around it.
5. **No build step.** Plain HTML, CSS, and vanilla JS only. No npm dependencies, no framework, no bundler. Don't commit `node_modules/`.
6. **`_archive/` is retired code.** Read it if you're curious, never edit or re-link it.
7. **Backend changes need Greg.** Edit `auth/Code.gs` in your branch if a feature requires it, but call it out in the PR — he has to paste and deploy it by hand, and the site won't reflect it until he does.
8. **New sprites need attribution.** Any new art pack must be logged in `assets/desk/CREDIT.txt` with its license.
9. **Big art files:** compress PNGs before committing (512px is the house size for desk items). Ask before adding anything over a few hundred KB.

---

## 7. When something goes wrong

Nothing here is unrecoverable as long as you haven't force-pushed. Common fixes:

| Situation | Command |
|---|---|
| Undo changes to a file you haven't committed | `git restore <file>` |
| Unstage a file you added by mistake | `git restore --staged <file>` |
| Fix the message of the commit you just made | `git commit --amend -m "Better message"` |
| Undo the last commit but keep your edits | `git reset --soft HEAD~1` |
| See what you've done recently | `git log --oneline -10` |
| See what branch you're on | `git status` |
| Started work on `main` by accident (not yet committed) | `git stash` → `git checkout -b my-branch` → `git stash pop` |

If you're stuck, **stop before you type another command** and send Greg the output of `git status` and `git log --oneline -5`. Digging deeper usually makes it worse; the two commands above tell him almost everything he needs.

---

## 8. Quick reference

```bash
git checkout main && git pull        # get current
git checkout -b area/short-name      # start work
git status                           # what changed
git diff                             # see the changes
git add <file>                       # stage
git commit -m "message"              # save point
git push -u origin area/short-name   # first push
git push                             # later pushes
# → open the pull request on github.com
```
