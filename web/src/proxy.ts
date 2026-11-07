import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const ACCESS = "fmd_access";
const REFRESH = "fmd_refresh";

/**
 * Silent sign-in renewal. FastAPI's access cookie lives 15 minutes; once it has gone but the refresh cookie remains,
 * renew both before the request is handled (ported from main-websie's client/shared/src/auth-proxy.ts).
 * - /api/v1/* is rewritten to FastAPI, and a rewrite drops the proxy's Set-Cookie, so the browser gets a 307 to the
 *   same URL with the new cookies and repeats the call.
 * - Pages and this app's own /api routes see the new cookies on the request itself; the browser gets them on the
 *   response.
 */
export async function proxy(request: NextRequest) {
  if (request.cookies.has(ACCESS) || !request.cookies.has(REFRESH)) return NextResponse.next();

  let setCookies: string[];
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        cookie: `${REFRESH}=${request.cookies.get(REFRESH)?.value}`,
        origin: request.nextUrl.origin, // FastAPI's origin check
        "user-agent": request.headers.get("user-agent") ?? "",
      },
      cache: "no-store",
    });
    setCookies = res.headers.getSetCookie();
  } catch {
    return NextResponse.next(); // API unreachable: carry on signed out rather than fail the page
  }

  if (request.nextUrl.pathname.startsWith("/api/v1/")) {
    const retry = NextResponse.redirect(request.nextUrl, 307);
    for (const header of setCookies) retry.headers.append("set-cookie", header);
    return retry;
  }

  for (const header of setCookies) {
    const [pair, ...attrs] = header.split(";");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim().replace(/^"|"$/g, "");
    if (!value || attrs.some((a) => /^\s*max-age=0\s*$/i.test(a))) request.cookies.delete(name);
    else request.cookies.set(name, value);
  }
  const response = NextResponse.next({ request: { headers: request.headers } });
  for (const header of setCookies) response.headers.append("set-cookie", header);
  return response;
}

export const config = {
  // everything but build output and static files (images, models, loops, icons)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|ico|glb|mp4|txt|xml)$).*)"],
};
