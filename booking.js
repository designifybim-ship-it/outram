/* Outram Concrete & Asphalt Solutions Inc — booking.js
   Six-step booking tool. No backend: the finished booking opens in WhatsApp
   (or email). Progress is saved in localStorage. */
(function () {
  "use strict";

  var doc = document;
  var form = doc.getElementById("bk-form");
  var booker = doc.getElementById("booker");
  if (!form || !booker) return;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  var reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() { return !!(reduceMQ && reduceMQ.matches); }

  var WA_NUM = "12468223288";
  var EMAIL = "outrammixers@gmail.com";
  var STORE = "outram-booking-v3";
  var MAX_DAYS = 120;

  var SVC = {
    rental:    { name: "Mixer rental",       title: "Tell us about the rental",  sub: "How many mixers, for how long, and what you're building.", when: "Delivery date" },
    rto:       { name: "Rent-to-own",        title: "Tell us about your plans",  sub: "We'll go through the payments and terms with you.", when: "Delivery or chat date" },
    buy:       { name: "Buy a mixer",        title: "Tell us about your plans",  sub: "We'll send current prices on WhatsApp.", when: "Delivery or visit date" },
    service:   { name: "Servicing",          title: "About the mixer",           sub: "Regular maintenance to keep it running smoothly.", when: "Preferred visit date" },
    repair:    { name: "Mixer repair",       title: "What's wrong with it?",     sub: "Engine, drum and gear fixes to get it back on the job.", when: "Preferred visit date" },
    emergency: { name: "Emergency call-out", title: "What's wrong with it?",     sub: "If you're renting from us, stop using the mixer and we'll sort a replacement or extension.", when: "When do you need us?" },
    asphalt:   { name: "Asphalt repair",     title: "Join the asphalt waitlist", sub: "Asphalt repairs are coming soon. Tell us what needs fixing and we'll be in touch.", when: "Preferred quote visit (optional)" }
  };
  var WINDOWS = {
    m:  { label: "9 to 11 am",    start: 9,  end: 11 },
    lm: { label: "11 am to 1 pm", start: 11, end: 13 },
    a:  { label: "1 to 3 pm",     start: 13, end: 15 },
    la: { label: "3 to 5 pm",     start: 15, end: 17 }
  };
  var TIER = {
    "Christ Church": "80", "St. Philip": "80", "St. George": "80", "St. Michael": "80",
    "St. Thomas": "parts", "St. James": "parts", "St. Joseph": "parts", "St. John": "parts",
    "St. Lucy": "far", "St. Peter": "far", "St. Andrew": "far"
  };
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  /* ---------- state ---------- */
  var state = { step: 1, maxReached: 1, count: 1, date: "", viewY: 0, viewM: 0, ref: "", done: false, lastUrl: "", lastMsg: "" };

  function newRef() {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", s = "";
    var rnd = (window.crypto && window.crypto.getRandomValues) ? window.crypto.getRandomValues(new Uint32Array(4)) : null;
    for (var i = 0; i < 4; i++) s += chars.charAt((rnd ? rnd[i] : Math.floor(Math.random() * 1e9)) % chars.length);
    return "OUT-" + s;
  }

  /* ---------- date helpers (local time) ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function key(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function longDate(d) { return DAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }

  /* Easter Sunday: anonymous Gregorian algorithm (Meeus/Jones/Butcher) */
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }
  var holidayCache = {};
  function holidays(y) {
    if (holidayCache[y]) return holidayCache[y];
    var es = easter(y);
    var aug1 = new Date(y, 7, 1);
    var kadooment = addDays(aug1, (8 - aug1.getDay()) % 7);
    var list = [
      ["New Year's Day", new Date(y, 0, 1)],
      ["Errol Barrow Day", new Date(y, 0, 21)],
      ["Good Friday", addDays(es, -2)],
      ["Easter Monday", addDays(es, 1)],
      ["National Heroes Day", new Date(y, 3, 28)],
      ["May Day", new Date(y, 4, 1)],
      ["Whit Monday", addDays(es, 50)],
      ["Emancipation Day", aug1],
      ["Kadooment Day", kadooment],
      ["Independence Day", new Date(y, 10, 30)],
      ["Christmas Day", new Date(y, 11, 25)],
      ["Boxing Day", new Date(y, 11, 26)]
    ];
    var map = {};
    list.forEach(function (h) {
      var d = h[1];
      if (d.getDay() === 0) d = addDays(d, 1);           /* Sunday holiday: observed Monday */
      while (map[key(d)] || d.getDay() === 0) d = addDays(d, 1); /* clash: later one moves on */
      map[key(d)] = h[0];
    });
    holidayCache[y] = map;
    return map;
  }
  function holidayName(d) { return holidays(d.getFullYear())[key(d)] || ""; }

  /* ---------- form access ---------- */
  var F = form.elements;
  function val(name) { var el = F[name]; if (!el) return ""; return String(el.value || "").trim(); }
  function radio(name) { var el = $('input[name="' + name + '"]:checked', form); return el ? el.value : ""; }
  function checks(name) { return $$('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; }); }
  function isOn(name) { var el = F[name]; return !!(el && el.checked); }
  function svc() { return radio("svc"); }
  function svcInfo() { return SVC[svc()] || null; }
  function needsDelivery() { var s = svc(); return s === "rental" || s === "rto" || s === "buy"; }
  function asapOn() { return svc() === "emergency" && isOn("asap"); }

  /* ---------- text builders ---------- */
  function details() {
    var s = svc(), parts = [];
    if (s === "rental" || s === "rto" || s === "buy") parts.push(state.count + (state.count === 1 ? " mixer" : " mixers"));
    if (s === "rental" && radio("dur")) parts.push(radio("dur"));
    if ((s === "rental" || s === "rto" || s === "buy") && checks("build").length) parts.push(checks("build").join(", "));
    if ((s === "service" || s === "repair" || s === "emergency") && radio("whose")) parts.push(radio("whose"));
    if ((s === "repair" || s === "emergency") && checks("issue").length) parts.push(checks("issue").join(", "));
    if (s === "asphalt" && checks("asph").length) parts.push(checks("asph").join(", "));
    return parts.join(" \u00b7 ");
  }
  function whenLabel() { var i = svcInfo(); return i ? i.when.replace(" (optional)", "") : "When"; }
  function whenText() {
    if (asapOn()) return "As soon as possible";
    var parts = [];
    if (state.date) parts.push(longDate(fromKey(state.date)));
    var w = WINDOWS[radio("win")];
    if (w) parts.push(w.label);
    return parts.join(", ");
  }
  function siteText() { return [val("addr"), val("parish")].filter(Boolean).join(", "); }
  function estimate() {
    var p = val("parish");
    if (!p || !needsDelivery()) return null;
    var t = TIER[p];
    if (t === "80") return { price: "$80", line: "Standard delivery to your parish." + (p === "St. George" ? " That's where our base is." : "") };
    if (t === "parts") return { price: "$80 in parts", line: "$80 to many areas, up to $120 further out. We confirm when you book." };
    if (t === "far") return { price: "$80 to $120", line: "Exact price confirmed when you book." };
    return null;
  }
  function message() {
    var i = svcInfo();
    var est = estimate();
    var L = [];
    L.push("Hi Outram! I'd like to book: *" + (i ? i.name : "") + "*");
    L.push("Ref: " + state.ref);
    L.push("");
    if (details()) L.push("Details: " + details());
    if (whenText()) L.push(whenLabel() + ": " + whenText());
    if (siteText()) L.push("Site: " + siteText());
    if (est) L.push("Delivery estimate: " + est.price);
    if (val("access")) L.push("Access: " + val("access"));
    if (isOn("clear")) L.push("Mixer spot is clear for the haulers.");
    if (val("notes")) L.push("Notes: " + val("notes"));
    L.push("");
    if (val("name")) L.push("Name: " + val("name"));
    if (val("phone")) L.push("Phone: " + val("phone"));
    if (val("email")) L.push("Email: " + val("email"));
    if (radio("pref")) L.push("Best way to reach me: " + radio("pref"));
    L.push("");
    L.push("Please confirm the rate and availability. Thanks!");
    /* collapse accidental double blank lines */
    return L.join("\n").replace(/\n{3,}/g, "\n\n");
  }
  function waUrl() { return "https://wa.me/" + WA_NUM + "?text=" + encodeURIComponent(message()); }
  function mailUrl() {
    var i = svcInfo();
    return "mailto:" + EMAIL + "?subject=" + encodeURIComponent("Booking request " + state.ref + ": " + (i ? i.name : "")) + "&body=" + encodeURIComponent(message());
  }

  /* ---------- storage ---------- */
  function save() {
    if (state.done) return;
    try {
      var fields = {};
      $$("input,select,textarea", form).forEach(function (el) {
        if (!el.name) return;
        if (el.type === "radio") { if (el.checked) fields[el.name] = el.value; else if (!(el.name in fields)) fields[el.name] = fields[el.name] || ""; }
        else if (el.type === "checkbox") {
          var group = $$('input[type="checkbox"][name="' + el.name + '"]', form);
          if (group.length > 1) fields[el.name] = checks(el.name);
          else fields[el.name] = el.checked;
        } else fields[el.name] = el.value;
      });
      localStorage.setItem(STORE, JSON.stringify({ fields: fields, date: state.date, count: state.count, step: state.step, maxReached: state.maxReached, ref: state.ref, viewY: state.viewY, viewM: state.viewM }));
    } catch (e) { /* storage blocked: carry on without saving */ }
  }
  function load() {
    try { var raw = localStorage.getItem(STORE); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function clearStore() { try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ } }
  function applyFields(fields) {
    if (!fields) return;
    Object.keys(fields).forEach(function (name) {
      var v = fields[name];
      var els = $$('[name="' + name + '"]', form);
      els.forEach(function (el) {
        if (el.type === "radio") el.checked = (el.value === v);
        else if (el.type === "checkbox") el.checked = Array.isArray(v) ? v.indexOf(el.value) !== -1 : !!v;
        else if (typeof v === "string") el.value = v;
      });
    });
  }

  /* ---------- elements ---------- */
  var steps = $$(".bk-step", form);
  var progress = $$("#bk-progress li");
  var errEl = $("#bk-err");
  var backBtn = $("#bk-back"), nextBtn = $("#bk-next"), emailBtn = $("#bk-mail"), bar = $("#bk-bar");
  var doneEl = $("#bk-done");
  var calGrid = $("#cal-grid"), calMonth = $("#cal-month"), calPrev = $("#cal-prev"), calNext = $("#cal-next"), calKey = $("#cal-key");

  /* ---------- per-service UI ---------- */
  function applyService() {
    var s = svc(), info = svcInfo();
    $$("[data-for]", form).forEach(function (el) {
      el.hidden = !(s && el.getAttribute("data-for").split(" ").indexOf(s) !== -1);
    });
    if (info) {
      var dt = $("#d-title"), ds = $("#d-sub"), wt = $("#w-title");
      if (dt) dt.textContent = info.title;
      if (ds) ds.textContent = info.sub;
      if (wt) wt.textContent = info.when;
    }
    var asapRow = $("#asap-row");
    if (asapRow) asapRow.hidden = s !== "emergency";
    var addrOpt = $("#addr-opt");
    if (addrOpt) addrOpt.hidden = s !== "asphalt";
    if (calKey) calKey.textContent = "Sundays & public holidays closed \u00b7 Earliest: " + (s === "emergency" ? "today" : "tomorrow");
    /* a chosen date that is no longer allowed (e.g. today after leaving emergency) is cleared */
    if (state.date && !dayAllowed(fromKey(state.date))) state.date = "";
    applyAsap();
    renderEstimate();
    renderCal();
  }
  function applyAsap() {
    var pick = $("#when-pick");
    if (pick) pick.classList.toggle("dim", asapOn());
  }
  function renderEstimate() {
    var box = $("#estimate");
    if (!box) return;
    var est = estimate();
    box.hidden = !est;
    if (est) {
      $("#est-price").textContent = "Delivery: " + est.price;
      $("#est-line").textContent = est.line;
    }
  }

  /* ---------- calendar ---------- */
  function dayAllowed(d) {
    var t = today();
    if (d < t) return false;
    if (+d === +t && svc() !== "emergency") return false;
    if (d.getDay() === 0) return false;
    if (holidayName(d)) return false;
    if (d > addDays(t, MAX_DAYS)) return false;
    return true;
  }
  function renderCal() {
    if (!calGrid) return;
    var t = today();
    if (!state.viewY) { state.viewY = t.getFullYear(); state.viewM = t.getMonth(); }
    var first = new Date(state.viewY, state.viewM, 1);
    var minFirst = new Date(t.getFullYear(), t.getMonth(), 1);
    var maxD = addDays(t, MAX_DAYS);
    var maxFirst = new Date(maxD.getFullYear(), maxD.getMonth(), 1);
    if (first < minFirst) { first = minFirst; state.viewY = first.getFullYear(); state.viewM = first.getMonth(); }
    if (first > maxFirst) { first = maxFirst; state.viewY = first.getFullYear(); state.viewM = first.getMonth(); }
    calMonth.textContent = MONTHS[state.viewM] + " " + state.viewY;
    calPrev.disabled = +first <= +minFirst;
    calNext.disabled = +first >= +maxFirst;
    var html = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(function (d) { return '<span class="cal-dow" aria-hidden="true">' + d + "</span>"; }).join("");
    var lead = (first.getDay() + 6) % 7;
    for (var i = 0; i < lead; i++) html += '<span aria-hidden="true"></span>';
    var days = new Date(state.viewY, state.viewM + 1, 0).getDate();
    for (var dnum = 1; dnum <= days; dnum++) {
      var d = new Date(state.viewY, state.viewM, dnum);
      var k = key(d), hol = holidayName(d), ok = dayAllowed(d);
      var cls = "cal-day" + (+d === +t ? " today" : "") + (state.date === k ? " sel" : "");
      var label = longDate(d) + (hol ? ", " + hol + ", closed" : (d.getDay() === 0 ? ", closed" : (!ok ? ", not available" : "")));
      html += '<button type="button" class="' + cls + '" data-day="' + k + '"' + (ok ? "" : " disabled") +
        (hol ? ' title="' + hol + '"' : "") + ' aria-label="' + label + '"' + (state.date === k ? ' aria-pressed="true"' : ' aria-pressed="false"') + ">" + dnum + "</button>";
    }
    calGrid.innerHTML = html;
  }
  if (calPrev) calPrev.addEventListener("click", function () { state.viewM--; if (state.viewM < 0) { state.viewM = 11; state.viewY--; } renderCal(); save(); });
  if (calNext) calNext.addEventListener("click", function () { state.viewM++; if (state.viewM > 11) { state.viewM = 0; state.viewY++; } renderCal(); save(); });
  if (calGrid) calGrid.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("button[data-day]") : null;
    if (!b || b.disabled) return;
    state.date = b.getAttribute("data-day");
    renderCal();
    var again = $('button[data-day="' + state.date + '"]', calGrid);
    if (again) again.focus();
    clearErr();
    update();
  });

  /* ---------- stepper ---------- */
  var cMinus = $("#count-minus"), cPlus = $("#count-plus"), cOut = $("#count-out");
  function renderCount() {
    if (cOut) cOut.textContent = String(state.count);
    if (cMinus) cMinus.disabled = state.count <= 1;
    if (cPlus) cPlus.disabled = state.count >= 5;
  }
  if (cMinus) cMinus.addEventListener("click", function () { state.count = Math.max(1, state.count - 1); renderCount(); update(); });
  if (cPlus) cPlus.addEventListener("click", function () { state.count = Math.min(5, state.count + 1); renderCount(); update(); });

  /* ---------- summary ---------- */
  function setSum(id, text) {
    var li = doc.getElementById(id);
    if (!li) return;
    var span = $("div span", li);
    if (span) span.textContent = text || "\u2013";
    li.classList.toggle("empty", !text);
  }
  function renderSummary() {
    var i = svcInfo();
    var ref = $("#sum-ref");
    if (ref) ref.textContent = state.ref;
    setSum("sum-svc", i ? i.name : "");
    setSum("sum-det", details());
    setSum("sum-when", whenText());
    setSum("sum-site", siteText());
    setSum("sum-you", [val("name"), val("phone")].filter(Boolean).join(", "));
  }

  /* ---------- review ---------- */
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function renderReview() {
    var dl = $("#review");
    if (!dl) return;
    var i = svcInfo(), est = estimate();
    var site = siteText() + (val("access") ? "\nAccess: " + val("access") : "") + (isOn("clear") ? "\nMixer spot is clear for the haulers." : "");
    var you = [val("name"), val("phone"), val("email"), radio("pref") ? "Best way to reach you: " + radio("pref") : ""].filter(Boolean).join("\n");
    var rows = [
      ["Service", i ? i.name : "", 1],
      ["Details", details(), 2],
      [whenLabel(), whenText(), 3],
      ["Site", site.trim(), 4]
    ];
    if (est) rows.push(["Delivery estimate", est.price, 4]);
    rows.push(["Notes", val("notes"), 2]);
    rows.push(["You", you, 5]);
    dl.innerHTML = rows.map(function (r) {
      return '<div class="row"><dt>' + esc(r[0]) + "</dt><dd>" + esc(r[1] || "\u2013") + '</dd><button type="button" class="edit" data-edit="' + r[2] + '" aria-label="Edit ' + esc(r[0]) + '">Edit</button></div>';
    }).join("");
  }
  var reviewDl = $("#review");
  if (reviewDl) reviewDl.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-edit]") : null;
    if (b) go(parseInt(b.getAttribute("data-edit"), 10));
  });

  /* ---------- validation ---------- */
  function clearErr() {
    if (errEl) errEl.textContent = "";
    $$(".bad", form).forEach(function (el) { el.classList.remove("bad"); });
  }
  function markBad(fname) {
    var f = $('.bk-field[data-f="' + fname + '"]', form);
    if (f) f.classList.add("bad");
    return f;
  }
  /* returns "" when the step is fine, otherwise the error message (and marks fields unless silent) */
  function check(n, silent) {
    var s = svc();
    if (n === 1) return s ? "" : "Choose a service to continue.";
    if (n === 2) {
      if (s === "rental" && !radio("dur")) return "Choose how long you need the mixer.";
      if ((s === "service" || s === "repair" || s === "emergency") && !radio("whose")) return "Tell us whose mixer it is.";
      return "";
    }
    if (n === 3) {
      if (asapOn() || s === "asphalt") return "";
      if (!state.date || !dayAllowed(fromKey(state.date))) return "Pick a date on the calendar.";
      if (!radio("win")) return "Pick a time window.";
      return "";
    }
    if (n === 4) {
      var bad4 = [];
      if (!val("parish")) bad4.push("parish");
      if (s !== "asphalt" && !val("addr")) bad4.push("addr");
      if (bad4.length) { if (!silent) bad4.forEach(markBad); return "Fill in the highlighted fields."; }
      return "";
    }
    if (n === 5) {
      var bad5 = [];
      if (!val("name")) bad5.push("name");
      if (val("phone").replace(/\D/g, "").length < 7) bad5.push("phone");
      if (val("email") && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val("email"))) bad5.push("email");
      if (bad5.length) { if (!silent) bad5.forEach(markBad); return "Fill in the highlighted fields."; }
      if (!isOn("agree")) { if (!silent) { var r = $("#agree-row"); if (r) r.classList.add("bad"); } return "Tick the box to confirm you understand how booking works."; }
      return "";
    }
    return "";
  }
  function firstBad(scope) {
    var el = $(".bad input, .bad select, .bad textarea, .check.bad input", scope);
    if (el) el.focus();
  }

  /* ---------- navigation ---------- */
  function go(n, opts) {
    opts = opts || {};
    n = Math.max(1, Math.min(6, n));
    state.step = n;
    if (n > state.maxReached) state.maxReached = n;
    if (!opts.keepErr) clearErr();
    render();
    save();
    if (opts.noScroll) return;
    var top = booker.getBoundingClientRect().top;
    if (top < 0) booker.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
    var cur = steps[n - 1];
    var h = cur ? $("h2", cur) : null;
    if (h && opts.focus !== false) { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
    if (cur && window.outramIcons) window.outramIcons.replayIn(cur);
  }
  function render() {
    steps.forEach(function (st, k) { st.hidden = state.done || (k + 1) !== state.step; });
    progress.forEach(function (li, k) {
      var n = k + 1, btn = $("button", li);
      var isDone = state.done || (n < state.maxReached && n !== state.step) || n < state.step;
      li.classList.toggle("current", !state.done && n === state.step);
      li.classList.toggle("done", isDone);
      if (btn) {
        btn.disabled = state.done || !isDone;
        if (!state.done && n === state.step) btn.setAttribute("aria-current", "step"); else btn.removeAttribute("aria-current");
      }
    });
    if (doneEl) doneEl.hidden = !state.done;
    if (bar) bar.hidden = state.done;
    if (backBtn) backBtn.hidden = state.step === 1;
    var last = state.step === 6;
    if (emailBtn) { emailBtn.hidden = !last; if (last) emailBtn.href = mailUrl(); }
    if (nextBtn) nextBtn.innerHTML = last ? "Send on WhatsApp &rsaquo;" : "Continue &rsaquo;";
    if (last) renderReview();
    renderSummary();
  }
  progress.forEach(function (li) {
    var btn = $("button", li);
    if (btn) btn.addEventListener("click", function () { if (!btn.disabled) go(parseInt(li.getAttribute("data-go"), 10)); });
  });
  if (backBtn) backBtn.addEventListener("click", function () { go(state.step - 1); });

  function finalCheck() {
    for (var n = 1; n <= 5; n++) {
      var msg = check(n, true);
      if (msg) {
        go(n, { keepErr: true });
        check(n, false);
        if (errEl) errEl.textContent = msg;
        firstBad(steps[n - 1]);
        return false;
      }
    }
    return true;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.step < 6) {
      clearErr();
      var msg = check(state.step, false);
      if (msg) { if (errEl) errEl.textContent = msg; firstBad(steps[state.step - 1]); return; }
      go(state.step + 1);
      return;
    }
    if (!finalCheck()) return;
    var url = waUrl();
    window.open(url, "_blank", "noopener");
    finish(url);
  });
  if (emailBtn) emailBtn.addEventListener("click", function (e) {
    if (!finalCheck()) { e.preventDefault(); return; }
    emailBtn.href = mailUrl();
  });

  /* ---------- done ---------- */
  var lastBooking = null;
  function finish(url) {
    lastBooking = { url: url, ref: state.ref, svc: svcInfo() ? svcInfo().name : "", date: state.date, win: asapOn() ? "" : radio("win"), site: siteText() };
    state.done = true;
    clearStore();
    var m = $("#done-msg");
    if (m) m.textContent = "Thanks! Your request " + state.ref + " is on its way to us on WhatsApp. If WhatsApp didn't open, tap the button below, or call 246-822-3288.";
    var wa = $("#done-wa");
    if (wa) wa.href = url;
    var ics = $("#done-ics");
    if (ics) ics.hidden = !lastBooking.date;
    render();
    var h = doneEl ? $("h2", doneEl) : null;
    if (h) { try { h.focus({ preventScroll: true }); } catch (err) { h.focus(); } }
    if (booker.getBoundingClientRect().top < 0) booker.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
    if (doneEl && window.outramIcons) window.outramIcons.replayIn(doneEl);
  }
  function icsEsc(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function icsStamp(d) { return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z"; }
  function downloadIcs() {
    var b = lastBooking;
    if (!b || !b.date) return;
    var day = b.date.replace(/-/g, "");
    var w = WINDOWS[b.win];
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Outram Concrete & Asphalt Solutions Inc//Booking//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
      "UID:" + b.ref + "-" + Date.now() + "@outram", "DTSTAMP:" + icsStamp(new Date())];
    if (w) {
      lines.push("DTSTART:" + day + "T" + pad(w.start) + "0000");
      lines.push("DTEND:" + day + "T" + pad(w.end) + "0000");
    } else {
      var next = key(addDays(fromKey(b.date), 1)).replace(/-/g, "");
      lines.push("DTSTART;VALUE=DATE:" + day);
      lines.push("DTEND;VALUE=DATE:" + next);
    }
    lines.push("SUMMARY:" + icsEsc("Outram: " + b.svc + " (awaiting confirmation)"));
    if (b.site) lines.push("LOCATION:" + icsEsc(b.site));
    lines.push("DESCRIPTION:" + icsEsc("Ref " + b.ref + ". Outram will confirm on WhatsApp. Questions? 246-822-3288"));
    lines.push("END:VEVENT", "END:VCALENDAR");
    var blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
    var a = doc.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "outram-" + b.ref + ".ics";
    doc.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  var icsBtn = $("#done-ics");
  if (icsBtn) icsBtn.addEventListener("click", downloadIcs);
  var newBtn = $("#done-new");
  if (newBtn) newBtn.addEventListener("click", function () {
    form.reset();
    state = { step: 1, maxReached: 1, count: 1, date: "", viewY: 0, viewM: 0, ref: newRef(), done: false };
    clearStore();
    renderCount();
    applyService();
    go(1);
  });

  /* ---------- live updates ---------- */
  function update() {
    renderSummary();
    if (state.step === 6) { renderReview(); if (emailBtn) emailBtn.href = mailUrl(); }
    save();
  }
  form.addEventListener("change", function (e) {
    var t = e.target;
    if (t.name === "svc") {
      applyService();
      clearErr();
      if (state.step === 1) setTimeout(function () { if (state.step === 1 && svc()) go(2); }, 180);
    }
    if (t.name === "asap") applyAsap();
    if (t.name === "parish") renderEstimate();
    if (t.name === "agree") { var r = $("#agree-row"); if (r) r.classList.remove("bad"); }
    if (t.name === "win" || t.name === "dur" || t.name === "whose") { if (errEl) errEl.textContent = ""; }
    update();
  });
  form.addEventListener("input", function (e) {
    var f = e.target.closest ? e.target.closest(".bk-field") : null;
    if (f) f.classList.remove("bad");
    update();
  });

  /* ---------- start ---------- */
  var saved = load();
  if (saved) {
    applyFields(saved.fields);
    state.date = saved.date || "";
    state.count = Math.max(1, Math.min(5, parseInt(saved.count, 10) || 1));
    state.step = Math.max(1, Math.min(6, parseInt(saved.step, 10) || 1));
    state.maxReached = Math.max(state.step, Math.min(6, parseInt(saved.maxReached, 10) || 1));
    state.viewY = saved.viewY || 0;
    state.viewM = saved.viewM || 0;
    state.ref = /^OUT-[A-Z0-9]{4}$/.test(saved.ref || "") ? saved.ref : newRef();
  } else {
    state.ref = newRef();
  }
  if (!svc()) { state.step = 1; state.maxReached = 1; }

  /* URL parameters win over saved progress */
  var params;
  try { params = new URLSearchParams(window.location.search); } catch (e) { params = null; }
  if (params) {
    var p = params.get("svc");
    if (p && SVC[p]) {
      var r = $('input[name="svc"][value="' + p + '"]', form);
      if (r) { r.checked = true; state.step = 2; state.maxReached = Math.max(2, state.maxReached); }
    }
    var par = params.get("parish");
    if (par && F.parish) {
      var match = Array.prototype.filter.call(F.parish.options, function (o) { return o.value === par; })[0];
      if (match) F.parish.value = par;
    }
    if ((p || par) && window.history && window.history.replaceState) {
      try { window.history.replaceState(null, "", window.location.pathname + window.location.hash); } catch (e) { /* ignore */ }
    }
  }

  renderCount();
  applyService();
  go(state.step, { noScroll: true });
})();
