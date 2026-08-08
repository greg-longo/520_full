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
   misreport the vectorisation speedup Module 3 teaches). Those keep their
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
    "import ast, sys, io, traceback",
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
    "        return buf.getvalue(), True",
    "    finally:",
    "        sys.stdout = old",
    "    return buf.getvalue(), False",
    "_dtsc_ns = {'__name__': '__main__'}",
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
          /* Module 2 is pure Python - no numpy, no pandas. Nothing to
             loadPackage, which is why this section is the cheapest one on the
             site to make live despite having the most code blocks. */
          p.runPython(SHIM);
          py = p;
          resolve(p);
        }).catch(reject);
      };
      document.head.appendChild(s);
    });
    return booting;
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
    var text = res.get(0), failed = res.get(1);
    res.destroy();
    var slot = outSlot(block);
    slot.querySelector("pre").textContent = text === "" ? "— no output —" : text;
    slot.classList.toggle("run-failed", failed);
    block.setAttribute("data-ran", "1");
    return failed;
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
      py.runPython("_dtsc_ns = {'__name__': '__main__'}");
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
    var wrap = document.createElement("label");
    wrap.className = "show-all-toggle";
    var box = document.createElement("input");
    box.type = "checkbox";
    box.checked = showingAll();
    var txt = document.createElement("span");
    txt.textContent = "Show all output";
    var hint = document.createElement("span");
    hint.className = "toggle-hint";
    hint.textContent = "for looking things up. You still learn more by running it.";
    wrap.appendChild(box);
    wrap.appendChild(txt);
    wrap.appendChild(hint);
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
