/* ============================================================
 * js/admin.js — admin panel (form management, Base64/URL image
 * upload, JSON import/download). Depends on js/config.js having
 * been loaded first (classic scripts, file:// compatible).
 * Shares localStorage[STORAGE_KEY] with index.html.
 * ============================================================ */

let editingId = null; // null = creating a new product
let imageData = null; // Base64 data URL (local upload) or external URL or null

// Reproduce the original admin initializer: admin overrides the shared
// `settings` state (declared as `null` in config.js) with defaults.
settings = Object.assign({}, DEFAULT_SETTINGS);

/* ============================================================
 * Utilidades
 * ============================================================ */
function showNotice(msg, type) {
  var el = document.getElementById('notice');
  el.textContent = msg;
  el.className = 'notice ' + (type || '');
  el.hidden = false;
}

function hideNotice() {
  document.getElementById('notice').hidden = true;
}

function saveCatalog() {
  if (!saveStoreData(settings, catalog)) {
    showNotice('No se pudieron guardar los cambios en este navegador (espacio o permisos). Descargá el archivo y subilo al repositorio.', 'error');
    return false;
  }
  return true;
}

/* ============================================================
 * Carga de datos
 * ============================================================ */
function fillSettingsForm() {
  document.getElementById('s-whatsapp').value = settings.whatsappNumber || '';
  document.getElementById('s-greeting').value = settings.greeting || '';
  document.getElementById('s-header').value = settings.headerDetail || '';
  document.getElementById('s-footer').value = settings.footerText || '';
}

function collectSettings() {
  var num = document.getElementById('s-whatsapp').value.trim();
  if (!num) {
    showNotice('El número de WhatsApp es obligatorio para recibir pedidos.', 'error');
    return null;
  }
  settings = {
    whatsappNumber: num,
    greeting: document.getElementById('s-greeting').value.trim(),
    headerDetail: document.getElementById('s-header').value.trim(),
    footerText: document.getElementById('s-footer').value.trim()
  };
  return settings;
}

function handleSaveSettings() {
  if (!collectSettings()) return;
  saveCatalog();
  toast('Ajustes guardados ✓', 'success');
}

function loadCatalog() {
  // 1) localStorage primero
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      var norm = normalizeData(parsed);
      if (norm) {
        catalog = norm.products;
        if (norm.settings) settings = Object.assign({}, DEFAULT_SETTINGS, norm.settings);
        init();
        return;
      }
    }
  } catch (e) { /* fall through */ }

  // 2) fetch products.json
  fetch('products.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var norm = normalizeData(data);
      if (!norm) throw new Error('catálogo inválido');
      catalog = norm.products;
      if (norm.settings) settings = Object.assign({}, DEFAULT_SETTINGS, norm.settings);
      init();
    })
    .catch(function () {
      catalog = [];
      init();
      showNotice('No se pudo cargar products.json automáticamente (probablemente abriste el archivo con file://). Usá un servidor local (Live Server o `python -m http.server`) o cargá el archivo manualmente con "Cargar products.json".', 'error');
    });
}

/* ============================================================
 * Formulario
 * ============================================================ */
function parseNotes(str) {
  return String(str).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

function fillFamilySelect() {
  var sel = document.getElementById('f-family');
  sel.textContent = '';
  FAMILIES.forEach(function (f) {
    var opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    sel.appendChild(opt);
  });
}

function fillBadgeSelect() {
  var sel = document.getElementById('f-badge');
  sel.textContent = '';
  var none = document.createElement('option');
  none.value = '';
  none.textContent = 'Sin etiqueta';
  sel.appendChild(none);
  BADGES.forEach(function (b) {
    var opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    sel.appendChild(opt);
  });
  var custom = document.createElement('option');
  custom.value = '__custom__';
  custom.textContent = 'Personalizada…';
  sel.appendChild(custom);
}

function getBadgeValue() {
  var sel = document.getElementById('f-badge');
  if (sel.value === '') return null;
  if (sel.value === '__custom__') {
    var custom = document.getElementById('f-badge-custom').value.trim();
    return custom || null;
  }
  return sel.value;
}

function resetForm() {
  editingId = null;
  imageData = null;
  document.getElementById('form-title').textContent = 'Nuevo producto';
  document.getElementById('btn-cancel').hidden = true;
  document.getElementById('f-id').value = '';
  document.getElementById('f-brand').value = '';
  document.getElementById('f-name').value = '';
  document.getElementById('f-tagline').value = '';
  document.getElementById('f-price').value = '';
  document.getElementById('f-decant').value = '';
  document.getElementById('f-family').value = FAMILIES[0];
  document.getElementById('f-liquid').value = '#e0a63a';
  updateLiquidHex();
  document.getElementById('f-badge').value = '';
  document.getElementById('f-badge-custom').value = '';
  document.getElementById('custom-badge-wrap').hidden = true;
  document.getElementById('f-notes-salida').value = '';
  document.getElementById('f-notes-corazon').value = '';
  document.getElementById('f-notes-fondo').value = '';
  document.getElementById('f-image').value = '';
  document.getElementById('f-image-url').value = '';
  renderImagePreview();
  hideNotice();
}

function fillForm(p) {
  editingId = p.id;
  imageData = p.image || null;
  document.getElementById('form-title').textContent = 'Editando: ' + p.name;
  document.getElementById('btn-cancel').hidden = false;
  document.getElementById('f-id').value = p.id;
  document.getElementById('f-brand').value = p.brand || '';
  document.getElementById('f-name').value = p.name || '';
  document.getElementById('f-tagline').value = p.tagline || '';
  document.getElementById('f-price').value = p.price != null ? p.price : '';
  document.getElementById('f-decant').value = p.decantPrice != null ? p.decantPrice : '';
  document.getElementById('f-family').value = FAMILIES.indexOf(p.family) !== -1 ? p.family : FAMILIES[0];
  document.getElementById('f-liquid').value = p.liquid || '#e0a63a';
  updateLiquidHex();

  var badgeSel = document.getElementById('f-badge');
  var customWrap = document.getElementById('custom-badge-wrap');
  var customInput = document.getElementById('f-badge-custom');
  if (p.badge && BADGES.indexOf(p.badge) !== -1) {
    badgeSel.value = p.badge;
    customWrap.hidden = true;
    customInput.value = '';
  } else if (p.badge) {
    badgeSel.value = '__custom__';
    customWrap.hidden = false;
    customInput.value = p.badge;
  } else {
    badgeSel.value = '';
    customWrap.hidden = true;
    customInput.value = '';
  }

  var notes = p.notes || {};
  document.getElementById('f-notes-salida').value = (notes.salida || []).join(', ');
  document.getElementById('f-notes-corazon').value = (notes.corazon || []).join(', ');
  document.getElementById('f-notes-fondo').value = (notes.fondo || []).join(', ');
  document.getElementById('f-image').value = '';
  document.getElementById('f-image-url').value = '';
  renderImagePreview();
  hideNotice();
}

function collectForm() {
  var id = document.getElementById('f-id').value.trim();
  var brand = document.getElementById('f-brand').value.trim();
  var name = document.getElementById('f-name').value.trim();
  var price = parseFloat(document.getElementById('f-price').value);
  var decantRaw = document.getElementById('f-decant').value.trim();
  var decant = decantRaw === '' ? undefined : parseFloat(decantRaw);

  var errors = [];
  if (!brand) errors.push('La marca es obligatoria.');
  if (!name) errors.push('El nombre es obligatorio.');
  if (isNaN(price) || price < 0) errors.push('El precio del frasco debe ser un número válido.');
  if (decant !== undefined && (isNaN(decant) || decant < 0)) errors.push('El precio del decant debe ser un número válido.');

  if (!id) id = slugify(brand + '-' + name);
  if (!id) errors.push('No se pudo generar un ID. Completá marca y nombre.');

  var duplicate = catalog.some(function (p) { return p.id === id && p.id !== editingId; });
  if (duplicate) errors.push('Ya existe un producto con el ID "' + id + '". Cambialo o editá el existente.');

  if (errors.length) {
    showNotice(errors.join(' '), 'error');
    return null;
  }

  return {
    id: id,
    brand: brand,
    name: name,
    badge: getBadgeValue(),
    tagline: document.getElementById('f-tagline').value.trim(),
    price: price,
    decantPrice: decant,
    family: document.getElementById('f-family').value,
    liquid: document.getElementById('f-liquid').value,
    image: imageData,
    notes: {
      salida: parseNotes(document.getElementById('f-notes-salida').value),
      corazon: parseNotes(document.getElementById('f-notes-corazon').value),
      fondo: parseNotes(document.getElementById('f-notes-fondo').value)
    }
  };
}

function handleSave() {
  var product = collectForm();
  if (!product) return;

  if (editingId) {
    var idx = catalog.findIndex(function (p) { return p.id === editingId; });
    if (idx !== -1) {
      catalog[idx] = product;
      toast('Producto actualizado ✓', 'success');
    } else {
      catalog.push(product);
      toast('Producto guardado ✓', 'success');
    }
  } else {
    catalog.push(product);
    toast('Producto guardado ✓', 'success');
  }

  saveCatalog();
  renderList();
  resetForm();
}

/* ============================================================
 * Imagen (Base64 local o URL externa)
 * ============================================================ */
function updateLiquidHex() {
  document.getElementById('liquid-hex').textContent = document.getElementById('f-liquid').value;
}

function renderImagePreview() {
  var box = document.getElementById('image-preview');
  box.textContent = '';
  var liquid = document.getElementById('f-liquid').value || '#e0a63a';

  if (imageData) {
    var img = document.createElement('img');
    img.src = imageData;
    img.alt = 'Vista previa de la imagen del producto';
    box.appendChild(img);
  } else {
    var ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.style.background = 'radial-gradient(circle at 30% 25%, ' + liquid + '66, ' + liquid + '33 55%, rgba(26,19,48,0.5) 100%)';
    box.appendChild(ph);
  }
}

function clearImageFromUpload() {
  // When an external URL is pasted, drop the local upload.
  document.getElementById('f-image').value = '';
}

/* ============================================================
 * Lista de productos
 * ============================================================ */
function renderList() {
  var list = document.getElementById('product-list');
  list.textContent = '';
  document.getElementById('count-label').textContent = catalog.length;

  if (!catalog.length) {
    var empty = document.createElement('div');
    empty.className = 'list-empty glass';
    empty.textContent = 'El catálogo está vacío. Agregá tu primer producto con el formulario.';
    list.appendChild(empty);
    return;
  }

  catalog.slice().sort(function (a, b) { return a.brand.localeCompare(b.brand, 'es') || a.name.localeCompare(b.name, 'es'); })
    .forEach(function (p) {
      list.appendChild(buildRow(p));
    });
}

function buildRow(p) {
  var row = document.createElement('div');
  row.className = 'row-item glass';

  var thumb = document.createElement('div');
  thumb.className = 'row-thumb';
  if (p.image) {
    var img = document.createElement('img');
    img.src = p.image;
    img.alt = p.brand + ' ' + p.name;
    img.addEventListener('error', function () {
      img.replaceWith(makePlaceholder(p.liquid));
    });
    thumb.appendChild(img);
  } else {
    thumb.appendChild(makePlaceholder(p.liquid));
  }
  row.appendChild(thumb);

  var info = document.createElement('div');
  info.className = 'row-info';
  var br = document.createElement('div');
  br.className = 'row-brand';
  br.textContent = p.brand;
  var nm = document.createElement('div');
  nm.className = 'row-name';
  nm.textContent = p.name;
  info.appendChild(br);
  info.appendChild(nm);

  var badges = document.createElement('div');
  badges.className = 'row-badges';
  if (p.badge) {
    var chip = document.createElement('span');
    chip.className = 'mini-chip';
    chip.textContent = p.badge;
    badges.appendChild(chip);
  }
  var fchip = document.createElement('span');
  fchip.className = 'mini-chip plain';
  fchip.textContent = p.family;
  badges.appendChild(fchip);
  info.appendChild(badges);

  row.appendChild(info);

  var price = document.createElement('div');
  price.className = 'row-price';
  price.textContent = fmtARS(p.price);
  if (p.decantPrice != null) {
    var dec = document.createElement('span');
    dec.className = 'small';
    dec.textContent = 'Decant: ' + fmtARS(p.decantPrice);
    price.appendChild(dec);
  }
  row.appendChild(price);

  var actions = document.createElement('div');
  actions.className = 'row-actions';

  var edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'btn-secondary';
  edit.textContent = 'Editar';
  edit.addEventListener('click', function () {
    fillForm(p);
    document.getElementById('form-card-target') || document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth' });
  });

  var del = document.createElement('button');
  del.type = 'button';
  del.className = 'btn-secondary';
  del.style.borderColor = 'rgba(224,93,93,0.5)';
  del.style.color = '#e08a8a';
  del.textContent = 'Eliminar';
  del.addEventListener('click', function () {
    if (confirm('¿Eliminar "' + p.brand + ' ' + p.name + '" del catálogo?')) {
      catalog = catalog.filter(function (x) { return x.id !== p.id; });
      saveCatalog();
      renderList();
      if (editingId === p.id) resetForm();
      toast('Producto eliminado', 'success');
    }
  });

  actions.appendChild(edit);
  actions.appendChild(del);
  row.appendChild(actions);
  return row;
}

function makePlaceholder(liquid) {
  var div = document.createElement('div');
  div.className = 'placeholder';
  div.style.background = 'radial-gradient(circle at 30% 25%, ' + (liquid || '#e0a63a') + '66, ' + (liquid || '#e0a63a') + '33 55%, rgba(26,19,48,0.5) 100%)';
  return div;
}

/* ============================================================
 * Importar / descargar
 * ============================================================ */
function handleImport(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var data = JSON.parse(reader.result);
      var norm = normalizeData(data);
      if (!norm) throw new Error('catálogo inválido');
      if (catalog.length && !confirm('¿Reemplazar el catálogo actual (' + catalog.length + ' productos) por el archivo cargado?')) {
        e.target.value = '';
        return;
      }
      catalog = norm.products;
      if (norm.settings) settings = Object.assign({}, DEFAULT_SETTINGS, norm.settings);
      saveCatalog();
      renderList();
      fillSettingsForm();
      resetForm();
      showNotice('Catálogo reemplazado con ' + norm.products.length + ' productos' + (norm.settings ? ' y ajustes importados.' : ' desde el archivo.'), 'success');
    } catch (err) {
      showNotice('El archivo no es un JSON válido con un array de productos.', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function handleDownload() {
  var blob = new Blob([JSON.stringify({ settings: settings, products: catalog }, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'products.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  toast('products.json descargado ✓', 'success');
}

/* ============================================================
 * Inicialización
 * ============================================================ */
function init() {
  fillFamilySelect();
  fillBadgeSelect();
  fillSettingsForm();

  document.getElementById('btn-save').addEventListener('click', handleSave);
  document.getElementById('btn-cancel').addEventListener('click', resetForm);
  document.getElementById('btn-save-settings').addEventListener('click', handleSaveSettings);

  document.getElementById('f-image').addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      imageData = reader.result;
      document.getElementById('f-image-url').value = '';
      renderImagePreview();
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('f-image-url').addEventListener('input', function () {
    var url = this.value.trim();
    if (url) {
      imageData = url;
      clearImageFromUpload();
      renderImagePreview();
    } else if (imageData && imageData.indexOf('data:') !== 0) {
      imageData = null;
      renderImagePreview();
    }
  });

  document.getElementById('f-liquid').addEventListener('input', function () {
    updateLiquidHex();
    renderImagePreview();
  });

  document.getElementById('f-badge').addEventListener('change', function () {
    document.getElementById('custom-badge-wrap').hidden = this.value !== '__custom__';
  });

  document.getElementById('f-brand').addEventListener('input', function () {
    var idEl = document.getElementById('f-id');
    if (!editingId && !idEl.value.trim()) {
      var name = document.getElementById('f-name').value.trim();
      idEl.value = slugify(this.value.trim() + '-' + name);
    }
  });
  document.getElementById('f-name').addEventListener('input', function () {
    var idEl = document.getElementById('f-id');
    if (!editingId && !idEl.value.trim()) {
      var brand = document.getElementById('f-brand').value.trim();
      idEl.value = slugify(brand + '-' + this.value.trim());
    }
  });

  document.getElementById('btn-import').addEventListener('click', function () {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', handleImport);
  document.getElementById('btn-download').addEventListener('click', handleDownload);

  renderList();
  resetForm();
}