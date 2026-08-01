/**
 * DTSC 520 - vocabulary flashcards.
 *
 * Deck comes from the notebook. `vocabulary()` in nbkit writes the terms into
 * cell metadata; the site generator copies that into a <script type="json"> on
 * the page. One source, so a definition edited in the notebook changes the card.
 *
 * Review model, and what it deliberately is not:
 *
 *   Cards you get wrong go to the BACK of this session's pile and come round
 *   again. Cards you get right leave the pile. Cards you mark known stay known
 *   across visits, so the deck shrinks as the term goes on.
 *
 *   It is not spaced repetition. Real SRS pays off with daily use; students
 *   touch a module page a handful of times a term, so the intervals would never
 *   be exercised and they would return to a wall of overdue cards. A shrinking
 *   deck plus an obvious "reset" is the honest version at this cadence.
 *
 * State is localStorage, keyed per module, and shaped as a plain list of known
 * terms so it can be POSTed to the existing `progress` backend later without
 * reworking anything here.
 */
(function () {
  "use strict";

  var KEY_PREFIX = "dtsc520.vocab.";
  var deck = [];         // every card in the module
  var pile = [];         // what is left this session
  var known = {};        // term -> true, persisted
  var idx = 0;
  var flipped = false;
  var storeKey = "vocab";
  var el = {};

  // ------------------------------------------------------------------ state
  function load() {
    try {
      var raw = localStorage.getItem(KEY_PREFIX + storeKey);
      (JSON.parse(raw || "[]") || []).forEach(function (t) { known[t] = true; });
    } catch (e) { /* private mode, or nothing saved */ }
  }

  function save() {
    try {
      localStorage.setItem(KEY_PREFIX + storeKey,
                           JSON.stringify(Object.keys(known)));
    } catch (e) { /* nothing we can do, and nothing that breaks */ }
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function startSession(includeKnown) {
    pile = shuffle(deck.filter(function (c) {
      return includeKnown || !known[c.term];
    }).slice());
    idx = 0;
    flipped = false;
    render();
  }

  // ----------------------------------------------------------------- render
  function render() {
    var total = deck.length;
    var knownCount = deck.filter(function (c) { return known[c.term]; }).length;

    el.count.textContent = total
      ? pile.length + " left · " + knownCount + " of " + total + " known"
      : "No terms for this module yet.";

    if (!pile.length) {
      el.term.textContent = knownCount === total && total
        ? "Deck clear. Every term marked known."
        : "Nothing left in this round.";
      el.def.textContent = "";
      el.card.classList.remove("flipped");
      el.face.textContent = "";
      el.again.disabled = true;
      el.got.disabled = true;
      el.knownBtn.disabled = true;
      return;
    }

    var card = pile[idx % pile.length];
    el.again.disabled = false;
    el.got.disabled = false;
    el.knownBtn.disabled = false;
    el.term.textContent = card.term;
    el.def.textContent = card.def;
    el.card.classList.toggle("flipped", flipped);
    el.face.textContent = flipped ? "definition" : "term";
    el.knownBtn.textContent = known[card.term] ? "Known ✓" : "Mark known";
  }

  function current() { return pile.length ? pile[idx % pile.length] : null; }

  function flip() { flipped = !flipped; render(); }

  function again() {
    // wrong: send it to the back of this session, so it comes round again
    if (!pile.length) return;
    var card = pile.splice(idx % pile.length, 1)[0];
    pile.push(card);
    flipped = false;
    render();
  }

  function got() {
    // right: out of the pile for this session, but not marked known
    if (!pile.length) return;
    pile.splice(idx % pile.length, 1);
    if (idx >= pile.length) idx = 0;
    flipped = false;
    render();
  }

  function markKnown() {
    var card = current();
    if (!card) return;
    if (known[card.term]) { delete known[card.term]; }
    else { known[card.term] = true; got(); }
    save();
    render();
  }

  // ------------------------------------------------------------------ build
  function buildModal() {
    var m = document.createElement("div");
    m.id = "cards-modal";
    m.setAttribute("role", "dialog");
    m.setAttribute("aria-modal", "true");
    m.setAttribute("aria-label", "Vocabulary flashcards");
    m.innerHTML =
      '<div class="cards-panel">' +
        '<div class="cards-head">' +
          '<h3>Vocabulary</h3>' +
          '<button class="cards-info" id="cardsInfo" type="button" ' +
            'aria-expanded="false" aria-controls="cardsHelp" ' +
            'aria-label="How the flashcards work" title="How the flashcards work">i</button>' +
          '<span class="cards-count" id="cardsCount"></span>' +
          '<button class="cards-close" id="cardsClose" aria-label="Close flashcards">×</button>' +
        '</div>' +
        '<div class="cards-help" id="cardsHelp" hidden>' +
          '<p><strong>Click the card</strong>, or press space, to turn it over.</p>' +
          '<dl>' +
            '<dt>Again</dt><dd>You did not know it. The card goes to the back and comes round again before the round ends.</dd>' +
            '<dt>Got it</dt><dd>Retires the card for this round only. It will be back next time you open the deck.</dd>' +
            '<dt>Mark known</dt><dd>Retires it for good, so the deck shrinks as the term goes on. Click again to un-mark.</dd>' +
          '</dl>' +
          '<p><strong>Reset deck</strong> clears every mark, which is what you want before a quiz. ' +
          '<strong>Review everything</strong> deals the whole set once without clearing anything.</p>' +
          '<p class="cards-help-note">Arrow keys answer, Escape closes. Progress is saved in this browser, ' +
          'so it will not follow you to another computer.</p>' +
        '</div>' +
        '<button class="cards-card" id="cardsCard" aria-live="polite">' +
          '<span class="cards-face" id="cardsFace"></span>' +
          '<span class="cards-term" id="cardsTerm"></span>' +
          '<span class="cards-def" id="cardsDef"></span>' +
          '<span class="cards-hint">click, or press space, to flip</span>' +
        '</button>' +
        '<div class="cards-controls">' +
          '<button class="cards-btn" id="cardsAgain">Again</button>' +
          '<button class="cards-btn cards-good" id="cardsGot">Got it</button>' +
          '<button class="cards-btn" id="cardsKnown">Mark known</button>' +
        '</div>' +
        '<div class="cards-foot">' +
          '<button class="cards-link" id="cardsReset">Reset deck</button>' +
          '<button class="cards-link" id="cardsAll">Review everything</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    return m;
  }

  function open() {
    el.modal.classList.add("open");
    document.body.style.overflow = "hidden";
    startSession(false);
  }

  function close() {
    el.modal.classList.remove("open");
    document.body.style.overflow = "";
  }

  function init() {
    var src = document.getElementById("vocabDeck");
    if (!src) return;
    try { deck = JSON.parse(src.textContent || "[]") || []; }
    catch (e) { deck = []; }

    var body = document.body.getAttribute("data-module");
    storeKey = body || (location.pathname.match(/module(\w+)/) || [])[1] || "x";

    el.modal = buildModal();
    el.card = document.getElementById("cardsCard");
    el.term = document.getElementById("cardsTerm");
    el.def = document.getElementById("cardsDef");
    el.face = document.getElementById("cardsFace");
    el.count = document.getElementById("cardsCount");
    el.again = document.getElementById("cardsAgain");
    el.got = document.getElementById("cardsGot");
    el.knownBtn = document.getElementById("cardsKnown");

    load();

    el.card.addEventListener("click", flip);
    el.again.addEventListener("click", again);
    el.got.addEventListener("click", got);
    el.knownBtn.addEventListener("click", markKnown);
    var info = document.getElementById("cardsInfo");
    var help = document.getElementById("cardsHelp");
    info.addEventListener("click", function () {
      var open = help.hasAttribute("hidden");
      if (open) { help.removeAttribute("hidden"); } else { help.setAttribute("hidden", ""); }
      info.setAttribute("aria-expanded", String(open));
      info.classList.toggle("open", open);
    });
    document.getElementById("cardsClose").addEventListener("click", close);
    document.getElementById("cardsReset").addEventListener("click", function () {
      known = {}; save(); startSession(false);
    });
    document.getElementById("cardsAll").addEventListener("click", function () {
      startSession(true);
    });
    el.modal.addEventListener("click", function (e) {
      if (e.target === el.modal) close();
    });
    document.addEventListener("keydown", function (e) {
      if (!el.modal.classList.contains("open")) return;
      if (e.key === "Escape") { close(); }
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
      else if (e.key === "ArrowRight") { got(); }
      else if (e.key === "ArrowLeft") { again(); }
    });

    var launcher = document.getElementById("cardsLaunch");
    if (launcher) launcher.addEventListener("click", open);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.dtscCards = { open: open, close: close };
})();
