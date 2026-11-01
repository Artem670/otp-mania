/**
 * Таблицы на узких экранах: каждой ячейке даём подпись из заголовка колонки,
 * а если таблица шире своего блока, переключаем её в режим карточек (класс .stacked).
 */
function label(table: HTMLTableElement) {
  const heads = [...table.querySelectorAll('thead th')].map((th) => (th.textContent || '').trim());
  if (!heads.length) return;
  table.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => { if (heads[i] && td.getAttribute('data-label') !== heads[i]) td.setAttribute('data-label', heads[i]); }));
}
function fit(table: HTMLTableElement) {
  const wrap = table.parentElement;
  if (!wrap) return;
  const narrow = window.innerWidth <= 640;
  if (!narrow) { table.classList.remove('stacked'); return; }
  if (table.classList.contains('stacked')) return;
  if (table.scrollWidth > wrap.clientWidth + 2) table.classList.add('stacked');
}
let pending = false;
function scan() {
  pending = false;
  document.querySelectorAll<HTMLTableElement>('table.table').forEach((t) => { label(t); fit(t); });
}
const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(scan); } };
export function initResponsiveTables() {
  try {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', () => { document.querySelectorAll('table.table.stacked').forEach((t) => t.classList.remove('stacked')); schedule(); });
    schedule();
  } catch { /* старый браузер: таблицы просто прокручиваются */ }
}
