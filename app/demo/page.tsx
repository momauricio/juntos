import { DemoApp } from "@/components/demo-app";

type DemoPageProps = {
  searchParams: Promise<{
    sync?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DemoPage({ searchParams }: DemoPageProps) {
  const params = await searchParams;

  return <DemoApp initialSync={firstParam(params.sync)} />;
}
