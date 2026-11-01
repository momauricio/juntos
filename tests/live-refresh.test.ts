import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDebouncedRefresh, spaceTopic, subscribeSpaceLive, type LiveClient } from "@/lib/live-refresh";

describe("spaceTopic", () => {
  it("é space:{id}", () => {
    expect(spaceTopic("a5abfb34-2ab6-4502-b375-15bd6a6dabff")).toBe("space:a5abfb34-2ab6-4502-b375-15bd6a6dabff");
  });
});

describe("createDebouncedRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rajada vira 1 chamada, 300 ms depois do último evento", () => {
    const refresh = vi.fn();
    const schedule = createDebouncedRefresh(refresh);

    // reordenar 8 categorias uma a uma, com 100 ms entre elas
    for (let i = 0; i < 8; i++) {
      schedule();
      vi.advanceTimersByTime(100);
    }
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(199);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("300 eventos de uma vez (troca de espaço) viram 1 refresh", () => {
    const refresh = vi.fn();
    const schedule = createDebouncedRefresh(refresh);
    for (let i = 0; i < 300; i++) schedule();
    vi.runAllTimers();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("o último evento sempre gera refresh, mesmo depois de um refresh já feito", () => {
    const refresh = vi.fn();
    const schedule = createDebouncedRefresh(refresh, 50);
    schedule();
    vi.advanceTimersByTime(50);
    expect(refresh).toHaveBeenCalledTimes(1);
    schedule();
    vi.advanceTimersByTime(49);
    schedule();
    vi.advanceTimersByTime(50);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("cancel descarta o refresh pendente; depois volta a funcionar", () => {
    const refresh = vi.fn();
    const schedule = createDebouncedRefresh(refresh);
    schedule();
    schedule.cancel();
    vi.runAllTimers();
    expect(refresh).not.toHaveBeenCalled();
    schedule.cancel();
    schedule();
    vi.runAllTimers();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

// Cliente falso: guarda o canal, o callback de broadcast e o de status.
function fakeSupabase() {
  const state: {
    name?: string;
    opts?: unknown;
    filter?: unknown;
    onBroadcast?: () => void;
    onStatus?: (status: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR") => void;
  } = {};
  const channel = {
    on: vi.fn((_type: string, filter: unknown, callback: () => void) => {
      state.filter = filter;
      state.onBroadcast = callback;
      return channel;
    }),
    subscribe: vi.fn((callback: typeof state.onStatus) => {
      state.onStatus = callback;
      return channel;
    }),
  };
  const supabase = {
    realtime: { setAuth: vi.fn(async () => {}) },
    channel: vi.fn((name: string, opts: unknown) => {
      state.name = name;
      state.opts = opts;
      return channel;
    }),
    removeChannel: vi.fn(async () => "ok"),
  };
  return { supabase: supabase as LiveClient & typeof supabase, channel, state };
}

function fakeTarget() {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  return { window: win, document: doc };
}

describe("subscribeSpaceLive", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("autentica antes e assina space:{id} privado, ouvindo todo broadcast", async () => {
    const { supabase, state } = fakeSupabase();
    const order: string[] = [];
    supabase.realtime.setAuth.mockImplementation(async () => {
      order.push("setAuth");
    });
    supabase.channel.mockImplementationOnce((name: string, opts: unknown) => {
      order.push("channel");
      state.name = name;
      state.opts = opts;
      return fakeSupabase().channel;
    });
    subscribeSpaceLive({ supabase, spaceId: "s1", onChange: vi.fn(), target: fakeTarget() });
    await vi.waitFor(() => expect(order).toEqual(["setAuth", "channel"]));
    expect(state).toMatchObject({ name: "space:s1", opts: { config: { private: true } } });
  });

  it("broadcast em rajada vira 1 onChange depois de 300 ms", async () => {
    const { supabase, state } = fakeSupabase();
    const onChange = vi.fn();
    subscribeSpaceLive({ supabase, spaceId: "s1", onChange, target: fakeTarget() });
    await vi.waitFor(() => expect(state.onBroadcast).toBeDefined());
    expect(state.filter).toEqual({ event: "*" });

    state.onBroadcast!();
    state.onBroadcast!();
    state.onBroadcast!();
    vi.advanceTimersByTime(299);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("refresh ao voltar o foco e quando a aba volta a ficar visível (não quando some)", () => {
    const { supabase } = fakeSupabase();
    const target = fakeTarget();
    const onChange = vi.fn();
    subscribeSpaceLive({ supabase, spaceId: "s1", onChange, target });

    target.window.dispatchEvent(new Event("focus"));
    vi.runAllTimers();
    expect(onChange).toHaveBeenCalledTimes(1);

    target.document.visibilityState = "hidden";
    target.document.dispatchEvent(new Event("visibilitychange"));
    vi.runAllTimers();
    expect(onChange).toHaveBeenCalledTimes(1);

    target.document.visibilityState = "visible";
    target.document.dispatchEvent(new Event("visibilitychange"));
    vi.runAllTimers();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("refresh quando o canal volta a SUBSCRIBED depois de erro ou fechamento; não no primeiro", async () => {
    const { supabase, state } = fakeSupabase();
    const onChange = vi.fn();
    subscribeSpaceLive({ supabase, spaceId: "s1", onChange, target: fakeTarget() });
    await vi.waitFor(() => expect(state.onStatus).toBeDefined());

    state.onStatus!("SUBSCRIBED");
    vi.runAllTimers();
    expect(onChange).not.toHaveBeenCalled();

    for (const lost of ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"] as const) {
      state.onStatus!(lost);
      state.onStatus!("SUBSCRIBED");
      vi.runAllTimers();
    }
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("setAuth falhando não quebra: assina mesmo assim e o foco continua funcionando", async () => {
    const { supabase, state } = fakeSupabase();
    supabase.realtime.setAuth.mockRejectedValueOnce(new Error("sem sessão"));
    const target = fakeTarget();
    const onChange = vi.fn();
    subscribeSpaceLive({ supabase, spaceId: "s1", onChange, target });
    await vi.waitFor(() => expect(state.name).toBe("space:s1"));
    target.window.dispatchEvent(new Event("focus"));
    vi.runAllTimers();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("cleanup remove o canal, os listeners e cancela o refresh pendente", async () => {
    const { supabase, state, channel } = fakeSupabase();
    const target = fakeTarget();
    const onChange = vi.fn();
    const stop = subscribeSpaceLive({ supabase, spaceId: "s1", onChange, target });
    await vi.waitFor(() => expect(state.onBroadcast).toBeDefined());

    state.onBroadcast!();
    stop();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
    target.window.dispatchEvent(new Event("focus"));
    target.document.dispatchEvent(new Event("visibilitychange"));
    vi.runAllTimers();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("cleanup antes do setAuth terminar: nem chega a assinar", async () => {
    const { supabase } = fakeSupabase();
    let finish = () => {};
    supabase.realtime.setAuth.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
    const stop = subscribeSpaceLive({ supabase, spaceId: "s1", onChange: vi.fn(), target: fakeTarget() });
    stop();
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(supabase.channel).not.toHaveBeenCalled();
    expect(supabase.removeChannel).not.toHaveBeenCalled();
  });
});
