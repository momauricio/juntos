// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Componente de verdade (SpaceLive + useLivePause), com o Supabase e o
// router falsos. Sem Testing Library: react-dom/client + act.

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

type Status = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";
const live: {
  name?: string;
  opts?: unknown;
  onBroadcast?: () => void;
  onStatus?: (status: Status) => void;
} = {};
const channel = {
  on: vi.fn((_type: string, _filter: unknown, callback: () => void) => {
    live.onBroadcast = callback;
    return channel;
  }),
  subscribe: vi.fn((callback: (status: Status) => void) => {
    live.onStatus = callback;
    return channel;
  }),
};
const supabase = {
  realtime: { setAuth: vi.fn(async () => {}) },
  channel: vi.fn((name: string, opts: unknown) => {
    live.name = name;
    live.opts = opts;
    return channel;
  }),
  removeChannel: vi.fn(async () => "ok"),
};
const createClient = vi.fn(() => supabase);
vi.mock("@/lib/supabase/client", () => ({ createClient: () => createClient() }));

const { SpaceLive } = await import("@/components/space-live");
const { useLivePause } = await import("@/components/use-live-pause");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SPACE = "a5abfb34-2ab6-4502-b375-15bd6a6dabff";
let container: HTMLDivElement;
let root: Root;

function Form({ inDetails = false }: { inDetails?: boolean }) {
  const ref = useLivePause<HTMLFormElement>();
  const form = createElement("form", { ref });
  return inDetails ? createElement("details", { id: "disclosure" }, form) : form;
}

async function render(...children: ReturnType<typeof createElement>[]) {
  await act(async () => root.render(createElement("div", null, ...children)));
}

async function broadcast(times = 1) {
  await vi.waitFor(() => expect(live.onBroadcast).toBeDefined());
  for (let i = 0; i < times; i++) live.onBroadcast!();
}

describe("SpaceLive", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.clearAllMocks();
    for (const key of Object.keys(live)) delete live[key as keyof typeof live];
  });

  it("não renderiza nada, assina space:{id} privado e faz 1 refresh 300 ms depois da rajada", async () => {
    await render(createElement(SpaceLive, { spaceId: SPACE }));
    expect(container.innerHTML).toBe("<div></div>");
    await broadcast(8); // reordenar 8 categorias, uma mensagem por update
    expect(live).toMatchObject({ name: `space:${SPACE}`, opts: { config: { private: true } } });
    expect(supabase.realtime.setAuth).toHaveBeenCalled();

    vi.advanceTimersByTime(299);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refresh ao voltar o foco e quando a aba volta a ficar visível", async () => {
    await render(createElement(SpaceLive, { spaceId: SPACE }));
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(300);
    expect(refresh).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(300);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("formulário aberto: não atualiza; ao desmontar aplica 1 refresh", async () => {
    await render(createElement(SpaceLive, { spaceId: SPACE }), createElement(Form, { key: "f" }));
    await broadcast(3);
    vi.advanceTimersByTime(300);
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(300);
    expect(refresh).not.toHaveBeenCalled();

    await render(createElement(SpaceLive, { spaceId: SPACE }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("formulário que fecha sem nada pendente: nenhum refresh", async () => {
    await render(createElement(SpaceLive, { spaceId: SPACE }), createElement(Form, { key: "f" }));
    await render(createElement(SpaceLive, { spaceId: SPACE }));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("disclosure (nota/editar): pausa só enquanto aberta", async () => {
    await render(createElement(SpaceLive, { spaceId: SPACE }), createElement(Form, { key: "f", inDetails: true }));
    const details = container.querySelector("details")!;

    // fechada: atualiza normalmente
    await broadcast();
    vi.advanceTimersByTime(300);
    expect(refresh).toHaveBeenCalledTimes(1);

    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    await broadcast(2);
    vi.advanceTimersByTime(300);
    expect(refresh).toHaveBeenCalledTimes(1);

    details.open = false;
    details.dispatchEvent(new Event("toggle"));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("dois formulários abertos: só atualiza quando o último fecha", async () => {
    await render(
      createElement(SpaceLive, { spaceId: SPACE }),
      createElement(Form, { key: "a" }),
      createElement(Form, { key: "b" }),
    );
    await broadcast();
    vi.advanceTimersByTime(300);
    await render(createElement(SpaceLive, { spaceId: SPACE }), createElement(Form, { key: "b" }));
    expect(refresh).not.toHaveBeenCalled();
    await render(createElement(SpaceLive, { spaceId: SPACE }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("cleanup remove o canal e para de ouvir o foco", async () => {
    await render(createElement(SpaceLive, { spaceId: SPACE }));
    await vi.waitFor(() => expect(live.onStatus).toBeDefined());
    await act(async () => root.render(createElement("div")));
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(300);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sem Supabase configurado (demo): não cria cliente nem canal", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    await render(createElement(SpaceLive, { spaceId: SPACE }));
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(300);
    expect(createClient).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
