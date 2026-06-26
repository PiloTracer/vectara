import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"
import Keycloak from "next-auth/providers/keycloak"

declare module "next-auth" {
    interface Session {
        idToken?: string
        user: {
            roles: string[]
            accessToken?: string
        } & DefaultSession["user"]
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        roles: string[]
        accessToken?: string
        idToken?: string
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Keycloak({
            clientId: process.env.AUTH_CLIENT_ID,
            clientSecret: process.env.AUTH_CLIENT_SECRET,
            issuer: `${process.env.AUTH_ISSUER_BASE}/realms/${process.env.AUTH_REALM}`,
            wellKnown: `${process.env.AUTH_ISSUER_BASE?.replace('localhost', 'host.docker.internal')}/realms/${process.env.AUTH_REALM}/.well-known/openid-configuration`,
            token: `${process.env.AUTH_ISSUER_BASE?.replace('localhost', 'host.docker.internal')}/realms/${process.env.AUTH_REALM}/protocol/openid-connect/token`,
            userinfo: `${process.env.AUTH_ISSUER_BASE?.replace('localhost', 'host.docker.internal')}/realms/${process.env.AUTH_REALM}/protocol/openid-connect/userinfo`,
            authorization: {
                params: {
                    scope: "openid profile email"
                },
                url: `${process.env.AUTH_ISSUER_BASE?.replace('host.docker.internal', 'localhost')}/realms/${process.env.AUTH_REALM}/protocol/openid-connect/auth`
            }
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }): Promise<JWT> {
            if (account) {
                token.accessToken = account.access_token
                token.idToken = account.id_token
            }
            if (profile && "realm_access" in profile) {
                const keycloakProfile = profile as { realm_access?: { roles: string[] } }
                token.roles = keycloakProfile.realm_access?.roles || []
            }
            return token
        },
        async session({ session, token }): ReturnType<typeof auth> extends Promise<infer R> ? R : never {
            if (session.user) {
                session.user.roles = token.roles || []
                session.user.accessToken = token.accessToken
                session.idToken = token.idToken
            }
            return session
        },
    },
})
