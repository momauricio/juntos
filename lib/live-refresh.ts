// Realtime do espaço (spec-layout-categorias.md §8, C9): qualquer mudança em
// itens ou categorias do espaço chega como Broadcast no canal privado
// "space:{id}" e vira um router.refresh() com debounce.

export function spaceTopic(spaceId: string): string {
  return `space:${spaceId}`;
}

export type DebouncedRefresh = {
  (): void;
  cancel(): void;
};

/**
 * Debounce trailing: uma rajada de eventos (reordenar 8 categorias uma a uma,
 * a troca de espaço movendo 300 itens) vira 1 refresh, `ms` depois do último.
 * O último evento sempre gera refresh, a não ser que haja cancel().
 */
export function createDebouncedRefresh(refresh: () => void, ms = 300): DebouncedRefresh {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (() => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      refresh();
    }, ms);
  }) as DebouncedRefresh;

  schedule.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return schedule;
}

// O mínimo do cliente do Supabase que o SpaceLive usa (facilita o teste).
type SubscribeStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

export type LiveChannel = {
  on(type: "broadcast", filter: { event: string }, callback: () => void): LiveChannel;
  subscribe(callback?: (status: `${SubscribeStatus}`, err?: Error) => void): LiveChannel;
};

export type LiveClient = {
  realtime: { setAuth(token?: string | null): Promise<void> };
  channel(name: string, opts: { config: { private: boolean } }): LiveChannel;
  removeChannel(channel: LiveChannel): Promise<unknown>;
};

type Listenable = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export type SpaceLiveOptions = {
  supabase: LiveClient;
  spaceId: string;
  onChange: () => void;
  /** window (focus) e document (visibilitychange). */
  target: { window: Listenable; document: Listenable & { visibilityState: string } };
  ms?: number;
};

/**
 * Assina o canal privado do espaço e chama `onChange` (com debounce) em
 * qualquer broadcast. Fallback se o Realtime cair: também chama ao voltar o
 * foco, quando a aba volta do segundo plano e quando o canal volta a ficar
 * SUBSCRIBED depois de erro/fechamento. Devolve o cleanup.
 */
export function subscribeSpaceLive({ supabase, spaceId, onChange, target, ms = 300 }: SpaceLiveOptions): () => void {
  const schedule = createDebouncedRefresh(onChange, ms);
  let channel: LiveChannel | null = null;
  let disposed = false;
  let lost = false;

  const onFocus = () => schedule();
  const onVisibility = () => {
    if (target.document.visibilityState === "visible") schedule();
  };
  target.window.addEventListener("focus", onFocus);
  target.document.addEventListener("visibilitychange", onVisibility);

  const start = async () => {
    // Canal privado: o Realtime precisa do JWT da sessão para checar a
    // política em realtime.messages. Sem sessão, o canal só falha e fica o
    // fallback de foco.
    try {
      await supabase.realtime.setAuth();
    } catch {
      // segue: o subscribe abaixo cai em CHANNEL_ERROR e o fallback cobre
    }
    if (disposed) return;

    channel = supabase
      .channel(spaceTopic(spaceId), { config: { private: true } })
      .on("broadcast", { event: "*" }, () => schedule())
      .subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          // reconectou: pode ter perdido mensagem enquanto estava fora
          if (lost) schedule();
          lost = false;
        } else {
          lost = true;
        }
      });
  };
  void start();

  return () => {
    disposed = true;
    schedule.cancel();
    target.window.removeEventListener("focus", onFocus);
    target.document.removeEventListener("visibilitychange", onVisibility);
    if (channel) void supabase.removeChannel(channel).catch(() => {});
  };
}
