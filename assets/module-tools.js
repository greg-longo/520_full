/**
 * DTSC 520 - move the floating page tools into the right-hand rail.
 *
 * The module pages ship two fixed-position launchers: the Python Sandbox pill
 * at bottom-right, and the display-settings gear. Both float over the content,
 * and with a three-column layout there is a better place for them.
 *
 * This RELOCATES the existing buttons rather than creating new ones that proxy
 * a click. Event handlers are bound to the element, not to its position, so
 * moving a node keeps its behavior exactly as the page author wrote it. A
 * proxy button would be a second thing to keep in step - the same duplication
 * argument that governs the notebooks and the site pages.
 *
 * Runs after the page's own inline scripts, so their handlers are already
 * attached by the time anything moves.
 */
(function () {
  "use strict";

  // id -> the label to show in the rail once relocated
  var TOOLS = [
    { id: "sandbox-btn", label: "Python Sandbox",
      sub: "A scratchpad. Runs real Python, nothing to install." },
    { id: "settings-toggle", label: "Display settings",
      sub: "Text size, contrast, motion." }
  ];

  function relocate() {
    var host = document.getElementById("railTools");
    if (!host) return;

    var moved = 0;
    TOOLS.forEach(function (tool) {
      var el = document.getElementById(tool.id);
      if (!el) return;

      // Strip the fixed-position styling the page set inline, and any
      // stylesheet rule keyed on the id, by re-classing it as a rail item.
      el.className = "rail-item rail-tool";
      el.style.position = "static";
      el.style.bottom = "";
      el.style.right = "";
      el.style.left = "";
      el.style.width = "100%";
      el.style.boxShadow = "none";

      // Title only. The subtitles were removed from the Tools card on
      // 7 Aug 2026 - six two-line buttons in a narrow rail read as noise, and
      // the labels already say what each one is. tool.sub is left on the
      // objects rather than deleted, so restoring this is one line.
      el.innerHTML = '<span class="rail-title">' + tool.label + "</span>";
      host.appendChild(el);
      moved += 1;
    });

    // Nothing landed in the card, so do not leave an empty heading behind.
    if (!moved) {
      var card = host.closest ? host.closest(".rail-card") : null;
      if (card && card.parentNode) card.parentNode.removeChild(card);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", relocate);
  } else {
    relocate();
  }
})();
