/**
 * DTSC 520 - "back to where you came from" on the standalone tool pages.
 *
 * The glossary, the error translator, the cohort browser and the CodeGrade page
 * are reachable from anywhere. Once on one, the only way back was the browser's
 * own button or the course-home link, which drops you two levels above where you
 * actually were.
 *
 * THREE WAYS BACK, in descending order of how good the answer is:
 *
 *   1. A NAMED destination - "Back to Module 4: pandas". Comes from `?from=`
 *      (which the module rails write) or from a same-origin `document.referrer`.
 *      Best because the student can see where they are going, and because it is
 *      a real href: it survives a reload, a bookmark, and a middle-click.
 *   2. A GENERIC history step - "Back". Used when we cannot name the previous
 *      page but the browser has one. Covers arriving from anywhere unexpected.
 *   3. Nothing at all, when the page was opened cold in a new tab. A back link
 *      that does nothing is worse than no back link - this project has already
 *      shipped one dead button and does not need a second.
 *
 * THE DESTINATION IS ALWAYS REBUILT FROM A MATCHED ROUTE, NEVER FROM INPUT.
 * `?from=` is on a URL, so it is attacker-supplied: a crafted link mailed to a
 * student would otherwise put an off-site destination, on a course page they
 * trust, in the exact position where "back" belongs. Only the routes below are
 * honoured and the href is assembled from the route's own pattern. The naive
 * version of this was verified to render `javascript:alert(1)` as the back link.
 */
(function () {
  "use strict";

  var MODULES = {
    "0": "Course Introduction",
    "1": "Intro to Data Science",
    "2": "Python",
    "3": "NumPy",
    "4": "pandas",
    "5": "Matplotlib & Seaborn",
    "6": "Git & GitHub"
  };

  var SIMS = {
    "morning-brief": "The Morning Brief",
    "find-your-path": "Find Your Path",
    "escape-mcinnis": "Escape from McInnis Hall",
    "python_sim": "Python Field Training",
    "numpy-lab": "NumPy Lab",
    "debug-pipeline": "Debug the Pipeline",
    "dirty-dataset": "The Dirty Dataset",
    "aria-returns": "ARIA Returns",
    "rtg-investigation": "RTG Investigation",
    "board-meeting": "The Board Meeting",
    "terminal-trainer": "Terminal Trainer"
  };

  var TOOLS = {
    "glossary": "the glossary",
    "help": "the error translator",
    "cohort": "the cohort extract",
    "codegrade": "the CodeGrade guide"
  };

  /**
   * Turn a token into { href, label }, or null.
   *
   * Accepts the same vocabulary from `?from=` and from a referrer path, so a
   * link written by the rails and an arrival by ordinary navigation resolve
   * identically. Everything is rebuilt from the captured id.
   */
  function route(token) {
    var m;
    if ((m = /^module([0-6])$/.exec(token)))
      return { href: "../modules/module" + m[1] + "/index.html",
               label: "Module " + m[1] + ": " + MODULES[m[1]] };

    if ((m = /^sim\/([A-Za-z0-9_-]+)$/.exec(token)) && SIMS[m[1]])
      return { href: "../sims/" + m[1] + "/index.html", label: SIMS[m[1]] };

    if (token === "capstone")
      return { href: "../capstone/index.html", label: "the capstone" };

    if (token === "sims")
      return { href: "../sims/index.html", label: "the simulations" };

    if (token === "home")
      return { href: "../index.html", label: "DTSC 520" };

    if (TOOLS[token]) {
      // do not offer a link back to the page you are already on
      if (location.pathname.indexOf("/" + token + "/") !== -1) return null;
      return { href: "../" + token + "/index.html", label: TOOLS[token] };
    }
    return null;
  }

  /** Map a same-origin pathname onto one of the tokens above. */
  function tokenFromPath(path) {
    var m;
    if ((m = /\/modules\/module([0-6])\//.exec(path))) return "module" + m[1];
    if ((m = /\/sims\/([A-Za-z0-9_-]+)\//.exec(path)))
      return SIMS[m[1]] ? "sim/" + m[1] : "sims";
    if (/\/sims\/?($|index)/.test(path)) return "sims";
    if (/\/capstone\//.test(path)) return "capstone";
    if ((m = /\/(glossary|help|cohort|codegrade)\//.exec(path))) return m[1];
    if (/\/(index\.html)?$/.test(path)) return "home";
    return null;
  }

  /** The named destination for this visit, or null. Never a raw URL. */
  function named() {
    var q = (location.search.match(/[?&]from=([^&]*)/) || [])[1];
    if (q) {
      var r = route(decodeURIComponent(q));
      if (r) return r;
      return null;   // present but unrecognised: ignore it, never guess
    }
    var ref = document.referrer;
    if (ref) {
      try {
        var u = new URL(ref, location.href);
        if (u.origin !== location.origin) return null;
        var t = tokenFromPath(u.pathname);
        return t ? route(t) : null;
      } catch (e) { /* malformed referrer, treat as absent */ }
    }
    return null;
  }

  function init() {
    var home = document.querySelector("a.back");
    if (!home || !home.parentNode) return;

    var dest = named();
    var el;

    if (dest) {
      el = document.createElement("a");
      el.href = dest.href;
      el.textContent = "← Back to " + dest.label;
    } else if (window.history && history.length > 1) {
      /* We cannot say where they came from, but the browser can get them there.
         A button rather than a link, because there is no href to give it. */
      el = document.createElement("button");
      el.type = "button";
      el.textContent = "← Back";
      el.addEventListener("click", function () { history.back(); });
    } else {
      return;   // opened cold: no honest back link exists
    }

    el.className = "back back-to-module";
    var sep = document.createElement("span");
    sep.className = "back-sep";
    sep.textContent = "·";

    // Before the course-home link: the nearer destination reads first.
    home.parentNode.insertBefore(el, home);
    home.parentNode.insertBefore(sep, home);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
