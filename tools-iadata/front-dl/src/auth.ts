import NextAuth from "next-auth"
import Keycloak from "next-auth/providers/keycloak"

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Keycloak({
            clientId: process.env.AUTH_CLIENT_ID,
            clientSecret: process.env.AUTH_CLIENT_SECRET,
            // Issuer: MUST match the exact 'iss' claim in the JWT (includes realm path)
            // Form: http://localhost:18090/realms/master
            issuer: `${process.env.AUTH_ISSUER_BASE}/realms/${process.env.AUTH_REALM}`,
            // WellKnown: Discovery endpoint for internal container networking (replaces localhost with bridge)
            wellKnown: `${process.env.AUTH_ISSUER_BASE?.replace('localhost', 'host.docker.internal')}/realms/${process.env.AUTH_REALM}/.well-known/openid-configuration`,
            // Hardcoded endpoints: Forces the container to use the Docker bridge even if discovery returns 'localhost'
            token: `${process.env.AUTH_ISSUER_BASE?.replace('localhost', 'host.docker.internal')}/realms/${process.env.AUTH_REALM}/protocol/openid-connect/token`,
            userinfo: `${process.env.AUTH_ISSUER_BASE?.replace('localhost', 'host.docker.internal')}/realms/${process.env.AUTH_REALM}/protocol/openid-connect/userinfo`,
            authorization: {
                params: {
                    scope: "openid profile email"
                },
                // Redirect URI for Browser (must use 'localhost')
                url: `${process.env.AUTH_ISSUER_BASE?.replace('host.docker.internal', 'localhost')}/realms/${process.env.AUTH_REALM}/protocol/openid-connect/auth`
            }
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }: any) {
            if (account && profile) {
                // Extract Roles from Keycloak Realm Access
                // Structure: profile.realm_access.roles
                const roles = profile.realm_access?.roles || []
                token.roles = roles
                token.accessToken = account.access_token
            }
            return token
        },
        async session({ session, token }: any) {
            if (session.user) {
                session.user.roles = token.roles || []
                session.user.accessToken = token.accessToken
            }
            return session
        },
    },
})
