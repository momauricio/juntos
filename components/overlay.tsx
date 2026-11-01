"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Fundo escurecido das folhas e do menu (mockups 54–55c: .dim).
export const DIM = "fixed inset-0 z-40 m-0 bg-[rgba(10,14,26,0.62)]";

// Folha e menu vão direto no <body>: dentro da página, um pai com space-y-*
// dá margem aos filhos e encurtava o escurecido e a folha (faixa clara de
// 14px embaixo, no computador).
function OnBody({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

function focusables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => !element.closest("[inert]") && element.getClientRects().length > 0,
  );
}

/**
 * Folha/menu aberto: foco preso dentro, Esc fecha, a página não rola atrás e,
 * ao fechar, o foco volta para quem abriu (o quadrado, o "···"...).
 */
export function useModalFocus(
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  options: {
    initialFocus?: RefObject<HTMLElement | null>;
    // Quem recebe o foco ao fechar. Sem isso, quem tinha o foco ao abrir
    // (segurar ou botão direito não focam o quadrado: aí vale passar ele).
    returnFocus?: HTMLElement | null;
  } = {},
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const initialFocus = options.initialFocus;
  const returnFocus = options.returnFocus;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const trigger =
      returnFocus ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    const first = initialFocus?.current ?? focusables(container)[0] ?? container;
    first.focus({ preventScroll: true });

    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (!container) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables(container);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === firstItem || !container.contains(active))) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && (active === lastItem || !container.contains(active))) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      // Quem abriu pode ter saído da tela (ex.: categoria apagada).
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [containerRef, initialFocus, returnFocus]);
}

// Folha de baixo (mockups 54, 55b, 55c): fundo escurecido, alça, foco preso.
export function Sheet({
  title,
  onClose,
  initialFocus,
  returnFocus,
  children,
}: {
  // Renderiza o título com o id que a folha usa no aria-labelledby.
  title: (id: string) => ReactNode;
  onClose: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocus?: HTMLElement | null;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalFocus(ref, onClose, { initialFocus, returnFocus });

  return (
    <OnBody>
      <div aria-hidden="true" className={DIM} onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[calc(100dvh-24px)] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-[#f3ebe3] px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-2.5 text-ink shadow-[0_-14px_40px_rgba(0,0,0,0.4)] outline-none"
      >
        <div aria-hidden="true" className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-ink/20" />
        {title(titleId)}
        {children}
      </div>
    </OnBody>
  );
}

export type MenuEntry = {
  key: string;
  emoji: string;
  label: string;
  danger?: boolean;
  onSelect: () => void;
};

// Setas, Home e End andam entre os itens do menu.
function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ];
  const index = items.indexOf(document.activeElement as HTMLElement);
  let next = -1;
  if (event.key === "ArrowDown") next = (index + 1) % items.length;
  else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = items.length - 1;
  if (next === -1) return;
  event.preventDefault();
  items[next]?.focus();
}

const MENU_WIDTH = 236;
const MENU_GAP = 8;
const SCREEN_MARGIN = 20;

// Onde o menu cabe: embaixo do gatilho (como no mockup 55), alinhado pela
// borda mais próxima do meio da tela; sem espaço embaixo, em cima.
function menuPosition(anchor: DOMRect, height: number) {
  const width = Math.min(MENU_WIDTH, window.innerWidth - SCREEN_MARGIN * 2);
  const centerX = anchor.left + anchor.width / 2;
  let left =
    centerX > window.innerWidth / 2 ? anchor.right - width : anchor.left;
  left = Math.max(SCREEN_MARGIN, Math.min(left, window.innerWidth - SCREEN_MARGIN - width));
  const below = anchor.bottom + MENU_GAP;
  const fitsBelow = below + height <= window.innerHeight - 64;
  // Sempre dentro da tela, mesmo com o gatilho meio escondido.
  const top = Math.max(
    SCREEN_MARGIN,
    Math.min(
      fitsBelow ? below : anchor.top - MENU_GAP - height,
      window.innerHeight - SCREEN_MARGIN - height,
    ),
  );
  return { left, top, width };
}

// Menu 55: perto do quadrado (ou do "···"), sobre a tela escurecida, com o
// rodapé "Vale para vocês dois.".
export function AnchoredMenu({
  label,
  anchor,
  entries,
  footer,
  returnFocus,
  onClose,
}: {
  label: string;
  anchor: DOMRect;
  returnFocus?: HTMLElement | null;
  entries: MenuEntry[];
  footer?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, onClose, { returnFocus });
  // Altura conhecida (46px por item + 12 de respiro): sem medir depois do render.
  const position = menuPosition(anchor, entries.length * 46 + 12);

  return (
    <OnBody>
      <div aria-hidden="true" className={DIM} onClick={onClose} />
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        onKeyDown={onMenuKeyDown}
        style={position}
        className="fixed z-50 rounded-[20px] bg-cream p-1.5 text-ink shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      >
        {entries.map((entry, index) => (
          <button
            key={entry.key}
            type="button"
            role="menuitem"
            onClick={entry.onSelect}
            className={`flex h-[46px] w-full items-center gap-3 rounded-xl px-3 text-left text-base font-semibold outline-none transition hover:bg-ink/[0.05] focus-visible:bg-ink/[0.07] ${
              index > 0 ? "border-t border-ink/[0.07]" : ""
            } ${entry.danger ? "text-[#b83b4b]" : ""}`}
          >
            <span aria-hidden="true" className="w-[22px] text-center">
              {entry.emoji}
            </span>
            {entry.label}
          </button>
        ))}
      </div>
      {footer ? (
        <p className="pointer-events-none fixed inset-x-5 bottom-10 z-50 text-center text-[13.5px] text-cream/70">
          {footer}
        </p>
      ) : null}
    </OnBody>
  );
}
