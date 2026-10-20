// Accessible modal handling: inert background, focus trap, scroll lock and focus return
const stack = [];
// iframe: Google's sign-in button is rendered in one
const FOCUSABLE = 'a[href], iframe, button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const background = () => [...document.body.children].filter(el => !el.classList.contains("modal-bg") && el.tagName !== "SCRIPT");

function focusables(modal) {
  return [...modal.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el.getClientRects().length);
}

export function openModal(modal, opener, initialFocus) {
  if (stack.some(m => m.modal === modal)) return;
  const top = stack[stack.length - 1];
  if (top) top.modal.inert = true;
  else background().forEach(el => { el.inert = true; });
  stack.push({ modal, opener: opener || document.activeElement });
  modal.inert = false;
  modal.classList.add("open");
  document.body.classList.add("modal-open");
  const target = initialFocus || focusables(modal)[0];
  if (target) requestAnimationFrame(() => target.focus());
}

export function closeModal(modal) {
  const i = modal ? stack.findIndex(m => m.modal === modal) : stack.length - 1;
  if (i < 0) return;
  const [{ modal: el, opener }] = stack.splice(i, 1);
  el.classList.remove("open");
  el.inert = true;
  const top = stack[stack.length - 1];
  if (top) top.modal.inert = false;
  else {
    background().forEach(b => { b.inert = false; });
    document.body.classList.remove("modal-open");
  }
  if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
}

export const isOpen = modal => stack.some(m => m.modal === modal);

document.addEventListener("keydown", e => {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === "Escape") {
    e.preventDefault();
    closeModal(top.modal);
    return;
  }
  if (e.key !== "Tab") return;
  const items = focusables(top.modal);
  if (!items.length) { e.preventDefault(); return; }
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || !top.modal.contains(document.activeElement))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (document.activeElement === last || !top.modal.contains(document.activeElement))) {
    e.preventDefault();
    first.focus();
  }
});

document.addEventListener("click", e => {
  const top = stack[stack.length - 1];
  if (top && e.target === top.modal) closeModal(top.modal);
});
