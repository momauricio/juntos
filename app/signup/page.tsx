"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
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

    const supabase = createClient();
    const { error: signupError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (signupError) {
      setError("Nao foi possivel criar sua conta. Tente novamente.");
      setIsSubmitting(false);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-50 px-4 py-10 text-stone-950">
      <section className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <div className="space-y-3 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-500">
            Juntos
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Criar sua conta
          </h1>
          <p className="text-sm leading-6 text-stone-600">
            Comece uma lista de desejos simples para compartilhar a dois.
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-stone-800"
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
              className="h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
              placeholder="voce@email.com"
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-stone-800"
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
              className="h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
              placeholder="No minimo 6 caracteres"
            />
          </div>

          {error ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-2xl bg-rose-500 px-4 text-base font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-600">
          Ja tem conta?{" "}
          <Link className="font-semibold text-rose-600" href="/login">
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
