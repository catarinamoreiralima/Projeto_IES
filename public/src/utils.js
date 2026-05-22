// Utility helpers extracted for incremental migration.
export function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatCurrency(value = 0) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

export function parseCurrency(input) {
  if (input == null) return 0;
  const s = String(input).trim();
  if (s === "") return 0;
  // Remove currency symbols and spaces, convert comma decimal to dot
  const cleaned = s.replace(/[^0-9,.-]/g, "").replace(/\.(?=.*\.)/g, "").replace(/,/g, ".");
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

export function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatDate(dateish) {
  if (!dateish) return "";
  const d = new Date(dateish);
  if (Number.isNaN(d.getTime())) return String(dateish);
  return d.toLocaleDateString("pt-BR");
}
