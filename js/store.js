/* ============================================================
 * js/store.js — storefront catalog (filters, olfactory-notes
 * search and grid rendering). Depends on js/config.js having
 * been loaded first (classic scripts, file:// compatible).
 * ============================================================ */

let selectedPresentation = {}; // product id -> 'full' | 'decant' (per-card toggle)

function getProduct(id) {
  return catalog.find(function (p) { return p.id === id; });
}

/* ============================================================
 * Filtros y orden
 * ============================================================ */
function buildFilterOptions() {
  var fam = document.getElementById('family-select');
  var br = document.getElementById('brand-select');
  fam.innerHTML = '<option value="">Todas</option>';
  br.innerHTML = '<option value="">Todas</option>';

  FAMILIES.forEach(function (f) {
    var opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    fam.appendChild(opt);
  });

  var brands = Array.from(new Set(catalog.map(function (p) { return p.brand; }))).sort();
  brands.forEach(function (b) {
    var opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    br.appendChild(opt);
  });
}

function noteText(p) {
  var parts = [];
  ['salida', 'corazon', 'fondo'].forEach(function (k) {
    if (Array.isArray(p.notes && p.notes[k])) parts = parts.concat(p.notes[k]);
  });
  return parts.join(' ');
}

function filteredProducts() {
  var q = normalize(document.getElementById('search-input').value.trim());
  var fam = document.getElementById('family-select').value;
  var br = document.getElementById('brand-select').value;
  var sort = document.getElementById('sort-select').value;

  var list = catalog.filter(function (p) {
    if (fam && p.family !== fam) return false;
    if (br && p.brand !== br) return false;
    if (q) {
      var hay = normalize([p.name, p.brand, p.tagline, noteText(p)].join(' '));
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  if (sort === 'price-asc') list = list.slice().sort(function (a, b) { return a.price - b.price; });
  else if (sort === 'price-desc') list = list.slice().sort(function (a, b) { return b.price - a.price; });
  else if (sort === 'name-az') list = list.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); });
  return list;
}

function unitPrice(p, presentation) {
  return presentation === 'decant' && p.decantPrice != null ? p.decantPrice : p.price;
}

function presentationLabel(presentation) {
  return presentation === 'decant' ? 'Decant 5ml' : 'Frasco 100ml';
}

/* ============================================================
 * Render del catálogo
 * ============================================================ */
function renderGrid() {
  var grid = document.getElementById('product-grid');
  grid.textContent = '';

  var list = filteredProducts();
  document.getElementById('result-count').textContent = list.length === 1
    ? '1 perfume'
    : list.length + ' perfumes';

  if (!list.length) {
    var empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.style.gridColumn = '1 / -1';
    var em = document.createElement('span');
    em.className = 'emoji';
    em.textContent = '🔍';
    var txt = document.createElement('span');
    txt.textContent = 'No se encontraron perfumes con esos filtros.';
    empty.appendChild(em);
    empty.appendChild(txt);
    grid.appendChild(empty);
    return;
  }

  list.forEach(function (p) {
    grid.appendChild(buildCard(p));
  });
}

function buildCard(p) {
  if (!selectedPresentation[p.id]) selectedPresentation[p.id] = 'full';

  var card = document.createElement('article');
  card.className = 'card glass';

  /* ---- imagen ---- */
  var imgWrap = document.createElement('div');
  imgWrap.className = 'card-image';

  if (p.image) {
    var img = document.createElement('img');
    img.src = p.image;
    img.alt = p.brand + ' ' + p.name;
    img.loading = 'lazy';
    img.addEventListener('error', function () {
      img.replaceWith(makeFallback(p.liquid));
    });
    imgWrap.appendChild(img);
  } else {
    imgWrap.appendChild(makeFallback(p.liquid));
  }

  if (p.badge) {
    var chip = document.createElement('span');
    chip.className = 'badge-chip';
    chip.textContent = p.badge;
    imgWrap.appendChild(chip);
  }

  var fchip = document.createElement('span');
  fchip.className = 'family-chip';
  fchip.textContent = p.family;
  imgWrap.appendChild(fchip);

  card.appendChild(imgWrap);

  /* ---- cuerpo ---- */
  var body = document.createElement('div');
  body.className = 'card-body';

  var brand = document.createElement('div');
  brand.className = 'card-brand';
  brand.textContent = p.brand;
  body.appendChild(brand);

  var name = document.createElement('div');
  name.className = 'card-name';
  name.textContent = p.name;
  body.appendChild(name);

  if (p.tagline) {
    var tag = document.createElement('div');
    tag.className = 'card-tagline';
    tag.textContent = p.tagline;
    body.appendChild(tag);
  }

  /* precio */
  var priceBlock = document.createElement('div');
  priceBlock.className = 'price-block';
  var priceMain = document.createElement('span');
  priceMain.className = 'price-main';
  var priceAlt = document.createElement('div');
  priceAlt.className = 'price-alt';
  function refreshPrices() {
    var sel = selectedPresentation[p.id];
    priceMain.textContent = fmtARS(unitPrice(p, sel));
    if (sel === 'full' && p.decantPrice != null) {
      priceAlt.textContent = 'Decant 5ml: ' + fmtARS(p.decantPrice);
    } else if (sel === 'decant') {
      priceAlt.textContent = 'Frasco 100ml: ' + fmtARS(p.price);
    } else {
      priceAlt.textContent = '';
    }
  }
  refreshPrices();
  priceBlock.appendChild(priceMain);
  priceBlock.appendChild(priceAlt);
  body.appendChild(priceBlock);

  /* selector de presentación */
  var seg = document.createElement('div');
  seg.className = 'segmented';
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Presentación de ' + p.name);

  var btnFull = document.createElement('button');
  btnFull.type = 'button';
  btnFull.textContent = 'Frasco 100ml';
  var btnDecant = document.createElement('button');
  btnDecant.type = 'button';
  btnDecant.textContent = 'Decant 5ml';

  var hasDecant = p.decantPrice != null;
  if (!hasDecant) {
    btnDecant.disabled = true;
    btnDecant.setAttribute('aria-disabled', 'true');
    btnDecant.title = 'Este perfume no tiene versión decant disponible';
  }

  function syncActive() {
    btnFull.classList.toggle('active', selectedPresentation[p.id] === 'full');
    btnDecant.classList.toggle('active', selectedPresentation[p.id] === 'decant');
  }
  syncActive();

  btnFull.addEventListener('click', function () {
    selectedPresentation[p.id] = 'full';
    syncActive(); refreshPrices();
  });
  btnDecant.addEventListener('click', function () {
    if (!hasDecant) return;
    selectedPresentation[p.id] = 'decant';
    syncActive(); refreshPrices();
  });

  seg.appendChild(btnFull);
  seg.appendChild(btnDecant);
  body.appendChild(seg);

  /* pirámide olfativa (acordeón) */
  var acc = document.createElement('div');
  acc.className = 'accordion';
  var trig = document.createElement('button');
  trig.type = 'button';
  trig.className = 'accordion-trigger';
  trig.setAttribute('aria-expanded', 'false');
  var trigLabel = document.createElement('span');
  trigLabel.textContent = 'Pirámide olfativa';
  var chev = document.createElement('span');
  chev.className = 'chev';
  chev.textContent = '▾';
  trig.appendChild(trigLabel);
  trig.appendChild(chev);

  var panel = document.createElement('div');
  panel.className = 'accordion-panel';
  [
    { key: 'salida', label: 'Salida' },
    { key: 'corazon', label: 'Corazón' },
    { key: 'fondo', label: 'Fondo' }
  ].forEach(function (sec) {
    var row = document.createElement('div');
    row.className = 'note-row';
    var lab = document.createElement('div');
    lab.className = 'note-label';
    lab.textContent = sec.label;
    row.appendChild(lab);
    var chips = document.createElement('div');
    chips.className = 'chips';
    (p.notes && p.notes[sec.key] ? p.notes[sec.key] : []).forEach(function (n) {
      var c = document.createElement('span');
      c.className = 'chip';
      c.textContent = n;
      chips.appendChild(c);
    });
    row.appendChild(chips);
    panel.appendChild(row);
  });

  trig.addEventListener('click', function () {
    var open = panel.classList.toggle('open');
    trig.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  acc.appendChild(trig);
  acc.appendChild(panel);
  body.appendChild(acc);

  /* agregar al carrito */
  var addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-add';
  addBtn.textContent = 'Agregar al carrito';
  addBtn.addEventListener('click', function () {
    addToCart(p.id, selectedPresentation[p.id], 1);
    toast('Agregado al carrito ✓');
  });
  body.appendChild(addBtn);

  card.appendChild(body);
  return card;
}

function makeFallback(liquid) {
  var div = document.createElement('div');
  div.className = 'fallback';
  div.style.background = 'radial-gradient(circle at 30% 25%, ' + (liquid || '#e0a63a') + '55, ' + (liquid || '#e0a63a') + '22 55%, rgba(26,19,48,0.4) 100%)';
  return div;
}

/* ============================================================
 * Inicialización (store)
 * ============================================================ */
function initStore() {
  buildFilterOptions();
  renderGrid();

  var search = document.getElementById('search-input');
  var fam = document.getElementById('family-select');
  var br = document.getElementById('brand-select');
  var sort = document.getElementById('sort-select');

  [search, fam, br, sort].forEach(function (el) {
    el.addEventListener('input', function () { renderGrid(); });
    el.addEventListener('change', function () { renderGrid(); });
  });

  document.getElementById('clear-filters').addEventListener('click', function () {
    search.value = '';
    fam.value = '';
    br.value = '';
    sort.value = 'relevance';
    renderGrid();
  });

  document.querySelectorAll('[data-open-cart]').forEach(function (btn) {
    btn.addEventListener('click', openCart);
  });
  document.getElementById('cart-drawer').querySelector('[data-close-cart]').addEventListener('click', closeCart);
  document.getElementById('overlay').addEventListener('click', closeCart);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeCart();
  });

  // Keep the header "Contacto" link in sync with the configured number (single source of truth).
  var number = (settings && settings.whatsappNumber) || WHATSAPP_NUMBER;
  document.getElementById('contact-link').setAttribute('href', 'https://wa.me/' + number);
}
