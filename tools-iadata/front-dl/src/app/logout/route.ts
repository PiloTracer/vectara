
import { auth, signOut } from "../../auth"
import { redirect } from "next/navigation"

export async function GET() {
    const session = await auth()
    const idToken = (session as any)?.idToken

    // 1. Clear Local Session
    await signOut({ redirect: false })

    // 2. Redirect to Keycloak Logout
    if (idToken && process.env.AUTH_ISSUER_BASE) {
        const issuer = `${process.env.AUTH_ISSUER_BASE}/realms/${process.env.AUTH_REALM}`
        // Use localhost for browser redirect
        const browserIssuer = issuer.replace("host.docker.internal", "localhost");

        const logoutUrl = `${browserIssuer}/protocol/openid-connect/logout?post_logout_redirect_uri=${encodeURIComponent("http://localhost:13000")}&id_token_hint=${idToken}`

        redirect(logoutUrl)
    } else {
        redirect("/")
    }
}
