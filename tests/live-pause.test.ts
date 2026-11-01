// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { createLivePause, holdWhileOpen } from "@/lib/live-pause";

describe("createLivePause", () => {
  it("sem pausa, atualiza na hora", () => {
    const pause = createLivePause();
    const refresh = vi.fn();
    pause.request(refresh);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(pause.isPaused()).toBe(false);
  });

  it("pausado não chama refresh; ao soltar com pendente → 1 refresh", () => {
    const pause = createLivePause();
    const refresh = vi.fn();
    const release = pause.hold();
    pause.request(refresh);
    pause.request(refresh);
    pause.request(refresh);
    expect(refresh).not.toHaveBeenCalled();
    expect(pause.isPaused()).toBe(true);

    release();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(pause.isPaused()).toBe(false);
  });

  it("ao soltar sem nada pendente → nenhum refresh", () => {
    const pause = createLivePause();
    const refresh = vi.fn();
    pause.hold()();
    expect(refresh).not.toHaveBeenCalled();
    // e o que vier depois já atualiza na hora
    pause.request(refresh);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("duas pausas aninhadas: só a última a soltar aplica o refresh", () => {
    const pause = createLivePause();
    const refresh = vi.fn();
    const item = pause.hold();
    const nota = pause.hold();
    pause.request(refresh);

    item();
    expect(refresh).not.toHaveBeenCalled();
    expect(pause.isPaused()).toBe(true);
    nota();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("soltar duas vezes a mesma pausa não solta a do outro formulário", () => {
    const pause = createLivePause();
    const refresh = vi.fn();
    const a = pause.hold();
    pause.hold();
    pause.request(refresh);
    a();
    a();
    expect(pause.isPaused()).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("usa o refresh mais recente pedido durante a pausa", () => {
    const pause = createLivePause();
    const first = vi.fn();
    const last = vi.fn();
    const release = pause.hold();
    pause.request(first);
    pause.request(last);
    release();
    expect(first).not.toHaveBeenCalled();
    expect(last).toHaveBeenCalledTimes(1);
  });
});

describe("holdWhileOpen", () => {
  it("fora de <details>: pausa enquanto montado", () => {
    const pause = createLivePause();
    const form = document.createElement("form");
    const cleanup = holdWhileOpen(form, pause);
    expect(pause.isPaused()).toBe(true);
    cleanup();
    expect(pause.isPaused()).toBe(false);
  });

  it("dentro de <details>: pausa só enquanto aberto; fechar com pendente → 1 refresh", async () => {
    const pause = createLivePause();
    const refresh = vi.fn();
    const details = document.createElement("details");
    const form = document.createElement("form");
    details.append(form);
    document.body.append(details);

    const cleanup = holdWhileOpen(form, pause);
    expect(pause.isPaused()).toBe(false);

    details.open = true;
    await vi.waitFor(() => expect(pause.isPaused()).toBe(true));
    pause.request(refresh);
    expect(refresh).not.toHaveBeenCalled();

    details.open = false;
    await vi.waitFor(() => expect(pause.isPaused()).toBe(false));
    expect(refresh).toHaveBeenCalledTimes(1);

    // fechado: atualiza na hora
    pause.request(refresh);
    expect(refresh).toHaveBeenCalledTimes(2);
    cleanup();
    details.remove();
  });

  it("desmontar com o <details> aberto solta a pausa", async () => {
    const pause = createLivePause();
    const details = document.createElement("details");
    details.open = true;
    const form = document.createElement("form");
    details.append(form);
    const cleanup = holdWhileOpen(form, pause);
    expect(pause.isPaused()).toBe(true);
    cleanup();
    expect(pause.isPaused()).toBe(false);
    // toggle depois do cleanup não pausa de novo
    details.open = false;
    details.open = true;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(pause.isPaused()).toBe(false);
  });
});
