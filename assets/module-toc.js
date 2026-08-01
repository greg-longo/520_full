/**
 * DTSC 520 - collapsible contents for a module page.
 *
 * Builds the left-hand contents list from the page's own `<section>` elements,
 * so it can never drift from the content the way a hand-written list does.
 *
 * The pages are TABBED - `showSection()` shows one section and hides the rest -
 * so this is not a scroll-spy. The section you are in is expanded to show its
 * sub-headings; the others are collapsed to a single line. Clicking a
 * sub-heading switches section if needed, then scrolls to that heading.
 *
 * Collapse state is remembered in localStorage, which is available here because
 * this is a real site rather than a sandboxed artifact.
 */
(function () {
  "use strict";

  var KEY = "dtsc520.toc.collapsed";
  var wrap, list, sections = [];

  // The user's explicit choice, or null if they have not made one.
  // This MUST live at module scope: the reopen tab's click handler is created
  // in ensureReopenTab(), which is not inside init(). When it was declared with
  // `var saved` inside init() instead, the handler assigned to an undeclared
  // name, and under "use strict" that is a ReferenceError - thrown before
  // setCollapsed() could run, so the tab looked dead. jsdom swallowed the error
  // and the tests passed; a browser does not.
  var saved = null;

  function slug(el) { return el.getAttribute("id") || ""; }

  function labelFor(sec) {
    // Prefer the tab strip's label so the contents and the tabs agree.
    var tab = document.querySelector('.tab-link[data-section="' + sec.id + '"]');
    if (tab && tab.textContent.trim()) return tab.textContent.trim();
    var h = sec.querySelector("h2");
    return h ? h.textContent.trim() : sec.id;
  }

  function build() {
    list.innerHTML = "";
    sections.forEach(function (sec, i) {
      var item = document.createElement("div");
      item.className = "toc-section";
      item.setAttribute("data-for", sec.id);

      var a = document.createElement("a");
      a.innerHTML = '<span class="toc-num">' + (i + 1) + "</span>";
      a.appendChild(document.createTextNode(labelFor(sec)));
      a.addEventListener("click", function (e) {
        e.preventDefault();
        go(sec.id, null);
      });
      item.appendChild(a);

      var subs = document.createElement("div");
      subs.className = "toc-subs";
      sec.querySelectorAll("h3[id]").forEach(function (h) {
        var s = document.createElement("a");
        s.textContent = h.textContent.trim();
        s.href = "#" + slug(h);
        s.addEventListener("click", function (e) {
          e.preventDefault();
          go(sec.id, slug(h));
        });
        subs.appendChild(s);
      });
      if (subs.children.length) item.appendChild(subs);

      list.appendChild(item);
    });
  }

  function go(sectionId, anchor) {
    if (typeof window.showSection === "function") {
      // showSection(id, noScroll, noHash). Pass noScroll: its own
      // `window.scrollTo({top: 0, behavior: "smooth"})` sends the reader to the
      // top of the PAGE - the banner - and then races the scroll below, because
      // a smooth scroll is still animating a frame later. One scroller only,
      // and it is the one that knows which heading you asked for.
      window.showSection(sectionId, true, false);
    } else {
      sections.forEach(function (s) {
        s.style.display = s.id === sectionId ? "" : "none";
      });
    }
    mark(sectionId, anchor);
    // Let the section become visible before measuring where to scroll.
    window.requestAnimationFrame(function () {
      var target = anchor ? document.getElementById(anchor)
                          : document.getElementById(sectionId);
      if (target && target.scrollIntoView) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  function mark(sectionId, anchor) {
    list.querySelectorAll(".toc-section").forEach(function (it) {
      it.classList.toggle("active", it.getAttribute("data-for") === sectionId);
    });
    list.querySelectorAll(".toc-subs a").forEach(function (a) {
      a.classList.toggle("here", anchor && a.getAttribute("href") === "#" + anchor);
    });
  }

  function currentSection() {
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].offsetParent !== null) return sections[i].id;
    }
    return sections.length ? sections[0].id : null;
  }

  function setCollapsed(on, remember) {
    wrap.classList.toggle("toc-collapsed", on);
    wrap.classList.toggle("toc-open", !on);

    // Show the reopen tab by putting a class on the TAB, never with a
    // descendant selector. The tab is a child of <body> so that it can sit
    // against the viewport edge - it is a sibling of .page-wrap, not a
    // descendant, so `.toc-collapsed .toc-reopen` matches nothing and left the
    // panel permanently unopenable.
    var tab = ensureReopenTab();
    tab.classList.toggle("is-visible", on);
    tab.setAttribute("aria-hidden", String(!on));

    var btn = document.querySelector(".toc-toggle");
    if (btn) btn.setAttribute("aria-expanded", String(!on));

    if (remember !== false) {
      try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { /* private mode */ }
    }
  }

  function ensureReopenTab() {
    var tab = document.querySelector(".toc-reopen");
    if (tab) return tab;
    tab = document.createElement("button");
    tab.className = "toc-reopen";
    tab.type = "button";
    tab.textContent = "Contents";
    tab.setAttribute("title", "Show contents");
    tab.addEventListener("click", function () { saved = "0"; setCollapsed(false); });
    document.body.appendChild(tab);
    return tab;
  }

  function init() {
    wrap = document.querySelector(".page-wrap.mod3col");
    list = document.getElementById("tocList");
    if (!wrap || !list) return;

    sections = Array.prototype.slice.call(
      document.querySelectorAll("section.content-section[id]")
    ).filter(function (s) { return s.id !== "quiz"; });
    if (!sections.length) return;

    build();
    mark(currentSection(), null);

    ensureReopenTab();
    var btn = document.querySelector(".toc-toggle");
    if (btn) {
      btn.textContent = "\u00AB";
      btn.addEventListener("click", function () { saved = "1"; setCollapsed(true); });
    }
    // One owner for the state. The stylesheet no longer auto-collapses at
    // narrow widths, because two systems deciding the same thing is how the
    // button ends up disagreeing with the layout.
    try { saved = localStorage.getItem(KEY); } catch (e) { /* ignore */ }

    var narrow = window.matchMedia ? window.matchMedia("(max-width: 1040px)") : null;
    function apply() {
      if (saved !== null) setCollapsed(saved === "1", false);
      else setCollapsed(!!(narrow && narrow.matches), false);
    }
    apply();
    if (narrow) {
      var onChange = function () { if (saved === null) apply(); };
      if (narrow.addEventListener) narrow.addEventListener("change", onChange);
      else if (narrow.addListener) narrow.addListener(onChange);
    }

    // The tab strip and any other caller of showSection() must keep the
    // contents in step, so watch for the class swap rather than wrapping
    // showSection - other scripts may have wrapped it already.
    if (typeof MutationObserver === "function") {
      var pending = null;
      new MutationObserver(function () {
        clearTimeout(pending);
        pending = setTimeout(function () { mark(currentSection(), null); }, 30);
      }).observe(document.body, {
        subtree: true, attributes: true, attributeFilter: ["class", "style"]
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.dtscToc = { rebuild: build, select: go };
})();
