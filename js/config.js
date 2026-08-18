/* ============================================================
 * js/config.js — shared module (constants, shared state, utilities
 * and the data layer). Must be loaded BEFORE js/store.js,
 * js/cart.js and js/admin.js (classic scripts, file:// compatible).
 * ============================================================ */

// Owner's WhatsApp number (country + area + number, no "+", no spaces).
const WHATSAPP_NUMBER = '5491131797343';

// localStorage key shared with admin.html (admin edits flow to the store).
const STORAGE_KEY = 'aluxab_products';

// Cart persistence key.
const CART_KEY = 'aluxab_cart';

// Default store texts (overridable from admin.html settings, saved in products.json).
const DEFAULT_SETTINGS = {
  whatsappNumber: WHATSAPP_NUMBER,
  greeting: '¡Hola Al Luxab Parfums! 👋 Quiero hacer el siguiente pedido:',
  headerDetail: '🛍️ *Detalle de la compra:*',
  footerText: 'Quedo a la espera para coordinar el pago y la entrega. ¡Muchas gracias!'
};

const FAMILIES = ['Amaderado', 'Floral', 'Oriental', 'Fresco', 'Cítrico'];

const BADGES = ['Más Vendido', 'Nuevo', 'Edición Limitada', 'Oud Intenso', 'Clásico'];

const PAY_LABELS = {
  efectivo: 'Transferencia / Efectivo (10% OFF)',
  quincenal: 'Cuotas Quincenales (3 cuotas)',
  mensual: 'Cuotas Mensuales (2 cuotas)'
};

/* ============================================================
 * Estado global
 * ============================================================ */
let catalog = [];
let settings = null; // admin overrides settings later

/* ============================================================
 * Utilidades
 * ============================================================ */
function fmtARS(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

function normalize(str) {
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toast(msg, type) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (type || '');
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { el.className = 'toast'; }, 2600);
}

/* ============================================================
 * Capa de datos (robusta)
 * ============================================================ */
function normalizeData(data) {
  if (Array.isArray(data)) return { products: data, settings: null };
  if (data && typeof data === 'object' && Array.isArray(data.products)) {
    return { products: data.products, settings: data.settings || null };
  }
  return null;
}

function applySettings(s) {
  settings = Object.assign({}, DEFAULT_SETTINGS, s || {});
}

function saveStoreData(settingsObj, productsArr) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings: settingsObj, products: productsArr }));
  } catch (e) {
    return false;
  }
  return true;
}

function loadCatalog(callback) {
  var banner = document.getElementById('error-banner');

  // 1) localStorage primero (ediciones del admin)
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      var norm = normalizeData(parsed);
      if (norm && norm.products.length) {
        catalog = norm.products;
        applySettings(norm.settings);
        callback();
        return;
      }
    }
  } catch (e) { /* ignore corrupt data, fall through */ }

  // 2) fetch('products.json')
  fetch('products.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var norm = normalizeData(data);
      if (!norm) throw new Error('products.json no es un catálogo válido');
      catalog = norm.products;
      applySettings(norm.settings);
      callback();
    })
    .catch(function () {
      catalog = [];
      applySettings(null);
      banner.hidden = false;
      banner.textContent = 'No se pudo cargar el catálogo. Abrí el proyecto con un servidor local (p. ej. Live Server o `python -m http.server`) o subí products.json desde el panel de administración.';
      callback();
    });
}