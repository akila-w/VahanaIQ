// Undo toast: one polite live region, about 6 seconds, paused while hovered or focused
const DURATION = 6000;
let el = null, timer = null, onTimeout = null, generation = 0;

// The live region (#toast) is in the page from the start so screen readers announce its updates
function ensure() {
  if (el) return el;
  el = document.getElementById("toast");
  const pause = () => clearTimeout(timer);
  const resume = () => { if (el.classList.contains("show") && !el.contains(document.activeElement) && !el.matches(":hover")) start(); };
  el.addEventListener("mouseenter", pause);
  el.addEventListener("focusin", pause);
  el.addEventListener("mouseleave", resume);
  el.addEventListener("focusout", () => setTimeout(resume, 0));
  return el;
}

function start() {
  clearTimeout(timer);
  timer = setTimeout(() => hide(true), DURATION);
}

function hide(expired) {
  if (!el) return;
  clearTimeout(timer);
  const hadFocus = el.contains(document.activeElement);
  el.classList.remove("show");
  el.textContent = "";
  if (hadFocus && onTimeout) onTimeout(expired);
}

// Shows "message [actionLabel]". afterHide() runs if focus was in the toast when it closes.
export function showToast(message, actionLabel, onAction, afterHide) {
  const token = ++generation;
  const t = ensure();
  t.textContent = "";
  const span = document.createElement("span");
  span.textContent = message;
  t.appendChild(span);
  onTimeout = afterHide || null;
  let btn = null;
  if (actionLabel) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-outline btn-sm";
    btn.textContent = actionLabel;
    btn.addEventListener("click", () => { if (token !== generation) return; onTimeout = null; hide(false); onAction(); });
    t.appendChild(btn);
  }
  t.classList.add("show");
  start();
  return btn;
}

// Cancel retained actions before replacing an account-owned copy.
export function clearToast() { generation++; onTimeout = null; hide(false); }
