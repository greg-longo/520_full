/**
 * DTSC 520 - pre-submission check for CodeGrade.
 *
 * Reads a .ipynb and reports the things that make CodeGrade mark correct work
 * as wrong. It runs ENTIRELY in the browser: a notebook is JSON, so the file is
 * parsed where it sits and never leaves the machine. There is no upload and no
 * server, which is the only version of this that is safe to offer.
 *
 * WHAT IT IS AND IS NOT. This does not check whether the answers are right -
 * nothing here can know that. It checks the mechanical rules that cause a whole
 * submission to score zero while every value in it is correct, which is by a
 * wide margin the most common support question on this course.
 *
 * FALSE POSITIVES ARE THE FAILURE MODE. A checker that flags clean work gets
 * ignored, and then it is worse than nothing because a student stops reading
 * it. So:
 *   - comments and string literals are stripped before any pattern runs, or
 *     `print("don't print")` in a comment would be reported as a print call;
 *   - findings are graded `stop` / `check` / `note`, and only `stop` means the
 *     submission will actually lose marks;
 *   - anything the checker is unsure about is a `note`, never a `stop`.
 *
 * Exposed as window.CGCheck so the page and the tests share one code path.
 */
(function () {
  "use strict";

  /**
   * Remove comments and string literals, replacing them with spaces of equal
   * length so that reported line and column numbers still line up with what the
   * student sees in Jupyter.
   *
   * This is a scanner, not a Python parser. It handles the cases that actually
   * occur in a student notebook: single and double quotes, triple quotes,
   * escapes, and `#` comments. It does not handle f-string nesting, which
   * cannot produce a false `print(` anyway.
   */
  function strip(src) {
    var out = "", i = 0, n = src.length;
    while (i < n) {
      var c = src[i];
      // comment: to end of line
      if (c === "#") {
        while (i < n && src[i] !== "\n") { out += " "; i++; }
        continue;
      }
      // string literal
      if (c === '"' || c === "'") {
        var triple = src.substr(i, 3);
        var delim = (triple === '"""' || triple === "'''") ? triple : c;
        out += " ".repeat(delim.length);
        i += delim.length;
        while (i < n) {
          if (src[i] === "\\") {                 // escape: skip the pair
            out += (src[i] === "\n" ? "\n" : " ") + (src[i + 1] === "\n" ? "\n" : " ");
            i += 2; continue;
          }
          if (src.substr(i, delim.length) === delim) {
            out += " ".repeat(delim.length); i += delim.length; break;
          }
          out += (src[i] === "\n" ? "\n" : " ");
          i++;
        }
        continue;
      }
      out += c;
      i++;
    }
    return out;
  }

  function cellSource(cell) {
    var s = cell.source;
    return Array.isArray(s) ? s.join("") : (s || "");
  }

  /** Lines that are at module level - no leading whitespace. */
  function topLevelLines(stripped) {
    return stripped.split("\n").map(function (line, idx) {
      return { n: idx + 1, text: line, top: /^\S/.test(line) };
    });
  }

  // --------------------------------------------------------------- the checks
  var CHECKS = [

    /* THE ONE. CodeGrade runs your file and then calls your objects itself; a
       print left behind writes into the output it is about to grade. */
    function prints(cells, add) {
      cells.forEach(function (c) {
        topLevelLines(c.stripped).forEach(function (L) {
          var m = L.text.match(/\bprint\s*\(/);
          if (m) add("stop", "print-statement",
            "print() on line " + L.n + " of cell " + c.index,
            c.index, L.n, c.lines[L.n - 1]);
        });
      });
    },

    /* Calling your own answer. `Q1()` at the bottom of the cell you wrote it
       in is how everyone tests their work, and leaving it in is the second
       most common cause of a zero. */
    function ownCalls(cells, add) {
      cells.forEach(function (c) {
        topLevelLines(c.stripped).forEach(function (L) {
          var m = L.text.match(/^\s*(Q\d+\w*)\s*\(/);
          if (m) add("stop", "calls-own-answer",
            "calls " + m[1] + "() on line " + L.n + " of cell " + c.index,
            c.index, L.n, c.lines[L.n - 1]);
        });
      });
    },

    /* A bare name or expression on its own line displays in Jupyter, which is
       the same problem as print() wearing different clothes. Deliberately does
       NOT fire on assignments, calls already caught above, or keywords. */
    function bareDisplay(cells, add) {
      var KW = /^(import|from|def|class|return|pass|break|continue|raise|del|global|assert|with|if|elif|else|for|while|try|except|finally|print|lambda|yield|async|await)\b/;
      cells.forEach(function (c) {
        topLevelLines(c.stripped).forEach(function (L) {
          var t = L.text.trim();
          if (!t || L.text[0] === " " || L.text[0] === "\t") return;
          if (KW.test(t)) return;
          if (t.indexOf("=") !== -1 && !/[=!<>]=/.test(t.split("=")[0] + "=")) return;  // assignment
          if (/^\w[\w.]*\s*\(/.test(t)) return;   // a call - handled elsewhere
          if (/^[A-Za-z_][\w.]*(\[[^\]]*\])?$/.test(t)) {
            add("check", "bare-expression",
              "line " + L.n + " of cell " + c.index + " is just `" + t +
              "`, which displays it as output",
              c.index, L.n, c.lines[L.n - 1]);
          }
        });
      });
    },

    /* Saved output that is an exception. "If some of your values are correct
       but your file crashes, you will earn zero points." */
    function savedErrors(cells, add) {
      cells.forEach(function (c) {
        (c.raw.outputs || []).forEach(function (o) {
          if (o.output_type === "error") {
            add("stop", "cell-errored",
              "cell " + c.index + " last ran with a " + (o.ename || "an error") +
              " - a crash scores zero even where the values are right",
              c.index, null, (o.evalue || "").slice(0, 120));
          }
        });
      });
    },

    /* Cells that were never run, or run out of order. This is the mechanic
       behind the random-seed advice: values depend on the order things ran in,
       and the order you see is not necessarily the order CodeGrade will use. */
    function executionOrder(cells, add) {
      var counts = cells.map(function (c) { return c.raw.execution_count; });
      var unrun = cells.filter(function (c) { return c.raw.execution_count == null; });
      if (unrun.length) {
        add("check", "cell-never-run",
          unrun.length + " code cell" + (unrun.length === 1 ? " was" : "s were") +
          " never run. CodeGrade runs your file top to bottom - a cell you " +
          "never executed may not do what you think.",
          unrun[0].index, null, null);
      }
      var ran = counts.filter(function (v) { return v != null; });
      var ordered = ran.every(function (v, i) { return i === 0 || ran[i - 1] < v; });
      if (ran.length > 1 && !ordered) {
        add("check", "out-of-order",
          "cells were run out of order (execution counts go " + ran.join(", ") +
          "). Kernel → Restart & Run All, then check your answers still look right.",
          null, null, null);
      }
    },

    /* Informational: what the file imports. Some assignments forbid libraries
       outright, and the checker cannot know which - so this never says STOP. */
    function imports(cells, add) {
      var found = {};
      cells.forEach(function (c) {
        topLevelLines(c.stripped).forEach(function (L) {
          var m = L.text.match(/^\s*(?:import\s+([\w.]+)|from\s+([\w.]+)\s+import)/);
          if (m) found[(m[1] || m[2]).split(".")[0]] = true;
        });
      });
      var names = Object.keys(found);
      if (names.length) {
        add("note", "imports",
          "imports " + names.join(", ") + ". Check the assignment - some say to " +
          "load no libraries at all.", null, null, null);
      }
    },

    /* Leftover scaffolding. Not fatal, but "delete all extraneous cells" is in
       the FAQ for a reason: an empty or stray cell is usually the remains of
       something that should have been removed. */
    function emptyCells(cells, add) {
      var empties = cells.filter(function (c) { return !c.text.trim(); });
      if (empties.length) {
        add("note", "empty-cells",
          empties.length + " empty code cell" + (empties.length === 1 ? "" : "s") +
          ". Harmless, but worth deleting before you submit.",
          empties[0].index, null, null);
      }
    },
  ];

  // ------------------------------------------------------------------- driver
  function check(text, filename) {
    var nb;
    try { nb = JSON.parse(text); }
    catch (e) {
      return { ok: false, fatal:
        "This file is not valid notebook JSON, so CodeGrade cannot run it at " +
        "all. Re-save it from Jupyter rather than editing it in a text editor." };
    }
    if (!nb.cells || !Array.isArray(nb.cells)) {
      return { ok: false, fatal:
        "This does not look like a Jupyter notebook - there are no cells in it. " +
        "Make sure you are submitting the .ipynb file." };
    }

    /* A TEACHING notebook is not a submission, and the rules are opposite: the
       course notebooks print constantly, on purpose. Running one through here
       produces 141 red flags and a frightened student, so recognize them and
       say what is going on instead of grading them.

       Detected by the `dtsc520` metadata the build stamps in, or by the course
       cell tags - not by filename, which a student may well have changed. */
    var courseTags = 0;
    nb.cells.forEach(function (c) {
      var t = (c.metadata || {}).tags || [];
      if (t.indexOf("exercise") !== -1 || t.indexOf("debrief") !== -1 ||
          t.indexOf("predict") !== -1 || t.indexOf("vocab") !== -1) courseTags++;
    });
    if ((nb.metadata && nb.metadata.dtsc520) || courseTags >= 5) {
      return { ok: false, teaching: true, fatal:
        "This is one of the course TEACHING notebooks, not an assignment. Those " +
        "are full of print() calls on purpose - that is how they teach - so " +
        "checking one here would report hundreds of problems that are not " +
        "problems. Open the notebook you wrote for the assignment instead." };
    }

    var cells = [];
    nb.cells.forEach(function (raw, i) {
      if (raw.cell_type !== "code") return;
      var text = cellSource(raw);
      cells.push({ index: cells.length + 1, raw: raw, text: text,
                   stripped: strip(text), lines: text.split("\n") });
    });

    var findings = [];
    function add(level, id, message, cell, line, snippet) {
      findings.push({ level: level, id: id, message: message,
                      cell: cell, line: line, snippet: snippet });
    }
    CHECKS.forEach(function (fn) { fn(cells, add); });

    // filename, which the file picker gives us for free
    if (filename) {
      if (!/\.ipynb$/i.test(filename)) {
        add("stop", "wrong-extension",
          "\"" + filename + "\" is not a .ipynb file. CodeGrade expects the " +
          "notebook itself, not an export of it.", null, null, null);
      } else if (/^untitled/i.test(filename)) {
        add("check", "default-filename",
          "the file is still called \"" + filename + "\". Assignments name the " +
          "file they want - check the instructions.", null, null, null);
      }
    }

    var order = { stop: 0, check: 1, note: 2 };
    findings.sort(function (a, b) { return order[a.level] - order[b.level]; });

    return {
      ok: true,
      filename: filename || null,
      findings: findings,
      stops: findings.filter(function (f) { return f.level === "stop"; }).length,
      checks: findings.filter(function (f) { return f.level === "check"; }).length,
      notes: findings.filter(function (f) { return f.level === "note"; }).length,
      stats: {
        codeCells: cells.length,
        markdownCells: nb.cells.length - cells.length,
        lines: cells.reduce(function (s, c) { return s + c.lines.length; }, 0),
      }
    };
  }

  window.CGCheck = { check: check, strip: strip };
})();
