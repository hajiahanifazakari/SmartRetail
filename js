/* ============================================
   SmartRetail — app.js
   Pocket Business Manager for Entrepreneurs
   ============================================ */

// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
let sales = [];
let inventory = [];
let settings = { storeName: 'My Store', currency: 'GH₵' };
let dismissedAlerts = [];

// ═══════════════════════════════════════════════
//  AUTH GUARD
// ═══════════════════════════════════════════════
let userProfile = null;

function checkAuth() {
  const raw = localStorage.getItem('sr_profile');
  if (!raw) { window.location.href = 'auth.html'; return false; }
  const p = JSON.parse(raw);
  if (!p || !p.loggedIn) { window.location.href = 'auth.html'; return false; }
  userProfile = p;
  return true;
}

function logout() {
  if (!confirm('Sign out of SmartRetail?')) return;
  // Save current data under the user's data key before leaving
  if (userProfile && userProfile.dataKey) {
    const snapshot = {
      sales:     JSON.parse(localStorage.getItem('smartretail_sales')     || '[]'),
      inventory: JSON.parse(localStorage.getItem('smartretail_inventory') || '[]')
    };
    localStorage.setItem(userProfile.dataKey, JSON.stringify(snapshot));
  }
  // Mark as logged out
  if (userProfile) {
    userProfile.loggedIn = false;
    localStorage.setItem('sr_profile', JSON.stringify(userProfile));
    // Update in users array too
    const users = JSON.parse(localStorage.getItem('sr_users') || '[]');
    const idx   = users.findIndex(u => u.email === userProfile.email);
    if (idx > -1) { users[idx].loggedIn = false; localStorage.setItem('sr_users', JSON.stringify(users)); }
  }
  window.location.href = 'auth.html';
}

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
function init() {
  if (!checkAuth()) return;

  const savedSettings = localStorage.getItem('smartretail_settings');
  if (savedSettings) settings = JSON.parse(savedSettings);

  const savedSales = localStorage.getItem('smartretail_sales');
  if (savedSales) sales = JSON.parse(savedSales);

  const savedInv = localStorage.getItem('smartretail_inventory');
  if (savedInv) inventory = JSON.parse(savedInv);

  const savedDA = localStorage.getItem('smartretail_dismissed');
  if (savedDA) dismissedAlerts = JSON.parse(savedDA);

  updateDateDisplay();
  applySettings();
  refreshDashboard();
  renderLedger();
  renderInventory();
  renderAlerts();
}

function updateDateDisplay() {
  const now  = new Date();
  const opts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  const str  = now.toLocaleDateString('en-GB', opts);
  document.getElementById('header-date').textContent  = str;
  document.getElementById('sidebar-date').textContent = str;
}

function applySettings() {
  // Sidebar store info
  document.getElementById('sidebar-store-name').textContent = settings.storeName;

  // Show profile info from userProfile if available
  if (userProfile) {
    document.getElementById('sidebar-avatar').textContent    = userProfile.avatar || '🏪';
    document.getElementById('sidebar-user-email').textContent = userProfile.email  || '';
    // Personalised greeting using first name
    const firstName = (userProfile.fullName || settings.storeName).split(' ')[0];
    document.getElementById('greeting-name').textContent = firstName;
  } else {
    document.getElementById('greeting-name').textContent = settings.storeName.split(' ')[0];
  }

  document.getElementById('set-store-name').value = settings.storeName;
  document.getElementById('set-currency').value   = settings.currency;
}

// setupStore() removed — handled by auth.html onboarding flow

// ═══════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════
const sectionNames = {
  dashboard: 'Dashboard',
  sales:     'Record Sale',
  ledger:    'Sales Ledger',
  inventory: 'Inventory',
  alerts:    'Alerts',
  settings:  'Settings'
};

function showSection(id, btn) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');

  // Update sidebar active state
  document.querySelectorAll('#sidebar .nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-title').textContent = sectionNames[id] || id;

  document.querySelectorAll('#sidebar .nav-item').forEach(b => {
    if (b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + id + "'")) {
      b.classList.add('active');
    }
  });

  closeSidebar();

  // Re-render data-dependent sections
  if (id === 'ledger')    renderLedger();
  if (id === 'alerts')    renderAlerts();
  if (id === 'inventory') renderInventory();
}

function setMobileActive(btn) {
  document.querySelectorAll('.mobile-nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

// ═══════════════════════════════════════════════
//  RECORD SALE
// ═══════════════════════════════════════════════
function recordSale() {
  const product  = document.getElementById('s-product').value.trim();
  const category = document.getElementById('s-category').value;
  const qty      = parseFloat(document.getElementById('s-qty').value);
  const cost     = parseFloat(document.getElementById('s-cost').value);
  const sell     = parseFloat(document.getElementById('s-sell').value);
  const customer = document.getElementById('s-customer').value.trim() || 'Walk-in';

  // Validation
  if (!product)             { toast('Please enter a product name', 'error'); return; }
  if (!qty || qty < 1)      { toast('Quantity must be at least 1', 'error'); return; }
  if (isNaN(cost) || cost < 0) { toast('Enter a valid cost price', 'error'); return; }
  if (isNaN(sell) || sell < 0) { toast('Enter a valid selling price', 'error'); return; }

  // Calculations
  const revenue   = sell * qty;
  const totalCost = cost * qty;
  const profit    = revenue - totalCost;

  const sale = {
    id: Date.now(),
    product, category, qty, cost, sell,
    revenue, totalCost, profit,
    customer,
    timestamp: new Date().toISOString()
  };

  sales.unshift(sale);

  // Auto-deduct from inventory if item is tracked
  const invIdx = inventory.findIndex(
    i => i.name.toLowerCase() === product.toLowerCase()
  );
  if (invIdx > -1) {
    inventory[invIdx].qty = Math.max(0, inventory[invIdx].qty - qty);
  }

  saveData();
  clearSaleForm();
  refreshDashboard();
  renderAlerts();

  const sym = settings.currency;
  toast(`Sale recorded! Revenue: ${sym}${revenue.toFixed(2)} | Profit: ${sym}${profit.toFixed(2)}`, 'success');
  showSection('dashboard', null);
}

function updatePreview() {
  const qty  = parseFloat(document.getElementById('s-qty').value)  || 1;
  const cost = parseFloat(document.getElementById('s-cost').value) || 0;
  const sell = parseFloat(document.getElementById('s-sell').value) || 0;
  const sym  = settings.currency;

  const revenue   = sell * qty;
  const totalCost = cost * qty;
  const profit    = revenue - totalCost;
  const margin    = revenue > 0 ? (profit / revenue) * 100 : 0;

  document.getElementById('prev-revenue').textContent = sym + revenue.toFixed(2);
  document.getElementById('prev-cost').textContent    = sym + totalCost.toFixed(2);
  document.getElementById('prev-profit').textContent  = sym + profit.toFixed(2);
  document.getElementById('prev-profit').style.color  = profit >= 0 ? 'var(--emerald)' : 'var(--coral)';
  document.getElementById('prev-margin').textContent  = margin.toFixed(1) + '%';
  document.getElementById('prev-margin').style.color  = margin >= 0 ? 'var(--emerald)' : 'var(--coral)';
}

function clearSaleForm() {
  ['s-product', 's-qty', 's-cost', 's-sell', 's-customer'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('s-category').value = 'General';
  document.getElementById('prev-revenue').textContent = '—';
  document.getElementById('prev-cost').textContent    = '—';
  document.getElementById('prev-profit').textContent  = '—';
  document.getElementById('prev-margin').textContent  = '—';
}

// ═══════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════
function refreshDashboard() {
  const sym         = settings.currency;
  const totalRev    = sales.reduce((a, s) => a + s.revenue, 0);
  const totalProfit = sales.reduce((a, s) => a + s.profit,  0);
  const margin      = totalRev > 0 ? (totalProfit / totalRev * 100) : 0;
  const alertCount  = getAlerts().length;

  animateValue('dash-revenue',     sym + totalRev.toFixed(2));
  animateValue('dash-profit',      sym + totalProfit.toFixed(2));
  animateValue('dash-sales-count', sales.length);
  animateValue('dash-alerts-count', alertCount);

  document.getElementById('dash-revenue-sub').textContent =
    `From ${sales.length} sale${sales.length !== 1 ? 's' : ''}`;
  document.getElementById('dash-profit-sub').textContent =
    `Margin: ${margin.toFixed(1)}%`;

  // Alert badge in sidebar
  const badge = document.getElementById('alert-badge');
  if (alertCount > 0) { badge.style.display = 'inline'; badge.textContent = alertCount; }
  else                { badge.style.display = 'none'; }

  renderMiniChart();
  renderRecentList();
}

function animateValue(id, val) {
  const el = document.getElementById(id);
  el.classList.remove('tick');
  void el.offsetWidth; // force reflow to restart animation
  el.textContent = val;
  el.classList.add('tick');
}

function renderMiniChart() {
  const chart  = document.getElementById('mini-chart');
  const labels = document.getElementById('mini-chart-labels');
  const last7  = sales.slice(0, 7).reverse();

  if (last7.length === 0) {
    chart.innerHTML  = '<div style="color:var(--muted);font-size:0.8rem;align-self:center;">No sales yet</div>';
    labels.innerHTML = '';
    return;
  }

  const maxRev = Math.max(...last7.map(s => s.revenue));
  chart.innerHTML  = '';
  labels.innerHTML = '';

  last7.forEach(s => {
    const pct = maxRev > 0 ? (s.revenue / maxRev * 100) : 10;

    const bar = document.createElement('div');
    bar.className    = 'bar';
    bar.style.height = pct + '%';
    bar.style.background = s.profit >= 0 ? 'var(--amber)' : 'var(--coral)';
    bar.title = `${s.product}: ${settings.currency}${s.revenue.toFixed(2)}`;
    chart.appendChild(bar);

    const lbl = document.createElement('div');
    lbl.style.flex      = '1';
    lbl.style.fontSize  = '0.6rem';
    lbl.style.color     = 'var(--muted)';
    lbl.style.textAlign = 'center';
    lbl.textContent = s.product.slice(0, 4);
    labels.appendChild(lbl);
  });
}

function renderRecentList() {
  const el  = document.getElementById('recent-list');
  const sym = settings.currency;

  if (sales.length === 0) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🧾</div><div class="empty-desc">No transactions yet</div></div>';
    return;
  }

  el.innerHTML = sales.slice(0, 5).map(s => {
    const d    = new Date(s.timestamp);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div class="recent-item">
      <div>
        <div class="recent-name">${esc(s.product)}</div>
        <div class="recent-time">${time} · ${s.qty} unit${s.qty !== 1 ? 's' : ''}</div>
      </div>
      <div style="color:${s.profit >= 0 ? 'var(--emerald)' : 'var(--coral)'};font-weight:600">
        ${sym}${s.profit.toFixed(2)}
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════
//  SALES LEDGER
// ═══════════════════════════════════════════════
function renderLedger() {
  const tbody = document.getElementById('ledger-body');
  const sym   = settings.currency;

  if (sales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11">
      <div class="empty">
        <div class="empty-icon">📋</div>
        <div class="empty-title">No sales yet</div>
        <div class="empty-desc">Record your first sale to see it here.</div>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = sales.map((s, i) => {
    const d         = new Date(s.timestamp);
    const dateStr   = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const timeStr   = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const profClass = s.profit >= 0 ? 'badge-profit' : 'badge-loss';
    return `<tr>
      <td style="color:var(--muted)">${sales.length - i}</td>
      <td><strong>${esc(s.product)}</strong></td>
      <td><span style="font-size:0.72rem;color:var(--muted)">${esc(s.category)}</span></td>
      <td>${s.qty}</td>
      <td>${sym}${s.cost.toFixed(2)}</td>
      <td>${sym}${s.sell.toFixed(2)}</td>
      <td style="color:var(--amber);font-weight:600">${sym}${s.revenue.toFixed(2)}</td>
      <td><span class="badge ${profClass}">${s.profit >= 0 ? '▲' : '▼'} ${sym}${Math.abs(s.profit).toFixed(2)}</span></td>
      <td style="color:var(--muted)">${esc(s.customer)}</td>
      <td style="color:var(--muted);white-space:nowrap">${dateStr} ${timeStr}</td>
      <td><button class="btn btn-danger" onclick="deleteSale(${s.id})">✕</button></td>
    </tr>`;
  }).join('');
}

function deleteSale(id) {
  sales = sales.filter(s => s.id !== id);
  saveData(); refreshDashboard(); renderLedger(); renderAlerts();
  toast('Sale removed', 'warn');
}

function clearAllSales() {
  if (!confirm('Delete ALL sales records? This cannot be undone.')) return;
  sales = [];
  saveData(); refreshDashboard(); renderLedger(); renderAlerts();
  toast('All sales cleared', 'warn');
}

function exportCSV() {
  if (sales.length === 0) { toast('No sales to export', 'error'); return; }

  const sym    = settings.currency;
  const header = ['#', 'Product', 'Category', 'Qty', 'Unit Cost', 'Sell Price', 'Revenue', 'Profit', 'Customer', 'Date'].join(',');
  const rows   = sales.map((s, i) => [
    sales.length - i,
    `"${s.product}"`,
    `"${s.category}"`,
    s.qty,
    s.cost.toFixed(2),
    s.sell.toFixed(2),
    s.revenue.toFixed(2),
    s.profit.toFixed(2),
    `"${s.customer}"`,
    new Date(s.timestamp).toLocaleString()
  ].join(','));

  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${settings.storeName.replace(/\s+/g, '_')}_sales.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exported!', 'success');
}

// ═══════════════════════════════════════════════
//  INVENTORY
// ═══════════════════════════════════════════════
function addInventoryItem() {
  const name      = document.getElementById('i-name').value.trim();
  const category  = document.getElementById('i-category').value;
  const qty       = parseFloat(document.getElementById('i-qty').value);
  const threshold = parseFloat(document.getElementById('i-threshold').value);
  const cost      = parseFloat(document.getElementById('i-cost').value) || 0;
  const expiry    = document.getElementById('i-expiry').value;

  if (!name)                        { toast('Product name required', 'error'); return; }
  if (isNaN(qty) || qty < 0)        { toast('Enter a valid quantity', 'error'); return; }
  if (isNaN(threshold) || threshold < 1) { toast('Low stock threshold must be at least 1', 'error'); return; }

  // Update if already exists, otherwise add new
  const existing = inventory.findIndex(
    i => i.name.toLowerCase() === name.toLowerCase()
  );

  if (existing > -1) {
    inventory[existing] = { ...inventory[existing], category, qty, threshold, cost, expiry };
    toast(`${name} updated in inventory`, 'success');
  } else {
    inventory.push({
      id: Date.now(),
      name, category, qty, threshold, cost, expiry,
      addedAt: new Date().toISOString()
    });
    toast(`${name} added to inventory`, 'success');
  }

  saveData(); renderInventory(); refreshDashboard(); renderAlerts(); clearInvForm();
}

function renderInventory(filter = 'all') {
  const grid = document.getElementById('inventory-grid');
  const sym  = settings.currency;
  const items = filter === 'low'
    ? inventory.filter(i => i.qty <= i.threshold)
    : inventory;

  document.getElementById('inv-count-label').textContent =
    `${inventory.length} item${inventory.length !== 1 ? 's' : ''} tracked`;

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
      <div class="empty-icon">📦</div>
      <div class="empty-title">${filter === 'low' ? 'No low stock items!' : 'Inventory is empty'}</div>
      <div class="empty-desc">${filter === 'low' ? 'All items are well stocked.' : 'Add your first product above.'}</div>
    </div>`;
    return;
  }

  grid.innerHTML = items.map(item => {
    const isLow    = item.qty <= item.threshold;
    const pct      = item.threshold > 0
      ? Math.min(100, (item.qty / Math.max(item.qty, item.threshold * 3)) * 100)
      : 50;
    const barColor = isLow
      ? 'var(--coral)'
      : item.qty <= item.threshold * 2
        ? 'var(--amber)'
        : 'var(--emerald)';

    let expiryBadge = '';
    let nearExpiry  = false;

    if (item.expiry) {
      const today    = new Date(); today.setHours(0, 0, 0, 0);
      const exp      = new Date(item.expiry);
      const daysLeft = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

      if (daysLeft < 0) {
        expiryBadge = `<span class="badge badge-loss" style="margin-top:6px;">Expired</span>`;
      } else if (daysLeft <= 7) {
        expiryBadge = `<span class="badge badge-near" style="margin-top:6px;">⏰ Expires in ${daysLeft}d</span>`;
        nearExpiry  = true;
      } else {
        expiryBadge = `<span class="badge badge-ok" style="margin-top:6px;">✅ Expires ${new Date(item.expiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>`;
      }
    }

    return `<div class="inv-card ${isLow ? 'low-stock' : nearExpiry ? 'near-expiry' : ''}">
      <div class="inv-header">
        <div>
          <div class="inv-name">${esc(item.name)}</div>
          <span class="inv-category">${esc(item.category)}</span>
          ${expiryBadge}
        </div>
        ${isLow ? '<span class="badge badge-low">⚠️ Low</span>' : ''}
      </div>
      <div class="inv-stats">
        <div class="inv-stat">
          <div class="inv-stat-label">In Stock</div>
          <div class="inv-stat-value" style="color:${barColor}">${item.qty} units</div>
        </div>
        <div class="inv-stat">
          <div class="inv-stat-label">Alert At</div>
          <div class="inv-stat-value">${item.threshold} units</div>
        </div>
        ${item.cost > 0 ? `
        <div class="inv-stat">
          <div class="inv-stat-label">Unit Cost</div>
          <div class="inv-stat-value">${sym}${item.cost.toFixed(2)}</div>
        </div>
        <div class="inv-stat">
          <div class="inv-stat-label">Stock Value</div>
          <div class="inv-stat-value">${sym}${(item.cost * item.qty).toFixed(2)}</div>
        </div>` : ''}
      </div>
      <div class="stock-bar-wrap">
        <div class="stock-bar-label"><span>Stock Level</span><span>${Math.round(pct)}%</span></div>
        <div class="stock-bar-bg">
          <div class="stock-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
      </div>
      <div class="inv-actions">
        <button class="btn-restock" onclick="restockItem(${item.id})">+ Restock</button>
        <button class="btn btn-danger" onclick="deleteInvItem(${item.id})">✕</button>
      </div>
    </div>`;
  }).join('');
}

function restockItem(id) {
  const item = inventory.find(i => i.id === id);
  if (!item) return;

  const amt = prompt(`How many units to add to "${item.name}"? (Current: ${item.qty})`);
  const n   = parseFloat(amt);
  if (isNaN(n) || n <= 0) { toast('Invalid quantity', 'error'); return; }

  item.qty += n;
  saveData(); renderInventory(); refreshDashboard(); renderAlerts();
  toast(`${item.name} restocked (+${n} units → ${item.qty} total)`, 'success');
}

function deleteInvItem(id) {
  if (!confirm('Remove this item from inventory?')) return;
  inventory = inventory.filter(i => i.id !== id);
  saveData(); renderInventory(); refreshDashboard(); renderAlerts();
  toast('Item removed', 'warn');
}

function clearAllInventory() {
  if (!confirm('Delete ALL inventory? This cannot be undone.')) return;
  inventory = [];
  saveData(); renderInventory(); refreshDashboard(); renderAlerts();
  toast('Inventory cleared', 'warn');
}

function clearInvForm() {
  ['i-name', 'i-qty', 'i-threshold', 'i-cost', 'i-expiry'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('i-category').value = 'General';
}

function filterInv(type) {
  renderInventory(type);
}

// ═══════════════════════════════════════════════
//  ALERTS
// ═══════════════════════════════════════════════
function getAlerts() {
  const alerts = [];
  const today  = new Date(); today.setHours(0, 0, 0, 0);

  inventory.forEach(item => {
    // Low stock alert
    if (item.qty <= item.threshold) {
      alerts.push({
        id:    'low-' + item.id,
        type:  'error',
        icon:  '📦',
        title: `Low Stock: ${item.name}`,
        desc:  `Only ${item.qty} unit${item.qty !== 1 ? 's' : ''} left — reorder soon. Threshold: ${item.threshold}`,
        time:  'Inventory Alert'
      });
    }

    // Expiry alerts
    if (item.expiry) {
      const exp      = new Date(item.expiry);
      const daysLeft = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

      if (daysLeft < 0) {
        alerts.push({
          id:    'exp-' + item.id,
          type:  'error',
          icon:  '⏰',
          title: `Expired: ${item.name}`,
          desc:  `This item expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago. Remove from sale.`,
          time:  'Expiry Alert'
        });
      } else if (daysLeft <= 7) {
        alerts.push({
          id:    'expwarn-' + item.id,
          type:  'warning',
          icon:  '⚠️',
          title: `Expiring Soon: ${item.name}`,
          desc:  `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Consider running a promotion.`,
          time:  'Expiry Warning'
        });
      }
    }
  });

  return alerts.filter(a => !dismissedAlerts.includes(a.id));
}

function renderAlerts() {
  const container = document.getElementById('alerts-list');
  const alerts    = getAlerts();

  // Update badge
  const badge = document.getElementById('alert-badge');
  if (alerts.length > 0) { badge.style.display = 'inline'; badge.textContent = alerts.length; }
  else                   { badge.style.display = 'none'; }

  if (alerts.length === 0) {
    container.innerHTML = `<div class="empty">
      <div class="empty-icon">✅</div>
      <div class="empty-title">All Clear!</div>
      <div class="empty-desc">No alerts right now. Your inventory is healthy.</div>
    </div>`;
    return;
  }

  container.innerHTML = alerts.map(a => `
    <div class="alert-item ${a.type === 'warning' ? 'warning' : ''}">
      <div class="alert-icon">${a.icon}</div>
      <div style="flex:1">
        <div class="alert-title">${esc(a.title)}</div>
        <div class="alert-desc">${esc(a.desc)}</div>
        <div class="alert-time">${a.time}</div>
      </div>
      <button class="btn btn-secondary"
        style="font-size:0.72rem;padding:6px 10px;white-space:nowrap"
        onclick="dismissAlert('${a.id}')">Dismiss</button>
    </div>`).join('');
}

function dismissAlert(id) {
  dismissedAlerts.push(id);
  localStorage.setItem('smartretail_dismissed', JSON.stringify(dismissedAlerts));
  renderAlerts(); refreshDashboard();
}

function dismissAllAlerts() {
  const alerts = getAlerts();
  alerts.forEach(a => dismissedAlerts.push(a.id));
  localStorage.setItem('smartretail_dismissed', JSON.stringify(dismissedAlerts));
  renderAlerts(); refreshDashboard();
  toast('All alerts dismissed', 'success');
}

// ═══════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════
function saveSettings(silent = false) {
  const nameEl = document.getElementById('set-store-name');
  const currEl = document.getElementById('set-currency');
  if (nameEl) settings.storeName = nameEl.value.trim() || settings.storeName;
  if (currEl) settings.currency  = currEl.value || settings.currency;

  localStorage.setItem('smartretail_settings', JSON.stringify(settings));
  applySettings(); refreshDashboard(); renderLedger(); renderInventory();
  if (!silent) toast('Settings saved!', 'success');
}

function resetAll() {
  if (!confirm('⚠️ FULL RESET: Delete ALL data including sales, inventory, and settings? This cannot be undone.')) return;
  localStorage.clear();
  location.reload();
}

// ═══════════════════════════════════════════════
//  PERSISTENCE
// ═══════════════════════════════════════════════
function saveData() {
  localStorage.setItem('smartretail_sales',     JSON.stringify(sales));
  localStorage.setItem('smartretail_inventory', JSON.stringify(inventory));
}

// ═══════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════
function toast(msg, type = 'success') {
  const container = document.getElementById('toast');
  const icons     = { success: '✅', error: '❌', warn: '⚠️' };

  const el = document.createElement('div');
  el.className = `toast-item ${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ═══════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

// ═══════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════
init();