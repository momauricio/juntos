import { SignupForm } from "@/components/signup-form";

type SignupPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    code?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;

  return <SignupForm next={firstParam(params.next)} code={firstParam(params.code)} />;
}
