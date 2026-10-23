import { headers } from "next/headers";

export async function getRequestOrigin() {
  const headersList = await headers();
  const host = headersList.get("host");

  if (!host) {
    return "";
  }

  const forwardedProto = headersList.get("x-forwarded-proto");
  const protocol =
    forwardedProto?.split(",")[0]?.trim() ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocol}://${host}`;
}
