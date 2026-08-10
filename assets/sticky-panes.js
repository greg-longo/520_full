/* ---------------------------------------------------------------------------
   Keep the Contents and rail panes inside the viewport at every scroll offset.

   THE BUG THIS FIXES.

   Both panes are `position: sticky; top: 70px; max-height: calc(100vh - 92px)`.
   That height is only correct once the pane has actually stuck. At the top of
   the page the pane's top sits below the banner - 300px down or more - so
   300 + (100vh - 92px) runs well past the bottom of the screen. The pane's own
   scrollbar is down there off-screen, which is why the bottom of the Contents
   list and the bottom of the rail could not be reached until the page had been
   scrolled far enough for the pane to stick.

   CSS cannot express "the space actually left below me" - there is no unit for
   an element's own viewport offset - so the height has to be measured. This
   sets a custom property the stylesheet consumes, on scroll and on resize.

   Cheap by construction: rAF-throttled, and it only ever writes a string when
   the value has changed, so an idle scroll costs one getBoundingClientRect per
   frame and nothing else.
--------------------------------------------------------------------------- */
(function () {
  "use strict";

  var GAP = 22;              // breathing room below the pane, matches the old 92-70
  var panes = [];
  var queued = false;
  var last = {};

  function measure() {
    queued = false;
    panes.forEach(function (el, i) {
      var top = el.getBoundingClientRect().top;
      /* Clamp the floor so a pane never collapses to nothing on a short
         viewport - better to overflow slightly than to vanish. */
      var avail = Math.max(180, window.innerHeight - Math.max(top, 0) - GAP);
      var val = Math.round(avail) + "px";
      if (last[i] !== val) {
        last[i] = val;
        el.style.setProperty("--pane-max", val);
      }
    });
  }

  function onScroll() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(measure);
  }

  function init() {
    panes = Array.prototype.slice.call(
      document.querySelectorAll(".toc-col, .rail-col"));
    if (!panes.length) return;
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    /* The rail and the ToC are populated by other scripts, and the search box
       is inserted after load - all of which change the pane's height. Remeasure
       once things have settled rather than trusting the first frame. */
    setTimeout(measure, 60);
    setTimeout(measure, 400);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
