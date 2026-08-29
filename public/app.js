const select = document.getElementById('merchant-select');
const exportBtn = document.getElementById('export-csv-btn');
const searchForm = document.getElementById('search-form');
const searchTbody = document.getElementById('search-tbody');
const searchSummary = document.getElementById('search-summary');
const searchPrevBtn = document.getElementById('search-prev');
const searchNextBtn = document.getElementById('search-next');
const searchPageLabel = document.getElementById('search-page-label');
const totalOrdersEl = document.getElementById('total-orders');
const uniqueCustomersEl = document.getElementById('unique-customers');
const avgOrderEl = document.getElementById('avg-order');
const revenue30dEl = document.getElementById('revenue-30d');

function api(path) {
  return fetch(path, { headers: { 'X-Merchant-Id': select.value } }).then((r) => r.json());
}

function money(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function refresh() {
  const summary = await api('/api/metrics/summary');
  totalOrdersEl.textContent = summary.total_orders ?? '—';
  uniqueCustomersEl.textContent = summary.unique_customers ?? '—';
  avgOrderEl.textContent = money(summary.avg_order_value_cents ?? 0);

  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const revenue = await api(`/api/revenue?from=${isoDate(thirtyAgo)}&to=${isoDate(now)}`);
  revenue30dEl.textContent = money(revenue.revenue_cents ?? 0);

  searchOffset = 0;
  await runSearch();
}

async function downloadCsv() {
  exportBtn.disabled = true;
  try {
    const res = await fetch('/api/orders/export', { headers: { 'X-Merchant-Id': select.value } });
    if (!res.ok) throw new Error(`export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${select.value}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert('Could not download CSV export.');
  } finally {
    exportBtn.disabled = false;
  }
}

const SEARCH_PAGE_SIZE = 20;
let searchOffset = 0;

async function runSearch() {
  const params = new URLSearchParams({ limit: String(SEARCH_PAGE_SIZE), offset: String(searchOffset) });
  const email = document.getElementById('search-email').value.trim();
  const type = document.getElementById('search-type').value;
  const status = document.getElementById('search-status').value.trim();
  const from = document.getElementById('search-from').value;
  const to = document.getElementById('search-to').value;

  if (email) params.set('email', email);
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  if (from && to) {
    params.set('from', from);
    params.set('to', to);
  }

  const result = await api(`/api/orders/search?${params.toString()}`);

  searchTbody.innerHTML = '';
  for (const o of result.orders ?? []) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(o.created_at).toLocaleDateString()}</td>
      <td>${o.customer_email}</td>
      <td>${o.type}</td>
      <td>${o.status}</td>
      <td>${money(o.total_amount)}</td>
    `;
    searchTbody.appendChild(tr);
  }

  const total = result.total ?? 0;
  const shown = result.orders?.length ?? 0;
  searchSummary.textContent = total === 0 ? 'No orders match.' : `${total} order(s) found.`;
  searchPageLabel.textContent = `${searchOffset + (shown ? 1 : 0)}–${searchOffset + shown} of ${total}`;
  searchPrevBtn.disabled = searchOffset === 0;
  searchNextBtn.disabled = searchOffset + SEARCH_PAGE_SIZE >= total;
}

select.addEventListener('change', refresh);
exportBtn.addEventListener('click', downloadCsv);
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  searchOffset = 0;
  runSearch();
});
searchPrevBtn.addEventListener('click', () => {
  searchOffset = Math.max(0, searchOffset - SEARCH_PAGE_SIZE);
  runSearch();
});
searchNextBtn.addEventListener('click', () => {
  searchOffset += SEARCH_PAGE_SIZE;
  runSearch();
});
refresh();
