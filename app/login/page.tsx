import { LoginForm } from "@/components/login-form";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    code?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return <LoginForm next={firstParam(params.next)} code={firstParam(params.code)} />;
}
