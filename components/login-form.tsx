"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { authRedirectPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";

type LoginFormProps = {
  next?: string;
  code?: string;
};

function authLink(pathname: "/login" | "/signup", next?: string, code?: string) {
  const params = new URLSearchParams();

  if (next) {
    params.set("next", next);
  }

  if (code) {
    params.set("code", code);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function LoginForm({ next, code }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setError("Informe seu e-mail e senha para entrar.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError) {
      setError("Não foi possível entrar. Confira seu e-mail e senha.");
      setIsSubmitting(false);
      return;
    }

    router.push(authRedirectPath({ next, code, fallback: "/" }));
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10 text-foreground">
      <section className="w-full max-w-sm rounded-3xl bg-surface p-6 ring-1 ring-border">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Juntos
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">
            Entrar na sua lista
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            Acesse a lista de desejos que você compartilha com seu amor.
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-foreground/85"
              htmlFor="email"
            >
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
              placeholder="voce@email.com"
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-foreground/85"
              htmlFor="password"
            >
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
              placeholder="Sua senha"
            />
          </div>

          {error ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-2xl bg-accent-strong px-4 text-base font-semibold text-accent-contrast transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-foreground/70">
          Ainda não tem conta?{" "}
          <Link
            className="font-semibold text-accent-strong"
            href={authLink("/signup", next, code)}
          >
            Criar conta
          </Link>
        </p>
      </section>
    </main>
  );
}
