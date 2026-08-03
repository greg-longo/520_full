# Screenshots still needed on the CodeGrade page

Ten slots, each marked on the page with an amber dashed box saying
**"Screenshot needed — <slug>"**. Replace each `<div class="shot">…</div>` with:

```html
<img src="img/<slug>.png" alt="<describe what it shows>">
```

Put the files in `site/codegrade/img/`. The test suite counts these
placeholders, so `test_cgpage.js` will fail once you start filling them in -
update the `WANTED` list in that file as you go, and it stays an accurate record
of what is outstanding.

| slug | what to capture | where it was in the old docs |
|---|---|---|
| `errors-tab` | The Errors tab, on a run where the expected `Q1` was never defined | "What to do if my code doesn't work", §2 |
| `crash-zero` | A rubric where the file crashed and every question scored zero | same doc, the IMPORTANT box |
| `difference-tab` | The Difference tab, expected value beside submitted value | same doc, §3 |
| `brightspace-link` | The assignment link in Brightspace that opens CodeGrade | FAQ, "How do I log into CodeGrade?" |
| `upload-icon` | The upload area in CodeGrade you drag a file onto | FAQ, "An easy way to submit" |
| `windows-find` | File Explorer searching `*.ipynb`, and the drag into CodeGrade (**this stands in for 2 images in the original**) | FAQ, "For PCs" |
| `mac-find` | Finder or Spotlight search for the notebook filename | FAQ, "For Macs" |
| `input-tab-no-arg` | The Input tab showing a function called with **no** argument | FAQ, functions section |
| `input-tab-arg` | The Input tab showing a function called **with** an argument | FAQ, functions section |
| `check-questions` | A rubric showing `Q1check` / `Q4check` rows | FAQ, last bullet |

**The two Input tab shots are the ones worth taking care over.** Arguments are
the least intuitive thing in the FAQ, and that pair is the only place the reader
can see that CodeGrade tells you the answer if you look.

## What no longer needs a screenshot

Eleven code examples from the original docs are now copyable text on the page -
the good/bad print pairs, the function-call pairs, the indentation example and
the practice answer. Four of those existed only to teach the print rule, which
the checker now enforces directly, so the page states it once instead of
illustrating it four times.
