# Screenshots on the CodeGrade page

**All ten are in** (August 3, 2026). Nothing outstanding.

| slug | shows |
|---|---|
| `errors-tab` | Errors tab: `NameError: name 'Q1' is not defined` |
| `crash-zero` | Rubric where the file crashed and every question scored 0 |
| `difference-tab` | Difference tab: expected 26, produced 20.5 |
| `brightspace-link` | The Brightspace assignment link (External Learning Tool) |
| `upload-icon` | The **Create submission** tile |
| `windows-find` | File Explorer searching `*.ipynb` on the C: drive |
| `mac-find` | The upload dialog's file search on a Mac |
| `input-tab-no-arg` | Input tab: `IntroPythonA2credit.Q2()` |
| `input-tab-arg` | Input tab: `FunctionsA1credit.Q4(5)` |
| `check-questions` | Rubric showing `Q1check` and `Q4check` rows |

Each is a `<figure>` with alt text and a caption that says what to look at.

## What the tests now enforce

`test_cgpage.js` asserts every image resolves, carries alt text over 40
characters, has a caption, is a real PNG rather than a HEIC with the wrong
extension, and is **at least 200x40** - the first `windows-find` file supplied
was a 41x41 folder icon, and a size floor is what catches that class of mistake.

## Two things worth knowing, neither blocking

**`difference-tab` is from an R assignment** (`Rscript msleep.R`). The tab, the
arrows and the numbers are right, and they match the original document's example
exactly, so it teaches the point. A Python student may find the command line
odd. Worth reshooting from a Python assignment one day.

**`mac-find` shows a search for `untitled.ipynb`** - the default filename the
checker warns about. Realistic, but if you reshoot it, searching for a properly
named file would model the habit the page is asking for.

## If you ever replace one

Drop the new file in `img/` with the same name. Mac screenshots default to HEIC
on some settings; the extension does not tell you the format, so check with
`file img/whatever.png` if a browser shows a broken image.
