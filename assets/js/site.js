/* =========================================================================
   Naqsh Carpets — site behaviour
   No dependencies. Cart persists in localStorage, checkout opens WhatsApp.
   ========================================================================= */
(function () {
  'use strict';

  var CFG = window.NAQSH || {};
  var WA = CFG.whatsapp || '971547313774';
  var CUR = CFG.currency || 'AED';
  var LANG = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  var KEY = 'naqsh.cart.v1';

  var T = {
    en: {
      added: 'Added to your cart', removed: 'Removed', empty: 'Your cart is empty',
      emptyHint: 'Browse our collections to begin.', subtotal: 'Subtotal',
      delivery: 'Delivery', free: 'Free', total: 'Total', remove: 'Remove',
      order: 'Order on WhatsApp', shop: 'Shop rugs', qty: 'Qty',
      pick: 'Please choose a size first', copied: 'Link copied',
      intro: 'Hello Naqsh Carpets, I would like to order:',
      outro: 'Please confirm availability and delivery.'
    },
    ar: {
      added: 'أُضيفت إلى السلة', removed: 'حُذفت', empty: 'سلتك فارغة',
      emptyHint: 'تصفّح مجموعاتنا للبدء.', subtotal: 'المجموع الفرعي',
      delivery: 'التوصيل', free: 'مجاني', total: 'الإجمالي', remove: 'حذف',
      order: 'اطلب عبر واتساب', shop: 'تسوّق السجاد', qty: 'الكمية',
      pick: 'يُرجى اختيار المقاس أولًا', copied: 'تم نسخ الرابط',
      intro: 'السلام عليكم، أرغب في طلب ما يلي من نقش للسجاد:',
      outro: 'يُرجى تأكيد التوفر والتوصيل.'
    }
  }[LANG];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function money(n) {
    try {
      return CUR + ' ' + Number(n).toLocaleString(LANG === 'ar' ? 'ar-AE' : 'en-AE');
    } catch (e) { return CUR + ' ' + n; }
  }

  /* ------------------------------------------------------------- storage */
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    paint();
  }

  /* ------------------------------------------------------------- toast */
  var toastEl;
  var toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2600);
  }

  /* ------------------------------------------------------------- cart */
  function add(item) {
    var items = read();
    var found = null;
    items.forEach(function (i) {
      if (i.sku === item.sku && i.size === item.size) { found = i; }
    });
    if (found) { found.qty += item.qty; }
    else { items.push(item); }
    write(items);
    toast(T.added);
    open();
  }

  function setQty(i, q) {
    var items = read();
    if (!items[i]) { return; }
    if (q <= 0) { items.splice(i, 1); toast(T.removed); }
    else { items[i].qty = q; }
    write(items);
  }

  function paint() {
    var items = read();
    var count = items.reduce(function (a, i) { return a + i.qty; }, 0);
    $$('.cart-n').forEach(function (b) {
      b.textContent = count;
      b.classList.toggle('on', count > 0);
    });

    var body = $('#cart-body');
    if (!body) { return; }

    if (!items.length) {
      body.innerHTML = '<div class="empty"><svg class="ic" aria-hidden="true"><use href="#i-cart"></use></svg>' +
        '<p><b>' + T.empty + '</b></p><p class="note">' + T.emptyHint + '</p>' +
        '<a class="btn btn-s btn-sm" href="' + (CFG.shopUrl || '/rugs/') + '">' + T.shop + '</a></div>';
      $('#cart-foot').hidden = true;
      return;
    }

    var html = '';
    var sub = 0;
    items.forEach(function (it, idx) {
      sub += it.price * it.qty;
      html += '<div class="ci">' +
        '<div class="ci-img">' + (it.art || '') + '</div>' +
        '<div><b>' + esc(it.name) + '</b><small>' + esc(it.size) + ' · ' + T.qty + ' ' + it.qty + '</small>' +
        '<div style="display:flex;gap:.5rem;align-items:center;margin-top:.45rem">' +
        '<div class="qty"><button type="button" data-q="' + idx + '" data-d="-1" aria-label="-">' +
        '<svg class="ic" aria-hidden="true"><use href="#i-minus"></use></svg></button>' +
        '<input type="number" min="1" value="' + it.qty + '" data-qi="' + idx + '" aria-label="' + T.qty + '">' +
        '<button type="button" data-q="' + idx + '" data-d="1" aria-label="+">' +
        '<svg class="ic" aria-hidden="true"><use href="#i-plus"></use></svg></button></div></div>' +
        '<button class="ci-x" type="button" data-rm="' + idx + '">' +
        '<svg class="ic" aria-hidden="true" style="width:13px;height:13px"><use href="#i-close"></use></svg>' +
        T.remove + '</button></div>' +
        '<div class="ci-p">' + money(it.price * it.qty) + '</div></div>';
    });
    body.innerHTML = html;

    $('#cart-foot').hidden = false;
    $('#cart-sub').textContent = money(sub);
    $('#cart-tot').textContent = money(sub);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ------------------------------------------------------------- whatsapp */
  function waOrder() {
    var items = read();
    if (!items.length) { return; }
    var lines = [T.intro, ''];
    var sub = 0;
    items.forEach(function (it, n) {
      sub += it.price * it.qty;
      lines.push((n + 1) + '. ' + it.name);
      lines.push('   ' + it.sku + ' | ' + it.size + ' | x' + it.qty + ' | ' + money(it.price * it.qty));
    });
    lines.push('');
    lines.push(T.total + ': ' + money(sub));
    lines.push('');
    lines.push(T.outro);
    var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(lines.join('\n'));
    window.open(url, '_blank', 'noopener');
  }

  /* ------------------------------------------------------------- drawer */
  function open() {
    var d = $('#cart'); if (!d) { return; }
    d.classList.add('on');
    $('#scrim').classList.add('on');
    document.body.style.overflow = 'hidden';
    var c = $('.drawer-h button', d); if (c) { c.focus(); }
  }
  function close() {
    var d = $('#cart'); if (d) { d.classList.remove('on'); }
    var m = $('#mnav'); if (m) { m.classList.remove('on'); }
    var s = $('#scrim'); if (s) { s.classList.remove('on'); }
    document.body.style.overflow = '';
  }

  /* ------------------------------------------------------------- product */
  function initPDP() {
    var root = $('[data-pdp]');
    if (!root) { return; }
    var data = JSON.parse(root.getAttribute('data-pdp'));
    var size = data.sizes[0];

    function priceEl() { return $('#pdp-price'); }
    function render() {
      var s = null;
      data.sizes.forEach(function (x) { if (x.slug === size.slug) { s = x; } });
      if (!s) { return; }
      priceEl().textContent = money(s.price);
      $$('.sz').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-size') === s.slug));
      });
      var pm = $('#pdp-dims');
      if (pm) { pm.textContent = s.cm + ' · ' + s.ft; }
    }

    $$('.sz').forEach(function (b) {
      b.addEventListener('click', function () {
        data.sizes.forEach(function (x) {
          if (x.slug === b.getAttribute('data-size')) { size = x; }
        });
        render();
      });
    });

    var qtyIn = $('#pdp-qty');
    $$('[data-pq]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = Math.max(1, (parseInt(qtyIn.value, 10) || 1) + parseInt(b.getAttribute('data-pq'), 10));
        qtyIn.value = v;
      });
    });

    var addBtn = $('#pdp-add');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var s = null;
        data.sizes.forEach(function (x) { if (x.slug === size.slug) { s = x; } });
        if (!s) { toast(T.pick); return; }
        add({
          sku: data.sku, name: data.name, size: s.cm + ' (' + s.ft + ')',
          price: s.price, qty: Math.max(1, parseInt(qtyIn.value, 10) || 1), art: data.art
        });
      });
    }

    var waBtn = $('#pdp-wa');
    if (waBtn) {
      waBtn.addEventListener('click', function () {
        var s = null;
        data.sizes.forEach(function (x) { if (x.slug === size.slug) { s = x; } });
        var msg = T.intro + '\n\n' + data.name + '\n' + data.sku + ' | ' +
          (s ? s.cm + ' | ' + money(s.price) : '') + '\n' + location.href + '\n\n' + T.outro;
        window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      });
    }

    // gallery
    $$('.gal-t button').forEach(function (b, i) {
      b.addEventListener('click', function () {
        $$('.gal-t button').forEach(function (x) { x.setAttribute('aria-current', 'false'); });
        b.setAttribute('aria-current', 'true');
        var panes = $$('.gal-m > *');
        panes.forEach(function (p, j) { p.hidden = (i !== j); });
      });
    });

    render();
  }

  /* ------------------------------------------------------------- filters */
  function initFilters() {
    var grid = $('#coll-grid');
    if (!grid) { return; }
    var cards = $$('[data-card]', grid);
    var countEl = $('#coll-count');

    function apply() {
      var active = {};
      $$('.fil input:checked').forEach(function (i) {
        var g = i.getAttribute('data-g');
        (active[g] = active[g] || []).push(i.value);
      });
      var shown = 0;
      cards.forEach(function (c) {
        var ok = true;
        Object.keys(active).forEach(function (g) {
          var vals = (c.getAttribute('data-' + g) || '').split(' ');
          var hit = active[g].some(function (v) { return vals.indexOf(v) > -1; });
          if (!hit) { ok = false; }
        });
        c.hidden = !ok;
        if (ok) { shown++; }
      });
      if (countEl) { countEl.textContent = shown; }
    }

    $$('.fil input').forEach(function (i) { i.addEventListener('change', apply); });

    var clear = $('#fil-clear');
    if (clear) {
      clear.addEventListener('click', function () {
        $$('.fil input:checked').forEach(function (i) { i.checked = false; });
        apply();
      });
    }

    var sort = $('#coll-sort');
    if (sort) {
      sort.addEventListener('change', function () {
        var v = sort.value;
        var arr = cards.slice();
        arr.sort(function (a, b) {
          var pa = parseFloat(a.getAttribute('data-price')) || 0;
          var pb = parseFloat(b.getAttribute('data-price')) || 0;
          var ra = parseFloat(a.getAttribute('data-rating')) || 0;
          var rb = parseFloat(b.getAttribute('data-rating')) || 0;
          if (v === 'low') { return pa - pb; }
          if (v === 'high') { return pb - pa; }
          if (v === 'rating') { return rb - ra; }
          return (parseInt(a.getAttribute('data-ord'), 10) || 0) - (parseInt(b.getAttribute('data-ord'), 10) || 0);
        });
        arr.forEach(function (c) { grid.appendChild(c); });
      });
    }

    var ft = $('#fil-toggle');
    if (ft) {
      ft.addEventListener('click', function () {
        var p = $('.fil');
        var on = p.classList.toggle('on');
        ft.setAttribute('aria-expanded', String(on));
      });
    }
  }

  /* ------------------------------------------------------------- calc */
  function initCalc() {
    var form = $('#calc');
    if (!form) { return; }
    function run() {
      var w = parseFloat($('#calc-w').value) || 0;
      var l = parseFloat($('#calc-l').value) || 0;
      var use = $('#calc-use').value;
      var out = $('#calc-out');
      if (!w || !l) { out.hidden = true; return; }
      var rw, rl, note;
      if (use === 'dining') {
        rw = w + 1.4; rl = l + 1.4;
        note = LANG === 'ar'
          ? 'أضفنا ٧٠ سم على كل جانب حتى تبقى الكراسي على السجادة عند سحبها.'
          : 'We added 70 cm on every side so chairs stay on the rug when pulled out.';
      } else if (use === 'bed') {
        rw = w + 1.2; rl = l * 0.78 + 0.6;
        note = LANG === 'ar'
          ? 'تمتد السجادة تحت الثلثين السفليين من السرير مع ٦٠ سم على كل جانب.'
          : 'The rug runs under the bottom two-thirds of the bed with 60 cm either side.';
      } else {
        rw = Math.max(1.6, w - 0.8); rl = Math.max(2.3, l - 0.8);
        note = LANG === 'ar'
          ? 'اترك نحو ٤٠ سم من الأرضية ظاهرة حول السجادة، مع بقاء الأرجل الأمامية للمقاعد عليها.'
          : 'Leave about 40 cm of floor showing around the rug, with the front legs of every seat on it.';
      }
      var cm = Math.round(rw * 100) + ' × ' + Math.round(rl * 100) + ' cm';
      // nearest stocked size
      var sizes = (CFG.sizes || []);
      var best = null, bestD = 1e9;
      sizes.forEach(function (s) {
        var d = Math.abs(s.w - rw * 100) + Math.abs(s.h - rl * 100);
        if (d < bestD) { bestD = d; best = s; }
      });
      $('#calc-size').textContent = cm;
      $('#calc-note').textContent = note;
      var near = $('#calc-near');
      if (best && near) {
        near.innerHTML = (LANG === 'ar' ? 'أقرب مقاس متوفر: ' : 'Closest stocked size: ') +
          '<a class="link-u" href="' + best.url + '">' + best.label + '</a>';
      }
      out.hidden = false;
    }
    form.addEventListener('input', run);
    form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  }

  /* ------------------------------------------------------------- search */
  /* Hero slideshow: 3 s per slide; new slide enters from the left (EN) or the right (AR). */
  function initQuoteForms() {
    var forms = document.querySelectorAll('form[data-qf]');
    Array.prototype.forEach.call(forms, function (f) {
      function msg() {
        var lines = [f.getAttribute('data-subject') || ''];
        Array.prototype.forEach.call(f.elements, function (el) {
          if (!el.name || !el.value) { return; }
          lines.push((el.getAttribute('data-l') || el.name) + ': ' + el.value.trim());
        });
        lines.push('(' + location.pathname + ')');
        return lines.join('\n');
      }
      var pre = f.querySelector('.qf-pre pre');
      function paint() { if (pre) { pre.textContent = msg(); } }
      f.addEventListener('input', paint);
      f.addEventListener('change', paint);
      paint();
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var name = f.elements.name, err = f.querySelector('.qf-err');
        if (name && !name.value.trim()) {
          if (err) { err.hidden = false; }
          name.focus();
          return;
        }
        if (err) { err.hidden = true; }
        window.open('https://wa.me/' + f.getAttribute('data-wa') + '?text=' + encodeURIComponent(msg()), '_blank', 'noopener');
      });
    });
  }

  function initHeroSlides() {
    var box = $('.hero-slides');
    if (!box) return;
    var slides = [].slice.call(box.querySelectorAll('.slide'));
    var dots = [].slice.call(box.querySelectorAll('.hero-dots button'));
    if (slides.length < 2) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cur = 0, timer = null, busy = false;
    function go(n) {
      if (n === cur || busy) return;
      busy = true;
      var from = slides[cur], to = slides[n];
      box.classList.remove('go');                 // park the incoming slide off-screen without animating
      to.classList.remove('is-out'); to.classList.remove('is-on');
      void to.offsetWidth;
      box.classList.add('go');
      from.classList.remove('is-on'); from.classList.add('is-out');
      to.classList.add('is-on');
      dots.forEach(function (d, k) { d.classList.toggle('on', k === n); });
      cur = n;
      setTimeout(function () { from.classList.remove('is-out'); busy = false; }, 950);
    }
    function next() { go((cur + 1) % slides.length); }
    function play() { if (!reduce && !timer) timer = setInterval(next, 3000); }
    function stop() { clearInterval(timer); timer = null; }
    dots.forEach(function (d, k) { d.addEventListener('click', function () { stop(); go(k); play(); }); });
    var hero = box.closest('.hero') || box;      // pause while the visitor hovers or focuses the hero (WCAG 2.2.2)
    hero.addEventListener('mouseenter', stop);
    hero.addEventListener('mouseleave', play);
    hero.addEventListener('focusin', stop);
    hero.addEventListener('focusout', play);
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : play(); });
    play();
  }

  function initSearch() {
    var input = $('#site-search');
    if (!input) { return; }
    var results = $('#search-results');
    var idx = CFG.index || [];
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      if (q.length < 2) { results.innerHTML = ''; return; }
      var hits = idx.filter(function (r) {
        return (r.t + ' ' + (r.k || '')).toLowerCase().indexOf(q) > -1;
      }).slice(0, 12);
      results.innerHTML = hits.length
        ? hits.map(function (r) {
            return '<li><a href="' + r.u + '"><b>' + esc(r.t) + '</b>' +
              (r.d ? '<small>' + esc(r.d) + '</small>' : '') + '</a></li>';
          }).join('')
        : '<li class="note" style="padding:1rem 0">' +
          (LANG === 'ar' ? 'لا نتائج' : 'No results') + '</li>';
    });
  }

  /* ------------------------------------------------------------- wire-up */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (t) {
      var a = t.getAttribute('data-act');
      if (a === 'cart') { e.preventDefault(); open(); }
      if (a === 'close') { e.preventDefault(); close(); }
      if (a === 'wa') { e.preventDefault(); waOrder(); }
      if (a === 'menu') {
        e.preventDefault();
        $('#mnav').classList.add('on');
        $('#scrim').classList.add('on');
        document.body.style.overflow = 'hidden';
      }
      if (a === 'theme') {
        e.preventDefault();
        var cur = document.documentElement.getAttribute('data-theme') ||
          ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
        var next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('naqsh.theme', next); } catch (err) {}
      }
      if (a === 'share') {
        e.preventDefault();
        if (navigator.share) { navigator.share({ url: location.href, title: document.title }); }
        else if (navigator.clipboard) {
          navigator.clipboard.writeText(location.href).then(function () { toast(T.copied); });
        }
      }
      return;
    }
    var rm = e.target.closest ? e.target.closest('[data-rm]') : null;
    if (rm) { setQty(parseInt(rm.getAttribute('data-rm'), 10), 0); return; }
    var q = e.target.closest ? e.target.closest('[data-q]') : null;
    if (q) {
      var i = parseInt(q.getAttribute('data-q'), 10);
      var items = read();
      setQty(i, (items[i] ? items[i].qty : 1) + parseInt(q.getAttribute('data-d'), 10));
      return;
    }
    var acc = e.target.closest ? e.target.closest('.acc-b, .macc > button, .fil-g > h3') : null;
    if (acc) {
      var box = acc.closest('.acc, .macc, .fil-g');
      if (box) {
        var on = box.classList.toggle('on');
        acc.setAttribute('aria-expanded', String(on));
      }
    }
  });

  document.addEventListener('change', function (e) {
    if (e.target.matches && e.target.matches('[data-qi]')) {
      setQty(parseInt(e.target.getAttribute('data-qi'), 10),
        Math.max(1, parseInt(e.target.value, 10) || 1));
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { close(); }
  });

  // keep the cart in step across open tabs
  window.addEventListener('storage', function (e) { if (e.key === KEY) { paint(); } });

  // newsletter -> Netlify Forms (shows a WhatsApp nudge if the host has no form handler)
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f.classList || !f.classList.contains('nl-form')) { return; }
    e.preventDefault();
    var btn = $('button', f);
    var label = btn.textContent;
    btn.disabled = true;
    var body = $$('input', f).map(function (i) {
      return encodeURIComponent(i.name) + '=' + encodeURIComponent(i.value);
    }).join('&');
    fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body })
      .then(function (r) {
        if (!r.ok) { throw new Error('form'); }
        f.reset(); btn.textContent = '\u2713';
        toast(LANG === 'ar' ? 'شكرًا، تم الاشتراك' : 'Thank you, you are subscribed');
      })
      .catch(function () {
        btn.textContent = label;
        toast(LANG === 'ar' ? 'تعذّر الاشتراك الآن، راسلنا عبر واتساب' : 'Could not subscribe just now, please message us on WhatsApp');
      })
      .then(function () { setTimeout(function () { btn.disabled = false; btn.textContent = label; }, 3000); });
  });

  // quick add straight from a product card
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-add]') : null;
    if (!b) { return; }
    e.preventDefault();
    add(JSON.parse(b.getAttribute('data-add')));
  });

  function ready() {
    try {
      var saved = localStorage.getItem('naqsh.theme');
      if (saved) { document.documentElement.setAttribute('data-theme', saved); }
    } catch (e) {}

    paint();
    initPDP();
    initFilters();
    initCalc();
    initHeroSlides();
    initQuoteForms();
    initSearch();

    var hdr = $('.hdr');
    if (hdr) {
      var onScroll = function () { hdr.classList.toggle('stuck', window.scrollY > 8); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    // open the first accordion on each page so content is never hidden on load
    var first = $('.acc');
    if (first) { first.classList.add('on'); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else { ready(); }

  window.NaqshCart = { add: add, open: open, read: read };
})();
