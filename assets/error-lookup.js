/**
 * DTSC 520 - parse a pasted traceback and look it up.
 *
 * Parsing rule, which is also the thing Module 2 tells students to do:
 * READ FROM THE BOTTOM. The last non-blank line of a traceback is the error;
 * everything above it is the route Python took to get there. So the parser
 * scans upward for the first line matching `ExceptionType: message`.
 *
 * Exposed as window.DTSCErrors so the page and the tests share one code path.
 */
(function () {
  "use strict";

  var TYPE_LINE = /^\s*([A-Za-z_][A-Za-z0-9_.]*(?:Error|Exception|Warning|Interrupt))\s*:\s*([\s\S]*)$/;

  /**
   * Pull the exception type and message out of pasted text.
   * Accepts a whole traceback, or just the last line, or a bare type name.
   */
  function parse(text) {
    if (!text) return null;
    var lines = String(text).replace(/\r/g, "").split("\n");

    // bottom up: the error is the last thing Python printed
    for (var i = lines.length - 1; i >= 0; i--) {
      var line = lines[i].trim();
      if (!line) continue;
      var m = line.match(TYPE_LINE);
      if (m) {
        return {
          type: m[1].split(".").pop(),   // pandas.errors.X -> X
          message: m[2].trim(),
          line: line
        };
      }
      // a bare type name on its own, e.g. someone typed "KeyError"
      if (/^[A-Za-z_][A-Za-z0-9_]*(Error|Exception)$/.test(line)) {
        return { type: line, message: "", line: line };
      }
    }
    return null;
  }

  /** Which file and line Python blamed, if the traceback includes it. */
  function locate(text) {
    var hits = String(text || "").match(/File "([^"]+)", line (\d+)/g);
    if (!hits || !hits.length) return null;
    var last = hits[hits.length - 1].match(/File "([^"]+)", line (\d+)/);
    return { file: last[1], line: last[2] };
  }

  /**
   * Look up an entry and rank its causes against the message.
   * A cause with a `sig` that matches comes first; the catch-all is last and is
   * only dropped if something more specific matched.
   */
  function explain(parsed) {
    if (!parsed) return null;
    var kb = window.DTSC_ERROR_KB || {};
    var entry = kb[parsed.type];
    if (!entry) {
      return { known: false, type: parsed.type, message: parsed.message };
    }
    var matched = [], fallback = [];
    entry.causes.forEach(function (c) {
      if (c.sig && c.sig.test(parsed.message)) matched.push(c);
      else if (!c.sig) fallback.push(c);
    });
    return {
      known: true,
      type: parsed.type,
      message: parsed.message,
      headline: entry.headline,
      where: entry.where,
      causes: matched.length ? matched : fallback,
      // when something specific matched, the general advice is still worth
      // keeping but should not lead
      also: matched.length ? fallback : []
    };
  }

  window.DTSCErrors = { parse: parse, locate: locate, explain: explain };
})();
