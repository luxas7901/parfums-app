/* ============================================================
 * js/cart.js — storefront cart (drawer, frasco/decant variants,
 * installments & 10% OFF math, WhatsApp message). Depends on
 * js/config.js and js/store.js having been loaded first.
 * ============================================================ */

let cart = [];
let payMethod = 'efectivo';

function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* storage may be unavailable */ }
}

function loadCart() {
  try {
    var raw = localStorage.getItem(CART_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) cart = parsed;
    }
  } catch (e) { cart = []; }
}

function totalUnits() {
  return cart.reduce(function (s, l) { return s + l.qty; }, 0);
}

function addToCart(id, presentation, qty) {
  var existing = cart.find(function (l) { return l.id === id && l.presentation === presentation; });
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ id: id, presentation: presentation, qty: qty });
  }
  saveCart();
  updateCounts(true);
  renderCart();
}

function changeQty(index, delta) {
  var line = cart[index];
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) {
    cart.splice(index, 1);
  }
  saveCart();
  updateCounts();
  renderCart();
}

function changePresentation(index, presentation) {
  var line = cart[index];
  if (!line) return;
  var p = getProduct(line.id);
  if (presentation === 'decant' && !(p && p.decantPrice != null)) return;
  line.presentation = presentation;
  saveCart();
  renderCart();
}

function removeLine(index) {
  cart.splice(index, 1);
  saveCart();
  updateCounts();
  renderCart();
}

function updateCounts(bump) {
  var n = totalUnits();
  document.querySelectorAll('[data-cart-count]').forEach(function (el) {
    el.textContent = n;
    if (bump) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  });
}

/* ----- Totales y pagos ----- */
function lineTotal(line) {
  var p = getProduct(line.id);
  if (!p) return 0;
  return unitPrice(p, line.presentation) * line.qty;
}

function subtotal() {
  return cart.reduce(function (s, l) { return s + lineTotal(l); }, 0);
}

function computeTotals() {
  var sub = subtotal();
  if (payMethod === 'efectivo') {
    var total = sub * 0.9;
    return { sub: sub, total: total, savings: sub - total, cuotas: null };
  }
  if (payMethod === 'quincenal') {
    var q = Math.ceil(sub / 3);
    return { sub: sub, total: sub, savings: 0, cuotas: { n: 3, each: q, label: 'quincenales' } };
  }
  var m = Math.ceil(sub / 2);
  return { sub: sub, total: sub, savings: 0, cuotas: { n: 2, each: m, label: 'mensuales' } };
}

/* ----- Drawer ----- */
function openCart() {
  renderCart();
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
  document.body.style.overflow = '';
}

function renderCart() {
  var items = document.getElementById('cart-items');
  items.textContent = '';

  if (!cart.length) {
    var empty = document.createElement('div');
    empty.className = 'cart-empty';
    var em = document.createElement('span');
    em.className = 'emoji';
    em.textContent = '🛒';
    var t1 = document.createElement('p');
    t1.textContent = 'Tu carrito está vacío';
    var a = document.createElement('a');
    a.href = '#catalogo';
    a.textContent = 'Explorar el catálogo';
    a.addEventListener('click', closeCart);
    empty.appendChild(em);
    empty.appendChild(t1);
    empty.appendChild(a);
    items.appendChild(empty);
  } else {
    cart.forEach(function (line, i) {
      items.appendChild(buildLineItem(line, i));
    });
  }

  renderTotals();
}

function buildLineItem(line, i) {
  var p = getProduct(line.id);
  if (!p) return document.createElement('div');

  var item = document.createElement('div');
  item.className = 'line-item';

  var thumb = document.createElement('div');
  thumb.className = 'line-thumb';
  if (p.image) {
    var img = document.createElement('img');
    img.src = p.image;
    img.alt = p.brand + ' ' + p.name;
    img.addEventListener('error', function () { img.style.background = p.liquid || 'transparent'; });
    thumb.appendChild(img);
  } else {
    thumb.style.background = 'radial-gradient(circle at 30% 25%, ' + (p.liquid || '#e0a63a') + '88, rgba(26,19,48,0.5))';
  }
  item.appendChild(thumb);

  var info = document.createElement('div');
  info.className = 'line-info';

  var top = document.createElement('div');
  top.className = 'line-top';
  var txt = document.createElement('div');
  var br = document.createElement('div');
  br.className = 'line-brand';
  br.textContent = p.brand;
  var nm = document.createElement('div');
  nm.className = 'line-name';
  nm.textContent = p.name;
  txt.appendChild(br);
  txt.appendChild(nm);
  var rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'line-remove';
  rm.setAttribute('aria-label', 'Quitar ' + p.name);
  rm.textContent = '×';
  rm.addEventListener('click', function () { removeLine(i); });
  top.appendChild(txt);
  top.appendChild(rm);
  info.appendChild(top);

  var controls = document.createElement('div');
  controls.className = 'line-controls';

  var hasDecant = p.decantPrice != null;
  if (hasDecant) {
    var sel = document.createElement('select');
    sel.className = 'line-select';
    sel.setAttribute('aria-label', 'Presentación de ' + p.name);
    var o1 = document.createElement('option');
    o1.value = 'full';
    o1.textContent = 'Frasco 100ml';
    var o2 = document.createElement('option');
    o2.value = 'decant';
    o2.textContent = 'Decant 10ml';
    sel.appendChild(o1);
    sel.appendChild(o2);
    sel.value = line.presentation;
    sel.addEventListener('change', function () { changePresentation(i, sel.value); });
    controls.appendChild(sel);
  } else {
    var fixed = document.createElement('span');
    fixed.className = 'line-select';
    fixed.style.border = 'none';
    fixed.style.background = 'none';
    fixed.style.padding = '0';
    fixed.textContent = 'Frasco 100ml';
    controls.appendChild(fixed);
  }

  var qty = document.createElement('div');
  qty.className = 'qty';
  var minus = document.createElement('button');
  minus.type = 'button';
  minus.textContent = '−';
  minus.setAttribute('aria-label', 'Disminuir cantidad de ' + p.name);
  minus.addEventListener('click', function () { changeQty(i, -1); });
  var val = document.createElement('span');
  val.className = 'qty-val';
  val.textContent = line.qty;
  var plus = document.createElement('button');
  plus.type = 'button';
  plus.textContent = '+';
  plus.setAttribute('aria-label', 'Aumentar cantidad de ' + p.name);
  plus.addEventListener('click', function () { changeQty(i, 1); });
  qty.appendChild(minus);
  qty.appendChild(val);
  qty.appendChild(plus);
  controls.appendChild(qty);

  var sub = document.createElement('span');
  sub.className = 'line-subtotal';
  sub.textContent = fmtARS(lineTotal(line));
  controls.appendChild(sub);

  info.appendChild(controls);
  item.appendChild(info);
  return item;
}

function renderTotals() {
  var box = document.getElementById('cart-totals');
  box.textContent = '';

  if (!cart.length) return;

  var t = computeTotals();

  /* pago */
  var pay = document.createElement('div');
  pay.className = 'pay-block';
  var h = document.createElement('h3');
  h.textContent = 'Forma de pago';
  pay.appendChild(h);

  var opts = document.createElement('div');
  opts.className = 'pay-options';
  [
    { value: 'efectivo', title: 'Transferencia / Efectivo', desc: '10% OFF en el total' },
    { value: 'quincenal', title: 'Cuotas Quincenales', desc: '3 cuotas' },
    { value: 'mensual', title: 'Cuotas Mensuales', desc: '2 cuotas' }
  ].forEach(function (opt) {
    var lab = document.createElement('label');
    lab.className = 'pay-option' + (payMethod === opt.value ? ' selected' : '');
    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'pay-method';
    radio.value = opt.value;
    radio.checked = payMethod === opt.value;
    var wrap = document.createElement('div');
    var t1 = document.createElement('div');
    t1.className = 'pay-title';
    t1.textContent = opt.title;
    var d = document.createElement('div');
    d.className = 'pay-desc';
    d.textContent = opt.desc;
    wrap.appendChild(t1);
    wrap.appendChild(d);
    lab.appendChild(radio);
    lab.appendChild(wrap);
    radio.addEventListener('change', function () {
      if (radio.checked) { payMethod = opt.value; renderTotals(); }
    });
    opts.appendChild(lab);
  });
  pay.appendChild(opts);
  box.appendChild(pay);

  /* totales */
  var row = document.createElement('div');
  row.className = 'total-row';
  var l1 = document.createElement('span');
  l1.className = 'muted';
  l1.textContent = 'Subtotal';
  var v1 = document.createElement('span');
  v1.textContent = fmtARS(t.sub);
  row.appendChild(l1);
  row.appendChild(v1);
  box.appendChild(row);

  if (payMethod === 'efectivo') {
    var row2 = document.createElement('div');
    row2.className = 'total-row';
    var l2 = document.createElement('span');
    l2.className = 'muted strike';
    l2.textContent = fmtARS(t.sub);
    var off = document.createElement('span');
    off.className = 'off-badge';
    off.textContent = '10% OFF';
    var l2wrap = document.createElement('span');
    l2wrap.appendChild(l2);
    l2wrap.appendChild(off);
    var v2 = document.createElement('span');
    v2.textContent = fmtARS(t.total);
    row2.appendChild(l2wrap);
    row2.appendChild(v2);
    box.appendChild(row2);

    var row3 = document.createElement('div');
    row3.className = 'total-row savings-row';
    var l3 = document.createElement('span');
    l3.textContent = 'Ahorro';
    var v3 = document.createElement('span');
    v3.textContent = fmtARS(t.savings);
    row3.appendChild(l3);
    row3.appendChild(v3);
    box.appendChild(row3);
  }

  if (t.cuotas) {
    var cu = document.createElement('div');
    cu.className = 'cuotas-line';
    cu.textContent = t.cuotas.n + ' cuotas ' + t.cuotas.label + ' de ' + fmtARS(t.cuotas.each) + ' c/u';
    box.appendChild(cu);
  }

  var fin = document.createElement('div');
  fin.className = 'total-final';
  var fl = document.createElement('span');
  fl.textContent = 'Total';
  var fa = document.createElement('span');
  fa.className = 'amount';
  fa.textContent = fmtARS(t.total);
  fin.appendChild(fl);
  fin.appendChild(fa);
  box.appendChild(fin);

  /* acciones */
  var actions = document.createElement('div');
  actions.className = 'drawer-actions';

  var wa = document.createElement('button');
  wa.type = 'button';
  wa.className = 'btn-whatsapp';
  wa.textContent = 'Enviar Pedido por WhatsApp';
  wa.addEventListener('click', sendWhatsApp);

  var cp = document.createElement('button');
  cp.type = 'button';
  cp.className = 'btn-copy';
  cp.textContent = 'Copiar pedido al portapapeles';
  cp.addEventListener('click', copyOrder);

  actions.appendChild(wa);
  actions.appendChild(cp);
  box.appendChild(actions);
}

/* ============================================================
 * Mensaje de WhatsApp
 * ============================================================ */
function buildMessage() {
  var t = computeTotals();
  var lines = cart.map(function (line) {
    var p = getProduct(line.id);
    var sub = fmtARS(lineTotal(line));
    return '• ' + p.brand + ' ' + p.name + ' (' + presentationLabel(line.presentation) + ') x' + line.qty + ' - ' + sub;
  });

  var desglose;
  if (payMethod === 'efectivo') {
    desglose = '(10% OFF aplicado — ahorrás ' + fmtARS(t.savings) + ')';
  } else if (payMethod === 'quincenal') {
    desglose = '(3 cuotas quincenales de ' + fmtARS(t.cuotas.each) + ')';
  } else {
    desglose = '(2 cuotas mensuales de ' + fmtARS(t.cuotas.each) + ')';
  }

  return [
    settings.greeting,
    '',
    settings.headerDetail,
    lines.join('\n'),
    '',
    '💳 *Forma de Pago seleccionada:* ' + PAY_LABELS[payMethod],
    '🏷️ *Total Estimado:* ' + fmtARS(t.total) + ' ' + desglose,
    '',
    settings.footerText
  ].join('\n');
}

function sendWhatsApp() {
  var msg = buildMessage();
  var number = (settings && settings.whatsappNumber) || WHATSAPP_NUMBER;
  var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  window.open(url, '_blank', 'noopener');
}

function copyOrder() {
  var msg = buildMessage();
  var done = function () { toast('Pedido copiado al portapapeles ✓', 'success'); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).then(done).catch(function () { fallbackCopy(msg); done(); });
  } else {
    fallbackCopy(msg);
    done();
  }
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ }
  document.body.removeChild(ta);
}

/* ============================================================
 * Inicialización (cart)
 * ============================================================ */
function initCart() {
  loadCart();
  updateCounts();
}