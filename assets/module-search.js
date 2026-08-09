/* ---------------------------------------------------------------------------
   Search box in the Contents pane.  DTSC 520.

   WHY IT SEARCHES CONTENT, NOT JUST HEADINGS.

   A module page hides every section but one behind a tab, so the browser's own
   Ctrl+F can only ever find text in the tab you are already looking at. On a
   400KB page split into eleven sections that is close to useless - the thing a
   student wants ("where was that TypeError example?") is nearly always in a
   section they are not currently on.

   So this indexes ALL sections, including hidden ones, and clicking a result
   switches tabs and scrolls to the match.

   It is a plain substring search over the page's own text. No index file, no
   fetch, no dependency - the content is already in the DOM, and anything
   cleverer would be a second copy of the content to keep in step. Built once on
   first keystroke, so it costs nothing on a page nobody searches.
--------------------------------------------------------------------------- */
(function () {
  "use strict";

  var MIN = 2;          // below this, results are noise
  var MAX = 40;         // more than this and the pane becomes a wall
  var index = null;     // [{sid, label, text, el}] built lazily
  var listEl, inputEl, resultsEl, tocEl;

  function buildIndex() {
    if (index) return index;
    index = [];
    var secs = document.querySelectorAll("section.content-section[id]");
    Array.prototype.forEach.call(secs, function (sec) {
      if (sec.id === "quiz") return;
      var label = (document.querySelector('.tab-link[data-section="' + sec.id + '"]')
                   || {}).textContent;
      if (!label) {
        var h = sec.querySelector("h2");
        label = h ? h.textContent : sec.id;
      }
      /* Walk block elements rather than the whole section, so a hit can be
         scrolled to precisely instead of dumping the student at the top. */
      var blocks = sec.querySelectorAll("p, li, h3, h4, pre, td, summary");
      Array.prototype.forEach.call(blocks, function (b) {
        var t = (b.textContent || "").replace(/\s+/g, " ").trim();
        if (t.length > 8) index.push({ sid: sec.id, label: label.trim(), text: t, el: b });
      });
    });
    return index;
  }

  function snippet(text, q) {
    var i = text.toLowerCase().indexOf(q);
    var from = Math.max(0, i - 34);
    var s = (from ? "…" : "") + text.slice(from, i + q.length + 56);
    return s.length < text.length ? s + "…" : s;
  }

  function go(hit, q) {
    if (typeof showSection === "function") showSection(hit.sid);
    /* The section was display:none a moment ago, so its geometry is not final
       until the browser has laid it out. Scrolling immediately lands in the
       wrong place - hence the frame delay. */
    requestAnimationFrame(function () {
      hit.el.scrollIntoView({ behavior: "smooth", block: "center" });
      hit.el.classList.add("search-hit");
      setTimeout(function () { hit.el.classList.remove("search-hit"); }, 2200);
    });
  }

  function render(q) {
    resultsEl.innerHTML = "";
    if (q.length < MIN) {
      resultsEl.hidden = true;
      if (tocEl) tocEl.hidden = false;
      return;
    }
    var hits = buildIndex().filter(function (r) {
      return r.text.toLowerCase().indexOf(q) !== -1;
    });
    if (tocEl) tocEl.hidden = true;
    resultsEl.hidden = false;

    if (!hits.length) {
      var none = document.createElement("p");
      none.className = "search-none";
      none.textContent = "Nothing found for “" + q + "”.";
      resultsEl.appendChild(none);
      return;
    }
    var count = document.createElement("p");
    count.className = "search-count";
    count.textContent = hits.length + (hits.length === 1 ? " result" : " results")
                      + (hits.length > MAX ? ", showing " + MAX : "");
    resultsEl.appendChild(count);

    hits.slice(0, MAX).forEach(function (hit) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "search-result";
      var s = document.createElement("span");
      s.className = "search-sec";
      s.textContent = hit.label;
      var t = document.createElement("span");
      t.className = "search-snip";
      t.textContent = snippet(hit.text, q);
      b.appendChild(s);
      b.appendChild(t);
      b.addEventListener("click", function () { go(hit, q); });
      resultsEl.appendChild(b);
    });
  }

  function init() {
    tocEl = document.getElementById("tocList");
    if (!tocEl) return;

    var wrap = document.createElement("div");
    wrap.className = "toc-search";

    var lab = document.createElement("label");
    lab.className = "vh";
    lab.setAttribute("for", "toc-search-input");
    lab.textContent = "Search this module";

    inputEl = document.createElement("input");
    inputEl.type = "search";
    inputEl.id = "toc-search-input";
    inputEl.placeholder = "Search this module…";
    inputEl.autocomplete = "off";

    resultsEl = document.createElement("div");
    resultsEl.className = "search-results";
    resultsEl.hidden = true;
    resultsEl.setAttribute("role", "region");
    resultsEl.setAttribute("aria-live", "polite");
    resultsEl.setAttribute("aria-label", "Search results");

    wrap.appendChild(lab);
    wrap.appendChild(inputEl);
    tocEl.parentNode.insertBefore(wrap, tocEl);
    tocEl.parentNode.insertBefore(resultsEl, tocEl);

    var t = null;
    inputEl.addEventListener("input", function () {
      clearTimeout(t);
      var q = inputEl.value.trim().toLowerCase();
      t = setTimeout(function () { render(q); }, 120);
    });
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { inputEl.value = ""; render(""); inputEl.blur(); }
      if (e.key === "Enter") {
        var first = resultsEl.querySelector(".search-result");
        if (first) first.click();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
