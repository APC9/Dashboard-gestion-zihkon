import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Primera barrera: sin sesión válida no se sirve ninguna página ni API del panel.
 * NO es la única: cada Route Handler y página vuelve a verificar la sesión y
 * los permisos en servidor (requireAdmin / assertClientAccess).
 */
export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (!token) {
    if (isApi) return NextResponse.json({ error: "No autenticado", code: "UNAUTHORIZED" }, { status: 401 });
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // FASE 1: solo ADMIN. Cuando exista el portal de cliente, los CLIENT se
  // redirigirán a /portal y las rutas /api/* aplicarán su ámbito.
  if (token.role !== "ADMIN") {
    if (isApi) return NextResponse.json({ error: "Acceso denegado", code: "FORBIDDEN" }, { status: 403 });
    return NextResponse.redirect(new URL("/login?error=forbidden", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Todo excepto login, auth de NextAuth, healthcheck, webhook de Stripe (va firmado),
    // páginas de vuelta del pago y estáticos.
    "/((?!login|api/auth|api/health|api/webhooks/stripe|pago/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
