"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { authRedirectPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";

type SignupFormProps = {
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

export function SignupForm({ next, code }: SignupFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Informe um e-mail para criar sua conta.");
      return;
    }

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const destination = authRedirectPath({ next, code, fallback: "/onboarding" });
    const supabase = createClient();
    const { error: signupError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?${new URLSearchParams(
          { next: destination },
        ).toString()}`,
      },
    });

    if (signupError) {
      setError("Não foi possível criar sua conta. Tente novamente.");
      setIsSubmitting(false);
      return;
    }

    router.push(destination);
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
            Criar sua conta
          </h1>
          <p className="text-base leading-7 text-foreground/70">
            Comece uma lista de desejos simples para compartilhar a dois.
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
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
              placeholder="No mínimo 6 caracteres"
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
            {isSubmitting ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-foreground/70">
          Já tem conta?{" "}
          <Link
            className="font-semibold text-accent-strong"
            href={authLink("/login", next, code)}
          >
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
