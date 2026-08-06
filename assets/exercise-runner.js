/**
 * DTSC 520 - live exercise runner for module pages
 *
 * Turns the .exercise-block markup emitted by tools/notebook_to_site.py into
 * working CodeMirror editors that execute real Python via Pyodide.
 *
 * Include on any module page that has generated exercises:
 *
 *   <script src="/520_full/assets/exercise-runner.js" defer></script>
 *
 * The Pyodide loader is fetched on demand, so no <script> tag is needed and a
 * page that is only read never downloads it.
 *
 * Declare any packages the module needs on the <body>:
 *
 *   <body data-exercise-packages="numpy">        <!-- module 3 -->
 *
 * and any data files the exercises read:
 *
 *   <body data-exercise-data="data/cohort_extract.csv">  <!-- module 4 -->
 *   <body data-exercise-packages="numpy,pandas"> <!-- module 4 -->
 *   <body>                                        <!-- module 2: none -->
 *
 * Design notes
 * ------------
 * LAZY BOOT. The sims load Pyodide up front behind a loading overlay, which is
 * right for something you enter deliberately. A module page is mostly for
 * reading, and most visitors never touch an exercise, so paying ~10 MB and
 * several seconds on every page view would be wrong. Pyodide boots on the first
 * Run click and is then shared by every exercise on the page.
 *
 * ONE RUNTIME PER PAGE. Module pages already carry a floating "Python Sandbox"
 * modal that boots its own Pyodide. Two runtimes on one page means downloading
 * and holding ~10 MB twice. This module publishes its instance as
 * window.dtscPyodide (a promise) and reuses one if it is already there, so
 * whichever feature the student touches first wins and the other joins it.
 *
 * Sharing safely required giving up pyodide.setStdout() - see the capture
 * section below. The sandbox still boots its own instance because it does not
 * yet look for window.dtscPyodide; that half is R11 in the review queue. This
 * side is written so that landing R11 needs no further change here.
 *
 * NO GRADING. The sims compare output against an expected string. These
 * exercises are open-ended - several have many correct answers - so the runner
 * shows output and errors and leaves judgement to the student and the worked
 * solution below each one.
 *
 * PER-EXERCISE NAMESPACE IS SHARED ON PURPOSE. Cells later in a module rely on
 * variables defined earlier (the cohort arrays, clean_name, and so on), exactly
 * as they do in the notebook. One interpreter per page preserves that.
 */
(function () {
  "use strict";

  var pyodide = null;        // the interpreter, once booted
  var booting = null;        // in-flight boot promise, so two clicks share one
  var editors = {};          // exercise id -> CodeMirror instance
  var originals = {};        // exercise id -> the starter code, for Reset

  // ---------------------------------------------------------------- helpers
  function $(id) { return document.getElementById(id); }

  function statusEl(eid) { return $(eid + "-status"); }
  function outEl(eid) { return $(eid + "-out"); }

  function setStatus(eid, text, kind) {
    var el = statusEl(eid);
    if (!el) return;
    el.textContent = text || "";
    el.className = "ex-status" + (kind ? " ex-status-" + kind : "");
  }

  function getCode(eid) {
    return editors[eid] ? editors[eid].getValue() : ($(eid + "-src") || {}).value || "";
  }

  function setCode(eid, src) {
    if (editors[eid]) editors[eid].setValue(src);
    else if ($(eid + "-src")) $(eid + "-src").value = src;
  }

  // ------------------------------------------------------------ boot Pyodide
  function packagesWanted() {
    var raw = document.body.getAttribute("data-exercise-packages") || "";
    return raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }

  // Kept at the version the page's sandbox already uses, so the two share a
  // CDN cache entry even before they share an instance.
  var PYODIDE_VERSION = "0.26.2";
  var PYODIDE_BASE = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("could not load " + src)); };
      document.head.appendChild(s);
    });
  }

  // ------------------------------------------------------------- data files
  // Pyodide has its own in-memory filesystem, so a page whose exercises call
  // pd.read_csv("data/x.csv") gets FileNotFoundError unless the file is put
  // there first. Declare what a page needs on the <body>:
  //
  //   <body data-exercise-data="data/cohort_extract.csv,data/students.csv">
  //
  // Paths are relative to the page and are written into Pyodide under the same
  // relative path, so the notebook code runs unchanged.
  function dataWanted() {
    var raw = document.body.getAttribute("data-exercise-data") || "";
    return raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }

  async function mountData(py) {
    var files = dataWanted();
    if (!files.length) return;
    for (var i = 0; i < files.length; i++) {
      var rel = files[i];
      var res = await fetch(rel);
      if (!res.ok) throw new Error("could not fetch " + rel + " (" + res.status + ")");
      var text = await res.text();
      var dir = rel.indexOf("/") > -1 ? rel.slice(0, rel.lastIndexOf("/")) : "";
      if (dir) {
        try { py.FS.mkdirTree(dir); } catch (e) { /* already there */ }
      }
      py.FS.writeFile(rel, text);
    }
  }

  function bootPyodide(eid) {
    if (pyodide) return Promise.resolve(pyodide);
    if (booting) return booting;

    // If anything else on the page already started one, join it.
    if (window.dtscPyodide) {
      booting = window.dtscPyodide
        .then(function (py) { return mountData(py).then(function () { return py; }); })
        .then(function (py) { pyodide = py; return py; });
      return booting;
    }

    var pkgs = packagesWanted();
    setStatus(eid, pkgs.length
      ? "Starting Python and loading " + pkgs.join(", ") + "..."
      : "Starting Python...", "busy");

    booting = (async function () {
      if (typeof window.loadPyodide !== "function") {
        await loadScript(PYODIDE_BASE + "pyodide.js");
      }
      if (typeof window.loadPyodide !== "function") {
        throw new Error(
          "Python could not be loaded. Check your connection and reload the page.");
      }
      var py = await window.loadPyodide({ indexURL: PYODIDE_BASE });
      if (pkgs.length) await py.loadPackage(pkgs);
      await mountData(py);
      pyodide = py;
      return py;
    })();

    // publish so the sandbox (or anything else) can join rather than duplicate
    window.dtscPyodide = booting;
    booting.catch(function () { booting = null; window.dtscPyodide = null; });
    return booting;
  }

  // ---------------------------------------------------------------- capture
  // We do NOT use pyodide.setStdout(). That permanently rebinds sys.stdout for
  // the whole interpreter, and the page's Python Sandbox captures output by
  // installing its own StringIO and calling sys.stdout.getvalue(). On a shared
  // interpreter, setStdout would swap that object out and the sandbox's next
  // run would die with AttributeError: 'ConsoleIO' object has no attribute
  // 'getvalue'. Saving and restoring instead means we borrow the streams for
  // the duration of one run and hand back exactly what we found.
  var _lastErr = "";

  function beginCapture(py) {
    _lastErr = "";
    py.runPython(
      "import sys, io\n" +
      "_ex_saved = (sys.stdout, sys.stderr)\n" +
      "_ex_out, _ex_err = io.StringIO(), io.StringIO()\n" +
      "sys.stdout, sys.stderr = _ex_out, _ex_err\n"
    );
  }

  function endCapture(py) {
    var text = "";
    try {
      text = py.runPython("_ex_out.getvalue()") || "";
      _lastErr = py.runPython("_ex_err.getvalue()") || "";
    } finally {
      py.runPython("sys.stdout, sys.stderr = _ex_saved\n");
    }
    return text;
  }

  // -------------------------------------------------------------------- run
  async function runExercise(eid) {
    var btn = document.querySelector('.ex-run[data-target="' + eid + '"]');
    var out = outEl(eid);
    if (!out) return;

    if (btn) { btn.disabled = true; btn.textContent = "Running..."; }
    out.hidden = false;
    out.textContent = "";
    out.className = "ex-output";

    var stdout = "", stderr = "";
    var py = null, captured = false;
    try {
      py = await bootPyodide(eid);
      setStatus(eid, "Running...", "busy");

      beginCapture(py);
      captured = true;
      var result = await py.runPythonAsync(getCode(eid));
      stdout = endCapture(py); captured = false;
      stderr = _lastErr;

      // Notebooks display the value of a trailing expression; mirror that so
      // an exercise ending in a bare variable name still shows something.
      if (result !== undefined && result !== null && stdout.trim() === "") {
        stdout = String(result) + "\n";
      }
      setStatus(eid, "Ran successfully", "ok");
    } catch (e) {
      // Restore the streams even when the student's code raised, or the page's
      // sandbox would be left writing into our buffer.
      if (captured && py) { try { stdout = endCapture(py); } catch (_) {} }
      stderr = _lastErr || (e && e.message) || String(e);
      setStatus(eid, "Python raised an error", "err");
    }

    if (stderr.trim()) {
      out.textContent = stderr.trim();
      out.className = "ex-output ex-output-err";
    } else {
      out.textContent = stdout.trim() || "(ran, but printed nothing - add a print())";
    }

    if (btn) { btn.disabled = false; btn.textContent = "Run"; }
  }

  function resetExercise(eid) {
    setCode(eid, originals[eid] || "");
    var out = outEl(eid);
    if (out) { out.textContent = ""; out.hidden = true; }
    setStatus(eid, "");
  }

  // ------------------------------------------------------------------ setup
  function enhance(block) {
    var eid = block.getAttribute("data-exercise");
    var ta = $(eid + "-src");
    if (!ta || ta.dataset.enhanced) return;
    ta.dataset.enhanced = "1";
    originals[eid] = ta.value;

    var out = outEl(eid);
    if (out) out.hidden = true;

    if (typeof CodeMirror === "function") {
      editors[eid] = CodeMirror.fromTextArea(ta, {
        mode: "python",
        theme: "material-darker",
        lineNumbers: true,
        indentUnit: 4,
        matchBrackets: true,
        autoCloseBrackets: true,
        viewportMargin: Infinity
      });
      // Ctrl/Cmd+Enter runs, the shortcut people expect from notebooks
      editors[eid].setOption("extraKeys", {
        "Ctrl-Enter": function () { runExercise(eid); },
        "Cmd-Enter": function () { runExercise(eid); }
      });

      // fromTextArea sets the original textarea to display:none and builds its
      // own input, so the <label for> attached to it no longer names anything
      // the user can reach. Carry the name across by hand - otherwise the
      // enhanced editor is LESS accessible than the plain textarea it replaced,
      // and the markup fix looks correct while the real control stays unnamed.
      var lbl = document.querySelector('label[for="' + eid + '-src"]');
      var name = lbl ? (lbl.textContent || "").replace(/\s+/g, " ").trim() : "";
      if (name) {
        var input = editors[eid].getInputField();
        if (input) input.setAttribute("aria-label", name);
        var wrap = editors[eid].getWrapperElement();
        if (wrap) {
          wrap.setAttribute("role", "group");
          wrap.setAttribute("aria-label", name);
        }
      }
    }
  }

  function init() {
    var blocks = document.querySelectorAll(".exercise-block[data-exercise]");
    if (!blocks.length) return;

    // Sections are hidden with display:none until selected, and CodeMirror
    // measures badly inside a hidden container. Enhance the visible ones now
    // and the rest when their section is first shown.
    blocks.forEach(function (b) {
      if (b.offsetParent !== null) enhance(b);
    });

    document.addEventListener("click", function (e) {
      var run = e.target.closest && e.target.closest(".ex-run");
      if (run) { runExercise(run.getAttribute("data-target")); return; }
      var reset = e.target.closest && e.target.closest(".ex-reset");
      if (reset) { resetExercise(reset.getAttribute("data-target")); }
    });

    // showSection() swaps the .active class; catch newly visible editors.
    if (typeof MutationObserver === "function") {
      new MutationObserver(function () {
        document.querySelectorAll(".exercise-block[data-exercise]").forEach(function (b) {
          if (b.offsetParent !== null) {
            enhance(b);
            var eid = b.getAttribute("data-exercise");
            if (editors[eid]) editors[eid].refresh();
          }
        });
      }).observe(document.body, {
        subtree: true, attributes: true, attributeFilter: ["class"]
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // exposed for debugging and for any hand-written page that wants them
  window.dtscExercises = { run: runExercise, reset: resetExercise };
})();
