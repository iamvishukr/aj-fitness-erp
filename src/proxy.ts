import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: no cookie → send to /login. Full verification happens on the server (lib/auth.ts).
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has("gym_session");
  const { pathname } = req.nextUrl;
  if (!hasSession && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|login).*)"],
};
