// Pausa do Realtime com formulário aberto: enquanto alguém digita (criar ou
// editar item, nota, revisão do colar link...), um router.refresh() trocaria
// os valores do formulário pelos do servidor ou o remontaria. Então o
// SpaceLive não atualiza: marca que chegou mudança e, quando o último
// formulário fecha, faz UM refresh (se chegou algo).

export type LivePause = {
  /** Pausa até chamar o release devolvido (chamar de novo não faz nada). */
  hold(): () => void;
  /** Atualiza agora ou, se pausado, guarda para quando soltar a última pausa. */
  request(refresh: () => void): void;
  isPaused(): boolean;
};

export function createLivePause(): LivePause {
  let holds = 0;
  // o refresh mais recente pedido durante a pausa (null = nada chegou)
  let pending: (() => void) | null = null;

  return {
    hold() {
      holds += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        holds -= 1;
        if (holds === 0 && pending) {
          const refresh = pending;
          pending = null;
          refresh();
        }
      };
    },
    request(refresh) {
      if (holds > 0) {
        pending = refresh;
      } else {
        refresh();
      }
    },
    isPaused: () => holds > 0,
  };
}

// Uma por aba: o SpaceLive (layout) e os formulários (páginas) se encontram aqui.
export const livePause = createLivePause();

/**
 * Pausa enquanto `element` está aberto na tela: dentro de um <details>
 * (disclosure de editar/dar nota, que abre e fecha sem desmontar), só
 * enquanto o <details> está aberto; fora dele, enquanto estiver montado.
 * Devolve o cleanup (solta a pausa, se houver).
 */
export function holdWhileOpen(element: Element, pause: LivePause = livePause): () => void {
  const details = element.closest("details");
  if (!details) return pause.hold();

  let release: (() => void) | null = null;
  const sync = () => {
    if (details.open && !release) {
      release = pause.hold();
    } else if (!details.open && release) {
      release();
      release = null;
    }
  };
  sync();
  details.addEventListener("toggle", sync);
  return () => {
    details.removeEventListener("toggle", sync);
    release?.();
    release = null;
  };
}
