// URL and image URL sanitization helpers.

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const safeUrl = value => {
  try {
    const raw = String(value ?? "").trim();
    if (!raw) return "#";
    const u = new URL(raw);
    return (u.protocol === "https:" || u.protocol === "http:") ? esc(u.href) : "#";
  } catch {
    return "#";
  }
};

export const safeImageUrl = value => {
  const raw = String(value ?? "").trim();
  if (!raw || /^(javascript:|vbscript:|data:text\/html)/i.test(raw)) return "";
  return esc(raw);
};
