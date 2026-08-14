/* ---------------------------------------------------------------------------
   Read-only runnable code blocks.  DTSC 520.

   Prototype scope: Module 2, "Variables & Types" only. Every other section on
   every other page is untouched and renders exactly as it did before.

   THE DESIGN, and why it is this and not an editor.

   The code is NOT editable. That is the whole point, and it buys four things
   an editable cell cannot:

     1. No CodeMirror. The existing <pre><code> is reused as-is, so the page
        keeps its syntax highlighting, its text selection, its screen-reader
        behavior and its no-JS rendering. Module 2 has 278 code blocks; 278
        editors would have been a memory and accessibility problem, 278 Run
        buttons is not.

     2. The prerequisite chain is knowable. 87% of these cells reference a name
        defined in an earlier cell, so a cell cannot simply be run on its own.
        Because nothing can be edited, the builder knows exactly what every
        earlier cell does, so "run the cells above this one first" is
        deterministic and safe to do silently. With editable cells it would be
        neither.

     3. Live output can be checked against stored output, because the source is
        byte-identical to what was executed under CPython to build the page.
        Version drift between Pyodide and the notebook becomes a test rather
        than a surprise. See tools/check_live_output.py.

     4. Progressive enhancement is free. The stored output stays in the DOM and
        is only hidden once this script has decided it can actually run things.
        No JS, no Pyodide, slow network, blocked CDN - the page is exactly what
        it is today.

   WHAT IS DELIBERATELY LEFT OUT of the prototype: %%expect cells (a custom
   IPython magic Pyodide has no equivalent for) and %timeit (WASM timings would
   misreport the vectorization speedup Module 3 teaches). Those keep their
   verified static output.
--------------------------------------------------------------------------- */
(function () {
  "use strict";

  var PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
  var blocks = [];
  var py = null;          // the Pyodide instance, once booted
  var booting = null;     // in-flight boot promise, so two clicks boot once

  /* A notebook cell shows the value of its final expression the way a REPL
     does - `type(42)` displays <class 'int'> without any print. Plain exec()
     does not do that, so the page would silently show nothing for 20 of the 31
     runnable cells here. This reproduces the REPL rule: exec everything but
     the last statement, then eval the last one if it is an expression, and
     display it only if it is not None. */
  var SHIM = [
    "import ast, sys, io, base64, traceback",
    "def _dtsc_run(src, ns):",
    "    buf = io.StringIO()",
    "    old = sys.stdout",
    "    sys.stdout = buf",
    "    try:",
    "        tree = ast.parse(src)",
    "        body, tail = tree.body[:-1], tree.body[-1:]",
    "        if body:",
    "            exec(compile(ast.Module(body, []), '<cell>', 'exec'), ns)",
    "        if tail and isinstance(tail[0], ast.Expr):",
    "            val = eval(compile(ast.Expression(tail[0].value), '<cell>', 'eval'), ns)",
    "            if val is not None:",
    /* IPython pretty-prints a class as `int`, not `<class 'int'>`, and this
       section is ABOUT types - the first four cells are all type(). Plain
       repr() would have put live output on the page that contradicts the
       notebook students downloaded, on the very first thing they run. */
    "                if isinstance(val, type):",
    "                    buf.write(getattr(val, '__name__', repr(val)) + '\\n')",
    "                else:",
    "                    buf.write(repr(val) + '\\n')",
    "        elif tail:",
    "            exec(compile(ast.Module(tail, []), '<cell>', 'exec'), ns)",
    "    except BaseException:",
    "        lines = traceback.format_exc().splitlines()",
    "        buf.write(lines[0] + '\\n' if len(lines) == 1 else lines[-1] + '\\n')",
    "        sys.stdout = old",
    "        return buf.getvalue(), True, _dtsc_figs()",
    "    finally:",
    "        sys.stdout = old",
    "    return buf.getvalue(), False, _dtsc_figs()",
    /* The bootstrap has to land in the SAME dict the cells run in.
       p.runPython(bootSrc) puts `pd` in Pyodide's globals, while every cell
       executes against `_dtsc_ns` - so `pd` was defined somewhere the cells
       could not see it. And run() resets `_dtsc_ns` on each click, which would
       have wiped it even if it had landed correctly. One reset function owns
       both jobs, and is the only thing allowed to clear the namespace. */
    /* Figures. A plotting cell writes nothing to stdout, so without this a Run
       click on Module 5 looks like it did nothing at all. Pyodide's default
       matplotlib backend (matplotlib-pyodide) draws onto a canvas it appends to
       the document, which would put figures outside this block and outside the
       page's layout entirely - so the backend is forced to Agg at import time
       and the figures are collected here as PNG instead. */
    "def _dtsc_figs():",
    "    plt = sys.modules.get('matplotlib.pyplot')",
    "    if plt is None:",
    "        return []",
    "    out = []",
    "    for num in plt.get_fignums():",
    "        fig = plt.figure(num)",
    "        buf = io.BytesIO()",
    "        try:",
    "            fig.savefig(buf, format='png', dpi=110, bbox_inches='tight')",
    "            out.append(base64.b64encode(buf.getvalue()).decode('ascii'))",
    "        finally:",
    "            plt.close(fig)",
    "    return out",
    "_dtsc_boot = ''",
    "def _dtsc_reset():",
    "    global _dtsc_ns",
    "    _dtsc_ns = {'__name__': '__main__'}",
    "    if _dtsc_boot:",
    "        exec(_dtsc_boot, _dtsc_ns)",
    "_dtsc_reset()",
  ].join("\n");

  function boot(statusEl) {
    if (py) return Promise.resolve(py);
    if (booting) return booting;
    booting = new Promise(function (resolve, reject) {
      statusEl.textContent = "Starting Python (first run only)...";
      var s = document.createElement("script");
      s.src = PYODIDE + "pyodide.js";
      s.onerror = function () { reject(new Error("could not load Pyodide")); };
      s.onload = function () {
        window.loadPyodide({ indexURL: PYODIDE }).then(function (p) {
        /* Before any cell can `import matplotlib.pyplot`. matplotlib-pyodide
           would otherwise take over and render to its own canvas. */
        try { p.runPython("import os\nos.environ['MPLBACKEND'] = 'agg'"); }
        catch (e) { if (window.console) console.warn("runnable: backend", e); }
          /* Work out what to load by READING THE PAGE rather than hardcoding a
             per-module list, so a notebook change cannot leave this stale.

             The BOOTSTRAP counts as page source. Module 4's overview showed why:
             its `import numpy as np` lives in the bootstrap, and numpy appeared
             nowhere in the runnable blocks it was scanned from. So numpy was
             never loaded, the bootstrap threw on line one, and every block on
             the page then failed with `pd is not defined` - one missing import
             presenting as a completely unrelated error. */
          var bootEl = document.querySelector(
            'script[type="application/x-dtsc-setup"]');
          var bootSrc = bootEl ? bootEl.textContent : "";
          var src = blocks.map(function (b) {
            return b.querySelector("code").textContent;
          }).join("\n") + "\n" + bootSrc;

          var pkgs = [];
          if (/\bnumpy\b|\bnp\./.test(src)) pkgs.push("numpy");
          if (/\bpandas\b|\bpd\./.test(src)) pkgs.push("pandas");

          var loaded = pkgs.length
            ? (statusEl.textContent = "Loading " + pkgs.join(" and ") + "...",
               p.loadPackage(pkgs))
            : Promise.resolve();

          return loaded.then(function () {
            p.runPython(SHIM);
            return stageData(p, src);
          }).then(function () {
            /* Runs whether or not packages were needed. It used to sit inside
               the package branch, so a page with a bootstrap but no detected
               package silently skipped its own imports. */
            if (bootSrc) {
              try {
                p.globals.set("_dtsc_boot", bootSrc);
                p.runPython("_dtsc_reset()");
              } catch (e) {
                /* Loud, not silent: without its imports every block on the page
                   is about to fail for a reason that points somewhere else. */
                throw new Error("setup failed: " + e.message);
              }
            }
            py = p;
            resolve(p);
          });
        }).catch(reject);
      };
      document.head.appendChild(s);
    });
    return booting;
  }

  /* Module 4 reads real CSVs: `read_csv("data/students.csv")`. Pyodide has its
     own virtual filesystem, so those files have to be put there first. The
     list comes from the code ON THE PAGE, so adding or renaming a table in the
     notebook needs no change here. */
  function stageData(p, src) {
    var names = [], seen = {}, m;
    var re = /read_csv\(\s*["']([^"']+\.csv)["']/g;
    while ((m = re.exec(src))) { if (!seen[m[1]]) { seen[m[1]] = 1; names.push(m[1]); } }
    if (!names.length) return Promise.resolve();
    try { p.FS.mkdir("data"); } catch (e) { /* already there */ }
    return Promise.all(names.map(function (n) {
      /* Tolerate a miss. The prose contains illustrative paths like
         read_csv("data/x.csv") that do not exist, and a rejected promise here
         would take the whole Pyodide boot down with it - turning a cosmetic
         example into a dead Run button on every block. */
      return fetch(n, { cache: "force-cache" }).then(function (r) {
        return r.ok ? r.text() : null;
      }).then(function (txt) {
        if (txt !== null) p.FS.writeFile(n, txt);
      }).catch(function () { /* leave it absent; the cell will say so */ });
    }));
  }

  function outSlot(block) {
    var slot = block.querySelector(".run-output");
    if (!slot) {
      slot = document.createElement("div");
      slot.className = "output-block run-output";
      slot.innerHTML = '<div class="output-block-label">output</div><pre></pre>';
      block.appendChild(slot);
    }
    return slot;
  }

  function execOne(block) {
    var src = block.querySelector("code").textContent;
    var res = py.runPython("_dtsc_run(" + JSON.stringify(src) + ", _dtsc_ns)");
    var text = res.get(0), failed = res.get(1), figs = res.get(2).toJs();
    res.destroy();
    var slot = outSlot(block);
    var hasText = text !== "";
    slot.querySelector("pre").textContent =
      hasText ? text : (figs.length ? "" : "— no output —");
    slot.querySelector("pre").hidden = !hasText && figs.length > 0;
    renderFigures(slot, figs, block);
    slot.classList.toggle("run-failed", failed);
    block.setAttribute("data-ran", "1");
    return failed;
  }

  /* The alt text is lifted from the stored figure the page already shipped, so
     a live re-run describes itself exactly as the verified one did. A figure
     with no stored counterpart says so rather than shipping an empty alt. */
  function renderFigures(slot, figs, block) {
    var old = slot.querySelectorAll(".run-figure");
    for (var i = 0; i < old.length; i++) old[i].remove();
    if (!figs.length) return;
    var stored = block.parentNode.querySelectorAll(".nb-figure img");
    for (var j = 0; j < figs.length; j++) {
      var fig = document.createElement("figure");
      fig.className = "nb-figure run-figure";
      var img = document.createElement("img");
      img.src = "data:image/png;base64," + figs[j];
      img.alt = stored[j] ? stored[j].getAttribute("alt")
                          : "Figure produced by running this code.";
      fig.appendChild(img);
      slot.appendChild(fig);
    }
  }

  function run(block, statusEl) {
    var btn = block.querySelector(".run-btn");
    btn.disabled = true;
    statusEl.textContent = "";
    return boot(statusEl).then(function () {
      statusEl.textContent = "";
      /* Reset the namespace and replay every earlier block before running this
         one. Costs nothing (these cells are tiny) and means a block ALWAYS
         produces the output the notebook produces, no matter what order things
         were clicked in or how many times.

         Without the reset, `count -= 2` gives 3 the first time and 1 the
         second, because the name survives between runs. That is correct Python
         and correct notebook behavior, but on a page whose whole promise is
         "this is the verified output" it reads as the site being broken. */
      py.runPython("_dtsc_reset()");   // clears AND re-applies the imports
      var idx = blocks.indexOf(block);
      for (var i = 0; i < idx; i++) execOne(blocks[i]);
      execOne(block);
      showCleared(block, false);
      var st = block.querySelector("[data-stored-output]");
      if (st) st.hidden = true;   // the live result replaces it
      btn.disabled = false;
    }).catch(function (err) {
      statusEl.textContent = "Python could not start. The stored output is shown instead.";
      block.classList.add("run-unavailable");
      btn.disabled = false;
      /* Failing to run must never leave a student with less than the page had
         before, so the verified output comes back. */
      var stored = block.querySelector("[data-stored-output]");
      if (stored) stored.hidden = false;
      if (window.console) console.warn("runnable:", err);
    });
  }

  /* There is no "Run again": re-running a read-only block gives the same answer
     by construction, so the button would be an invitation to no purpose. Once a
     block has run, the only useful action is putting it back. */
  function showCleared(block, cleared) {
    block.querySelector(".run-btn").hidden = !cleared;
    block.querySelector(".clear-btn").hidden = cleared;
  }

  function clear(block) {
    var slot = block.querySelector(".run-output");
    if (slot) slot.parentNode.removeChild(slot);
    block.removeAttribute("data-ran");
    var st = block.querySelector("[data-stored-output]");
    if (st) st.hidden = !showingAll();
    showCleared(block, true);
  }

  function enhance(block) {
    var bar = document.createElement("div");
    bar.className = "run-bar";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "run-btn";
    btn.textContent = "Run";

    var clr = document.createElement("button");
    clr.type = "button";
    clr.className = "run-btn clear-btn";
    clr.textContent = "Clear output";
    clr.hidden = true;

    var status = document.createElement("span");
    status.className = "run-status";
    status.setAttribute("role", "status");

    bar.appendChild(btn);
    bar.appendChild(clr);
    bar.appendChild(status);
    block.appendChild(bar);

    btn.addEventListener("click", function () { run(block, status); });
    clr.addEventListener("click", function () { clear(block); });

    /* Only now, once the button exists and JS is demonstrably alive, is it safe
       to hide the answer. */
    var stored = block.querySelector("[data-stored-output]");
    if (stored) stored.hidden = true;
  }

  /* ------------------------------------------------------------------ toggle
     Hiding stored output is the right default: it is what makes a Predict
     prompt work at all, and students are told plainly that they are expected
     to run everything.

     But it removes the only place in the whole system where a student can
     simply SEE what a line of code produces. The student notebooks ship with
     zero stored output by design, so "download it and Run All" is a five
     minute commitment rather than a ten second lookup. This toggle is that
     lookup path, which is why it is site-wide and sticky rather than a
     per-section convenience - a control you have to set fourteen times is a
     control nobody sets twice. See RUNNABLE_ROLLOUT.md. */
  var KEY = "dtsc520-show-output";

  function showingAll() {
    try { return window.localStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  }

  function applyShowAll(on) {
    try { window.localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) {}
    blocks.forEach(function (b) {
      var stored = b.querySelector("[data-stored-output]");
      /* Never reveal the stored copy next to a live result the student just
         produced - two output blocks for one cell reads as a bug. */
      if (stored) stored.hidden = !on || b.hasAttribute("data-ran");
    });
    Array.prototype.forEach.call(
      document.querySelectorAll(".show-all-toggle input"),
      function (i) { i.checked = on; });
  }

  function addToggle(section) {
    var wrap = document.createElement("div");
    wrap.className = "show-all-toggle";

    /* The guidance sits OUTSIDE the label, and the checkbox comes last.
       Checkbox-first made the control the first thing the eye lands on, so it
       got ticked before the sentence explaining when to tick it was read.
       Text first reads as a sentence; a control at the end reads as an option.

       Keeping the first sentence out of the <label> also keeps the checkbox's
       accessible name short and accurate - a screen reader announces "Show all
       output for looking things up, checkbox" rather than both sentences. */
    var lead = document.createElement("p");
    lead.className = "toggle-lead";
    lead.textContent = "Run cells yourself the first time you are learning.";

    var label = document.createElement("label");
    var txt = document.createElement("span");
    txt.textContent = "Show all output for looking things up.";
    var box = document.createElement("input");
    box.type = "checkbox";
    box.checked = showingAll();
    label.appendChild(txt);
    label.appendChild(box);

    wrap.appendChild(lead);
    wrap.appendChild(label);
    box.addEventListener("change", function () { applyShowAll(box.checked); });
    section.insertBefore(wrap, section.firstChild);
  }

  function init() {
    blocks = Array.prototype.slice.call(
      document.querySelectorAll(".content-section [data-runnable]"));
    if (!blocks.length) return;
    blocks.forEach(enhance);

    var seen = [];
    blocks.forEach(function (b) {
      var sec = b.closest(".content-section");
      if (sec && seen.indexOf(sec) === -1) { seen.push(sec); addToggle(sec); }
    });
    applyShowAll(showingAll());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
