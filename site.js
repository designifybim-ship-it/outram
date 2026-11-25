/* Outram Concrete & Asphalt Solutions Inc — site.js
   Shared behaviour for every page. Every lookup is guarded, so a page
   without a given element simply skips that feature. */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  root.classList.add("js");

  var reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() { return !!(reduceMQ && reduceMQ.matches); }
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  var hasIO = "IntersectionObserver" in window;

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }
  window.outramToast = toast;

  /* ---------- Year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Header: stuck on scroll ---------- */
  var header = $(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("stuck", window.scrollY > 10); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Mobile menu ---------- */
  var burger = $("#burger");
  var nav = $("#site-nav");
  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") !== "true";
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      nav.classList.toggle("open", open);
    });
  }

  /* ---------- More dropdown ---------- */
  var moreBtn = $(".more-btn");
  var moreMenu = moreBtn ? doc.getElementById(moreBtn.getAttribute("aria-controls")) : null;
  function setMore(open) {
    if (!moreBtn || !moreMenu) return;
    moreBtn.setAttribute("aria-expanded", String(open));
    moreMenu.hidden = !open;
  }
  if (moreBtn && moreMenu) {
    moreBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      setMore(moreBtn.getAttribute("aria-expanded") !== "true");
    });
    doc.addEventListener("click", function (e) {
      if (!moreMenu.hidden && !moreMenu.contains(e.target) && e.target !== moreBtn) setMore(false);
    });
  }
  doc.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (moreBtn && moreBtn.getAttribute("aria-expanded") === "true") { setMore(false); moreBtn.focus(); }
    if (burger && nav && nav.classList.contains("open")) {
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Open menu");
      nav.classList.remove("open");
      burger.focus();
    }
  });

  /* ---------- Animated icons ---------- */
  function replay(svg) {
    if (!svg || reduced() || doc.hidden) return;
    svg.classList.remove("play");
    svg.getBoundingClientRect();
    svg.classList.add("play");
  }
  var visibleIcons = new Set();
  var cycleOffset = 0;
  var iconIO = null;
  function watchIcons(scope) {
    var icons = $$("svg.ai", scope || doc);
    if (!icons.length || reduced()) return;
    if (!hasIO) return;
    if (!iconIO) {
      iconIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var svg = en.target;
          if (en.isIntersecting) {
            visibleIcons.add(svg);
            if (!svg.dataset.played) {
              svg.dataset.played = "1";
              setTimeout(function () { replay(svg); }, 150);
            }
          } else {
            visibleIcons.delete(svg);
          }
        });
      }, { threshold: 0.4 });
    }
    icons.forEach(function (svg) {
      if (svg.dataset.watched) return;
      svg.dataset.watched = "1";
      iconIO.observe(svg);
    });
  }
  watchIcons();
  if (!reduced()) {
    setInterval(function () {
      if (doc.hidden || !visibleIcons.size) return;
      var list = Array.from(visibleIcons).filter(function (s) { return s.isConnected; });
      if (!list.length) return;
      var n = Math.min(8, list.length);
      if (cycleOffset >= list.length) cycleOffset = 0;
      for (var i = 0; i < n; i++) {
        (function (svg, d) { setTimeout(function () { replay(svg); }, d); })(list[(cycleOffset + i) % list.length], i * 220);
      }
      cycleOffset += n;
    }, 4500);
  }
  var HOVER_SEL = ".card,.tcard,.parish,.proj,.tip,.box,.step,.opt,.chip,.float-card,.ft-contact,.call-block,.mini-stat,.g-tile,.rev,a,button,li";
  doc.addEventListener("mouseover", function (e) {
    if (reduced()) return;
    var host = e.target.closest ? e.target.closest(HOVER_SEL) : null;
    if (!host) return;
    if (e.relatedTarget && host.contains(e.relatedTarget)) return;
    $$("svg.ai", host).slice(0, 4).forEach(replay);
  });
  window.outramIcons = {
    replay: replay,
    replayIn: function (scope) { if (scope) $$("svg.ai", scope).forEach(function (s, i) { setTimeout(function () { replay(s); }, 120 + i * 60); }); },
    watch: watchIcons
  };

  /* ---------- Scroll reveal ---------- */
  var revealEls = $$(".reveal");
  if (revealEls.length) {
    revealEls.forEach(function (el) {
      var sibs = el.parentElement ? Array.prototype.filter.call(el.parentElement.children, function (c) { return c.classList.contains("reveal"); }) : [el];
      var idx = Math.min(sibs.indexOf(el), 5);
      if (idx > 0) el.style.setProperty("--rd", (idx * 90) + "ms");
    });
    var showAll = function () { revealEls.forEach(function (el) { el.classList.add("in"); }); };
    if (!hasIO || reduced()) {
      showAll();
    } else {
      var rIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("in"); rIO.unobserve(en.target); }
        });
      }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });
      revealEls.forEach(function (el) { rIO.observe(el); });
      /* safety net for fast scrolling and anchor jumps: anything above the fold bottom is shown */
      var ticking = false;
      var sweep = function () {
        ticking = false;
        var h = window.innerHeight;
        revealEls.forEach(function (el) {
          if (el.classList.contains("in")) return;
          if (el.getBoundingClientRect().top < h) { el.classList.add("in"); rIO.unobserve(el); }
        });
      };
      window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(sweep); } }, { passive: true });
      window.addEventListener("load", sweep);
      window.addEventListener("hashchange", function () { setTimeout(sweep, 60); });
      setTimeout(sweep, 400);
    }
  }

  /* ---------- Count-up stats ---------- */
  var counters = $$("[data-count]");
  if (counters.length) {
    var runCount = function (el) {
      var end = parseFloat(el.getAttribute("data-count")) || 0;
      if (reduced()) { el.textContent = String(end); return; }
      var start = null, dur = 1300;
      var step = function (ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(end * eased));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!hasIO || reduced()) {
      counters.forEach(function (el) { el.textContent = el.getAttribute("data-count"); });
    } else {
      counters.forEach(function (el) { el.textContent = "0"; });
      var cIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { runCount(en.target); cIO.unobserve(en.target); }
        });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { cIO.observe(el); });
    }
  }

  /* ---------- Testimonial carousel ---------- */
  var tStage = $(".t-stage");
  if (tStage) {
    var slides = $$(".t-slide", tStage);
    var dots = $$(".t-dots button");
    var cur = 0, tTimer = null;
    var show = function (i, fromUser) {
      if (!slides.length) return;
      i = (i + slides.length) % slides.length;
      if (i === cur && !fromUser) return;
      var out = slides[cur];
      var inn = slides[i];
      var swap = function () {
        slides.forEach(function (s, k) { s.hidden = k !== i; s.classList.remove("fade"); });
        dots.forEach(function (d, k) { d.setAttribute("aria-current", k === i ? "true" : "false"); });
        cur = i;
        if (inn) {
          inn.classList.add("fade");
          requestAnimationFrame(function () { requestAnimationFrame(function () { inn.classList.remove("fade"); }); });
          window.outramIcons.replayIn(inn);
        }
      };
      if (reduced() || !out || out === inn) { swap(); return; }
      out.classList.add("fade");
      setTimeout(swap, 420);
    };
    var startT = function () {
      stopT();
      if (reduced() || slides.length < 2) return;
      tTimer = setInterval(function () { if (!doc.hidden) show(cur + 1); }, 7000);
    };
    var stopT = function () { if (tTimer) { clearInterval(tTimer); tTimer = null; } };
    dots.forEach(function (d, k) { d.addEventListener("click", function () { show(k, true); startT(); }); });
    doc.addEventListener("visibilitychange", function () { if (doc.hidden) stopT(); else startT(); });
    startT();
  }

  /* ---------- WhatsApp message forms ---------- */
  $$("form.wa-form").forEach(function (form) {
    var link = $(".wa-send", form);
    var val = function (name) {
      var el = form.elements[name];
      return el && el.value ? String(el.value).trim() : "";
    };
    var build = function () {
      var name = [val("first"), val("last")].filter(Boolean).join(" ");
      var parts = ["Hi Outram, my name is " + (name || "...") + "."];
      if (val("need")) parts.push("I need: " + val("need") + ".");
      if (val("parish")) parts.push("Parish: " + val("parish") + ".");
      if (val("phone")) parts.push("Phone: " + val("phone") + ".");
      if (val("email")) parts.push("Email: " + val("email") + ".");
      if (val("msg")) parts.push("Details: " + val("msg"));
      return "https://wa.me/12468223288?text=" + encodeURIComponent(parts.join(" "));
    };
    var update = function () { if (link) link.href = build(); };
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      update();
      window.open(build(), "_blank", "noopener");
    });
    update();
  });

  /* ---------- Copy buttons ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = doc.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        doc.body.appendChild(ta);
        ta.select();
        var ok = doc.execCommand("copy");
        doc.body.removeChild(ta);
        if (ok) { resolve(); } else { reject(new Error("copy failed")); }
      } catch (err) { reject(err); }
    });
  }
  $$("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy") || "";
      copyText(text).then(function () { toast("Copied: " + text); }, function () { toast("Couldn't copy. Please copy it by hand: " + text); });
    });
  });

  /* ---------- Gallery lightbox ---------- */
  var lb = $("#lightbox");
  var photoTiles = $$("button.g-tile[data-full]");
  if (lb && photoTiles.length) {
    var lbImg = $("img", lb), lbCap = $("figcaption", lb), lbIdx = 0;
    var openAt = function (i) {
      lbIdx = (i + photoTiles.length) % photoTiles.length;
      var t = photoTiles[lbIdx];
      if (lbImg) { lbImg.src = t.getAttribute("data-full"); lbImg.alt = t.getAttribute("data-alt") || ""; }
      if (lbCap) lbCap.textContent = t.getAttribute("data-caption") || "";
      if (!lb.open) {
        if (typeof lb.showModal === "function") { lb.showModal(); }
        else { window.open(t.getAttribute("data-full"), "_blank", "noopener"); }
      }
    };
    photoTiles.forEach(function (t, i) { t.addEventListener("click", function () { openAt(i); }); });
    var closeBtn = $(".lb-close", lb);
    if (closeBtn) closeBtn.addEventListener("click", function () { lb.close(); });
    lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); openAt(lbIdx + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); openAt(lbIdx - 1); }
    });
  }

  /* ---------- Homepage video ---------- */
  $$(".vid-wrap").forEach(function (wrap) {
    var video = $("video", wrap);
    var btn = $(".vplay", wrap);
    if (!video || !btn) return;
    btn.addEventListener("click", function () {
      video.controls = true;
      wrap.classList.add("playing");
      var p = video.play();
      if (p && typeof p.catch === "function") p.catch(function () { /* playback blocked: controls stay visible */ });
    });
    video.addEventListener("ended", function () {
      wrap.classList.remove("playing");
      video.controls = false;
      try { video.currentTime = 0; } catch (e) { /* ignore */ }
      video.load();
    });
  });

  /* ---------- Rent page: mixer hotspots ---------- */
  var spot = $(".spot");
  if (spot) {
    var hs = $$(".hs", spot);
    var items = $$(".spot-list li[data-hs]", spot);
    var active = -1, spotTimer = null, hovering = false;
    var setOn = function (i) {
      active = i;
      hs.forEach(function (b, k) { b.classList.toggle("on", k === i); b.setAttribute("aria-pressed", k === i ? "true" : "false"); });
      items.forEach(function (li, k) {
        li.classList.toggle("on", k === i);
        if (k === i) window.outramIcons.replayIn(li);
      });
    };
    var bind = function (el, i) {
      el.addEventListener("mouseenter", function () { setOn(i); });
      el.addEventListener("focus", function () { setOn(i); });
      el.addEventListener("click", function () { setOn(i); });
    };
    hs.forEach(function (b, i) { bind(b, i); });
    items.forEach(function (li, i) {
      bind(li, i);
      li.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOn(i); } });
    });
    spot.addEventListener("mouseenter", function () { hovering = true; });
    spot.addEventListener("mouseleave", function () { hovering = false; });
    if (!reduced() && items.length) {
      spotTimer = setInterval(function () {
        if (hovering || doc.hidden) return;
        if (spot.contains(doc.activeElement)) return;
        setOn((active + 1) % items.length);
      }, 2600);
    }
    setOn(0);
  }
})();
