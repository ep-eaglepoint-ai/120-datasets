import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useFocusTrap(active: Ref<boolean>) {
  const containerRef = ref<HTMLElement | null>(null);
  let previousActive: Element | null = null;

  function focusFirst() {
    const el = containerRef.value;
    if (!el) return;

    const focusables = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    const target = focusables[0] ?? el;
    target.focus?.();
  }

  function onKeydown(e: KeyboardEvent) {
    if (!active.value) return;
    if (e.key !== "Tab") return;

    const el = containerRef.value;
    if (!el) return;

    const focusables = Array.from(
      el.querySelectorAll<HTMLElement>(FOCUSABLE)
    ).filter((n) => !n.hasAttribute("disabled") && n.tabIndex !== -1);

    if (focusables.length === 0) {
      e.preventDefault();
      el.focus?.();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const current = document.activeElement;

    if (e.shiftKey) {
      if (current === first || current === el) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (current === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  onMounted(() => {
    window.addEventListener("keydown", onKeydown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", onKeydown);
  });

  function activate() {
    previousActive = document.activeElement;
    queueMicrotask(() => focusFirst());
  }

  function deactivate() {
    const prev = previousActive as HTMLElement | null;
    prev?.focus?.();
    previousActive = null;
  }

  return {
    containerRef,
    activate,
    deactivate,
  };
}
