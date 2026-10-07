/* ============================================
   Stocknexa — app.js
   Pocket Business Manager for Entrepreneurs
   ============================================ */

// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
let sales = [];
let inventory = [];
let settings = { storeName: 'My Store', currency: 'GH₵' };
let dismissedAlerts = [];
let userProfile = null;

// ═══════════════════════════════════════════════
//  AUTH GUARD & SESSION
// ═══════════════════════════════════════════════
function checkAuth() {
  const raw = localStorage.getItem('sr_profile');
  if (!raw) {
    window.location.href = 'auth.html';
    return false;
  }
  try {
    const p = JSON.parse(raw);
    if (!p || !p.loggedIn || !p.email) {
      window.location.href = 'auth.html';
      return false;
    }
    userProfile = p;
    return true;
  } catch (e) {
    window.location.href = 'auth.html';
    return false;
  }
}

function logout() {
  if (!confirm('Sign out of Stocknexa?')) return;
  
  // Save current sales & inventory data under the user's data key before leaving
  if (userProfile && userProfile.dataKey) {
    const snapshot = {
      sales: sales,
      inventory: inventory,
      settings: settings
    };
    localStorage.setItem(userProfile.dataKey, JSON.stringify(snapshot));
  }
  
  // Mark user as logged out in sr_profile & sr_users list
  if (userProfile) {
    userProfile.loggedIn = false;
    localStorage.setItem('sr_profile', JSON.stringify(userProfile));
    
    const users = JSON.parse(localStorage.getItem('sr_users') || '[]');
    const idx = users.findIndex(u => u.email.toLowerCase() === userProfile.email.toLowerCase());
    if (idx > -1) {
      users[idx].loggedIn = false;
      localStorage.setItem('sr_users', JSON.stringify(users));
    }
  }
  
  window.location.href = 'auth.html';
}

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
function init() {
  if (!checkAuth()) return;

  const savedSettings = localStorage.getItem('smartretail_settings');
  if (savedSettings) {
    try { settings = JSON.parse(savedSettings); } catch (e) {}
  }

  const savedSales = localStorage.getItem('smartretail_sales');
  if (savedSales) {
    try { sales = JSON.parse(savedSales); } catch (e) {}
  }

  const savedInv = localStorage.getItem('smartretail_inventory');
  if (savedInv) {
    try { inventory = JSON.parse(savedInv); } catch (e) {}
  }

  const savedDA = localStorage.getItem('smartretail_dismissed');
  if (savedDA) {
    try { dismissedAlerts = JSON.parse(savedDA); } catch (e) {}
  }

  updateDateDisplay();
  applySettings();
  refreshDashboard();
  renderLedger();
  renderInventory();
  renderAlerts();
}

function updateDateDisplay() {
  const now = new Date();
  const opts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  const str = now.toLocaleDateString('en-GB', opts);
  const headerDate = document.getElementById('header-date');
  const sidebarDate = document.getElementById('sidebar-date');
  if (headerDate) headerDate.textContent = str;
  if (sidebarDate) sidebarDate.textContent = str;
}

function applySettings() {
  const sidebarStoreName = document.getElementById('sidebar-store-name');
  if (sidebarStoreName) sidebarStoreName.textContent = settings.storeName || 'My Store';

  if (userProfile) {
    const avatarEl = document.getElementById('sidebar-avatar');
    const emailEl = document.getElementById('sidebar-user-email');
    const greetingEl = document.getElementById('greeting-name');
    
    if (avatarEl) avatarEl.textContent = userProfile.avatar || '🏪';
    if (emailEl) emailEl.textContent = userProfile.email || '';
    if (greetingEl) {
      const firstName = (userProfile.fullName || settings.storeName || 'Boss').split(' ')[0];
      greetingEl.textContent = firstName;
    }
  } else {
    const greetingEl = document.getElementById('greeting-name');
    if (greetingEl) greetingEl.textContent = (settings.storeName || 'Boss').split(' ')[0];
  }

  const setStoreNameInp = document.getElementById('set-store-name');
  const setCurrInp = document.getElementById('set-currency');
  if (setStoreNameInp) setStoreNameInp.value = settings.storeName || 'My Store';
  if (setCurrInp) setCurrInp.value = settings.currency || 'GH₵';
}

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
  const targetSec = document.getElementById('sec-' + id);
  if (!targetSec) return;

  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  targetSec.classList.add('active');

  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = sectionNames[id] || id;

  // Sidebar navigation active state
  document.querySelectorAll('#sidebar .nav-item').forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + id + "'")) {
      b.classList.add('active');
    }
  });

  // Mobile navigation active state
  document.querySelectorAll('#mobile-nav .mobile-nav-item').forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + id + "'")) {
      b.classList.add('active');
    }
  });

  closeSidebar();

  // Re-render data-dependent sections
  if (id === 'dashboard') refreshDashboard();
  if (id === 'ledger')    renderLedger();
  if (id === 'alerts')    renderAlerts();
  if (id === 'inventory') renderInventory();
}

function setMobileActive(btn) {
  document.querySelectorAll('.mobile-nav-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('show');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
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
  if (!product)                { toast('Please enter a product name', 'error'); return; }
  if (isNaN(qty) || qty < 1)   { toast('Quantity must be at least 1', 'error'); return; }
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

  const sym = settings.currency || 'GH₵';
  toast(`Sale recorded! Revenue: ${sym}${revenue.toFixed(2)} | Profit: ${sym}${profit.toFixed(2)}`, 'success');
  showSection('dashboard', null);
}

function updatePreview() {
  const qty  = parseFloat(document.getElementById('s-qty').value)  || 1;
  const cost = parseFloat(document.getElementById('s-cost').value) || 0;
  const sell = parseFloat(document.getElementById('s-sell').value) || 0;
  const sym  = settings.currency || 'GH₵';

  const revenue   = sell * qty;
  const totalCost = cost * qty;
  const profit    = revenue - totalCost;
  const margin    = revenue > 0 ? (profit / revenue) * 100 : 0;

  const prevRev = document.getElementById('prev-revenue');
  const prevCost = document.getElementById('prev-cost');
  const prevProfit = document.getElementById('prev-profit');
  const prevMargin = document.getElementById('prev-margin');

  if (prevRev) prevRev.textContent = sym + revenue.toFixed(2);
  if (prevCost) prevCost.textContent = sym + totalCost.toFixed(2);
  if (prevProfit) {
    prevProfit.textContent = sym + profit.toFixed(2);
    prevProfit.style.color = profit >= 0 ? 'var(--emerald)' : 'var(--coral)';
  }
  if (prevMargin) {
    prevMargin.textContent = margin.toFixed(1) + '%';
    prevMargin.style.color = margin >= 0 ? 'var(--emerald)' : 'var(--coral)';
  }
}

function clearSaleForm() {
  ['s-product', 's-qty', 's-cost', 's-sell', 's-customer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const catEl = document.getElementById('s-category');
  if (catEl) catEl.value = 'General';
  
  const prevRev = document.getElementById('prev-revenue');
  const prevCost = document.getElementById('prev-cost');
  const prevProfit = document.getElementById('prev-profit');
  const prevMargin = document.getElementById('prev-margin');
  if (prevRev) prevRev.textContent = '—';
  if (prevCost) prevCost.textContent = '—';
  if (prevProfit) prevProfit.textContent = '—';
  if (prevMargin) prevMargin.textContent = '—';
}

// ═══════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════
function refreshDashboard() {
  const sym         = settings.currency || 'GH₵';
  const totalRev    = sales.reduce((a, s) => a + (s.revenue || 0), 0);
  const totalProfit = sales.reduce((a, s) => a + (s.profit || 0),  0);
  const margin      = totalRev > 0 ? (totalProfit / totalRev * 100) : 0;
  const alertCount  = getAlerts().length;

  animateValue('dash-revenue',     sym + totalRev.toFixed(2));
  animateValue('dash-profit',      sym + totalProfit.toFixed(2));
  animateValue('dash-sales-count', sales.length);
  animateValue('dash-alerts-count', alertCount);

  const revSub = document.getElementById('dash-revenue-sub');
  const profSub = document.getElementById('dash-profit-sub');
  if (revSub) revSub.textContent = `From ${sales.length} sale${sales.length !== 1 ? 's' : ''}`;
  if (profSub) profSub.textContent = `Margin: ${margin.toFixed(1)}%`;

  // Alert badge in sidebar
  const badge = document.getElementById('alert-badge');
  if (badge) {
    if (alertCount > 0) {
      badge.style.display = 'inline';
      badge.textContent = alertCount;
    } else {
      badge.style.display = 'none';
    }
  }

  renderMiniChart();
  renderRecentList();
}

function animateValue(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('tick');
  void el.offsetWidth; // force reflow to restart animation
  el.textContent = val;
  el.classList.add('tick');
}

function renderMiniChart() {
  const chart  = document.getElementById('mini-chart');
  const labels = document.getElementById('mini-chart-labels');
  if (!chart || !labels) return;

  const last7 = sales.slice(0, 7).reverse();

  if (last7.length === 0) {
    chart.innerHTML  = '<div style="color:var(--muted);font-size:0.8rem;align-self:center;">No sales yet</div>';
    labels.innerHTML = '';
    return;
  }

  const maxRev = Math.max(...last7.map(s => s.revenue || 0));
  chart.innerHTML  = '';
  labels.innerHTML = '';

  const sym = settings.currency || 'GH₵';

  last7.forEach(s => {
    const pct = maxRev > 0 ? ((s.revenue || 0) / maxRev * 100) : 10;

    const bar = document.createElement('div');
    bar.className    = 'bar';
    bar.style.height = Math.max(8, pct) + '%';
    bar.style.background = (s.profit || 0) >= 0 ? 'var(--amber)' : 'var(--coral)';
    bar.title = `${s.product}: ${sym}${(s.revenue || 0).toFixed(2)}`;
    chart.appendChild(bar);

    const lbl = document.createElement('div');
    lbl.style.flex      = '1';
    lbl.style.fontSize  = '0.6rem';
    lbl.style.color     = 'var(--muted)';
    lbl.style.textAlign = 'center';
    lbl.textContent     = (s.product || '').slice(0, 4);
    labels.appendChild(lbl);
  });
}

function renderRecentList() {
  const el = document.getElementById('recent-list');
  if (!el) return;

  const sym = settings.currency || 'GH₵';

  if (sales.length === 0) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🧾</div><div class="empty-desc">No transactions yet</div></div>';
    return;
  }

  el.innerHTML = sales.slice(0, 5).map(s => {
    const d    = new Date(s.timestamp || Date.now());
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isProf = (s.profit || 0) >= 0;
    return `<div class="recent-item">
      <div>
        <div class="recent-name">${esc(s.product)}</div>
        <div class="recent-time">${time} · ${s.qty} unit${s.qty !== 1 ? 's' : ''}</div>
      </div>
      <div style="color:${isProf ? 'var(--emerald)' : 'var(--coral)'};font-weight:600">
        ${sym}${(s.profit || 0).toFixed(2)}
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════
//  SALES LEDGER
// ═══════════════════════════════════════════════
function renderLedger() {
  const tbody = document.getElementById('ledger-body');
  if (!tbody) return;

  const sym = settings.currency || 'GH₵';

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
    const d         = new Date(s.timestamp || Date.now());
    const dateStr   = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const timeStr   = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const prof      = s.profit || 0;
    const profClass = prof >= 0 ? 'badge-profit' : 'badge-loss';
    return `<tr>
      <td style="color:var(--muted)">${sales.length - i}</td>
      <td><strong>${esc(s.product)}</strong></td>
      <td><span style="font-size:0.72rem;color:var(--muted)">${esc(s.category)}</span></td>
      <td>${s.qty}</td>
      <td>${sym}${(s.cost || 0).toFixed(2)}</td>
      <td>${sym}${(s.sell || 0).toFixed(2)}</td>
      <td style="color:var(--amber);font-weight:600">${sym}${(s.revenue || 0).toFixed(2)}</td>
      <td><span class="badge ${profClass}">${prof >= 0 ? '▲' : '▼'} ${sym}${Math.abs(prof).toFixed(2)}</span></td>
      <td style="color:var(--muted)">${esc(s.customer)}</td>
      <td style="color:var(--muted);white-space:nowrap">${dateStr} ${timeStr}</td>
      <td><button class="btn btn-danger" onclick="deleteSale(${s.id})">✕</button></td>
    </tr>`;
  }).join('');
}

function deleteSale(id) {
  sales = sales.filter(s => s.id !== id);
  saveData();
  refreshDashboard();
  renderLedger();
  renderAlerts();
  toast('Sale removed', 'warn');
}

function clearAllSales() {
  if (!confirm('Delete ALL sales records? This cannot be undone.')) return;
  sales = [];
  saveData();
  refreshDashboard();
  renderLedger();
  renderAlerts();
  toast('All sales cleared', 'warn');
}

function exportCSV() {
  if (sales.length === 0) { toast('No sales to export', 'error'); return; }

  const header = ['#', 'Product', 'Category', 'Qty', 'Unit Cost', 'Sell Price', 'Revenue', 'Profit', 'Customer', 'Date'].join(',');
  const rows   = sales.map((s, i) => [
    sales.length - i,
    `"${(s.product || '').replace(/"/g, '""')}"`,
    `"${(s.category || '').replace(/"/g, '""')}"`,
    s.qty,
    (s.cost || 0).toFixed(2),
    (s.sell || 0).toFixed(2),
    (s.revenue || 0).toFixed(2),
    (s.profit || 0).toFixed(2),
    `"${(s.customer || '').replace(/"/g, '""')}"`,
    new Date(s.timestamp || Date.now()).toLocaleString()
  ].join(','));

  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${(settings.storeName || 'Stocknexa').replace(/\s+/g, '_')}_sales.csv`;
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

  if (!name)                             { toast('Product name required', 'error'); return; }
  if (isNaN(qty) || qty < 0)             { toast('Enter a valid quantity', 'error'); return; }
  if (isNaN(threshold) || threshold < 1) { toast('Low stock threshold must be at least 1', 'error'); return; }

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

  saveData();
  renderInventory();
  refreshDashboard();
  renderAlerts();
  clearInvForm();

  // Check low stock and send email alert safely
  checkLowStockAlerts();
}

function checkLowStockAlerts() {
  const lowStockItems = inventory
    .filter(item => item.qty <= (item.threshold || 10))
    .map(item => ({ name: item.name, stock: item.qty }));

  if (lowStockItems.length > 0 && userProfile) {
    const totalRev    = sales.reduce((a, s) => a + (s.revenue || 0), 0);
    const totalCost   = sales.reduce((a, s) => a + (s.totalCost || 0), 0);
    
    const financialData = {
      revenue: totalRev,
      cogs: totalCost,
      losses: 0,
      refunds: 0,
      overheads: 0,
      topProduct: sales.length > 0 ? sales[0].product : "N/A",
      topProductProfit: sales.length > 0 ? sales[0].profit : 0,
      underProduct: "None",
      underProductLoss: 0
    };

    sendLowStockBusinessAlert(userProfile, lowStockItems, financialData);
  }
}

/**
 * Generates email template and safely sends low-stock alert via EmailJS if configured
 */
function sendLowStockBusinessAlert(profile, lowStockProducts, financialData) {
  if (typeof emailjs === 'undefined') return;

  const today = new Date();
  const firstDay = new Date(today.setDate(today.getDate() - today.getDay() + 1));
  const lastDay = new Date(today.setDate(today.getDate() - today.getDay() + 7));
  
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const startDate = firstDay.toLocaleDateString('en-US', options);
  const endDate = lastDay.toLocaleDateString('en-US', options);

  let tableRows = "";
  lowStockProducts.forEach(prod => {
    const namePart = `│ ${prod.name.padEnd(23, ' ')} `;
    const stockPart = `│ ${(prod.stock + " units").padEnd(14, ' ')}│`;
    tableRows += namePart + stockPart + "\n";
  });
  tableRows = tableRows.trimEnd();

  const sym = settings.currency || 'GH₵';
  const formatCurr = (num) => Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const revenue = formatCurr(financialData.revenue);
  const cogs = formatCurr(financialData.cogs);
  const netProfit = formatCurr(financialData.revenue - financialData.cogs);

  const emailBody = `Dear ${profile.fullName || profile.name || 'Merchant'},

Here is your automated Stocknexa inventory & business alert for ${startDate} – ${endDate}.

─────────────────────────────────
🔴 LOW STOCK ALERT
─────────────────────────────────
The following products have fallen to or below critical threshold:

┌─────────────────────────┬───────────────┐
│ Product Name            │ Units in Stock │
├─────────────────────────┼───────────────┤
${tableRows}
└─────────────────────────┴───────────────┘

Please log in to your dashboard to restock: https://stocknexaai.netlify.app/

─────────────────────────────────
📈 PROFIT SUMMARY
─────────────────────────────────
Total Revenue: ${sym} ${revenue}
Cost of Goods Sold: ${sym} ${cogs}
Net Profit: ${sym} ${netProfit}

Best regards,
Stocknexa Automated Alerts`;

  // Safely trigger EmailJS only if real public key and service IDs are configured
  if (window.EMAILJS_SERVICE_ID && window.EMAILJS_TEMPLATE_ID && window.EMAILJS_PUBLIC_KEY) {
    emailjs.send(window.EMAILJS_SERVICE_ID, window.EMAILJS_TEMPLATE_ID, {
      to_email: profile.email,
      to_name: profile.fullName || profile.name,
      message_body: emailBody
    }, window.EMAILJS_PUBLIC_KEY)
    .then(() => {
      console.log("Stocknexa email notification sent!");
    })
    .catch((error) => {
      console.warn("EmailJS notification skipped/failed:", error);
    });
  }
}

function renderInventory(filter = 'all') {
  const grid = document.getElementById('inventory-grid');
  if (!grid) return;

  const sym = settings.currency || 'GH₵';
  const items = filter === 'low'
    ? inventory.filter(i => i.qty <= i.threshold)
    : inventory;

  const countLabel = document.getElementById('inv-count-label');
  if (countLabel) {
    countLabel.textContent = `${inventory.length} item${inventory.length !== 1 ? 's' : ''} tracked`;
  }

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
          <div class="inv-stat-value">${sym}${(item.cost).toFixed(2)}</div>
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
  if (amt === null) return;
  const n = parseFloat(amt);
  if (isNaN(n) || n <= 0) { toast('Invalid quantity', 'error'); return; }

  item.qty += n;
  saveData();
  renderInventory();
  refreshDashboard();
  renderAlerts();
  toast(`${item.name} restocked (+${n} units → ${item.qty} total)`, 'success');
}

function deleteInvItem(id) {
  if (!confirm('Remove this item from inventory?')) return;
  inventory = inventory.filter(i => i.id !== id);
  saveData();
  renderInventory();
  refreshDashboard();
  renderAlerts();
  toast('Item removed', 'warn');
}

function clearAllInventory() {
  if (!confirm('Delete ALL inventory? This cannot be undone.')) return;
  inventory = [];
  saveData();
  renderInventory();
  refreshDashboard();
  renderAlerts();
  toast('Inventory cleared', 'warn');
}

function clearInvForm() {
  ['i-name', 'i-qty', 'i-threshold', 'i-cost', 'i-expiry'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const catEl = document.getElementById('i-category');
  if (catEl) catEl.value = 'General';
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
  if (!container) return;

  const alerts = getAlerts();

  // Update badge
  const badge = document.getElementById('alert-badge');
  if (badge) {
    if (alerts.length > 0) {
      badge.style.display = 'inline';
      badge.textContent = alerts.length;
    } else {
      badge.style.display = 'none';
    }
  }

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
  renderAlerts();
  refreshDashboard();
}

function dismissAllAlerts() {
  const alerts = getAlerts();
  alerts.forEach(a => dismissedAlerts.push(a.id));
  localStorage.setItem('smartretail_dismissed', JSON.stringify(dismissedAlerts));
  renderAlerts();
  refreshDashboard();
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
  applySettings();
  refreshDashboard();
  renderLedger();
  renderInventory();
  if (!silent) toast('Settings saved!', 'success');
}

function resetAll() {
  if (!confirm('⚠️ FULL RESET: Delete ALL data including sales, inventory, and settings? This cannot be undone.')) return;
  localStorage.removeItem('smartretail_sales');
  localStorage.removeItem('smartretail_inventory');
  localStorage.removeItem('smartretail_settings');
  localStorage.removeItem('smartretail_dismissed');
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
  if (!container) return;

  const icons = { success: '✅', error: '❌', warn: '⚠️' };

  const el = document.createElement('div');
  el.className = `toast-item ${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${esc(msg)}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ═══════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════
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
document.addEventListener('DOMContentLoaded', init);
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  init();
}