import { auth } from "./auth"

export default auth((req: any) => {
    const isDashboard = req.nextUrl.pathname.startsWith('/dashboard')
    if (isDashboard && !req.auth) {
        return Response.redirect(new URL('/api/auth/signin', req.nextUrl))
    }
})

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
