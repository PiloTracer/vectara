
import { auth, signIn, signOut } from "../auth"
import Link from "next/link"

export default async function Home() {
  const session = await auth()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, #1a202c, #000000)',
      color: '#fff',
      fontFamily: 'sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Decor */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '20%',
        width: '400px',
        height: '400px',
        background: 'rgba(56, 189, 248, 0.2)',
        filter: 'blur(100px)',
        borderRadius: '50%',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '20%',
        width: '300px',
        height: '300px',
        background: 'rgba(168, 85, 247, 0.2)',
        filter: 'blur(100px)',
        borderRadius: '50%',
        zIndex: 0
      }} />

      <main style={{
        zIndex: 1,
        backdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '3rem',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        textAlign: 'center',
        maxWidth: '500px',
        width: '90%'
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: '800',
          marginBottom: '1rem',
          background: 'linear-gradient(to right, #38bdf8, #818cf8, #c084fc)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1.2
        }}>
          Tools IADATA
        </h1>

        <p style={{
          fontSize: '1.25rem',
          color: '#94a3b8',
          marginBottom: '3rem',
          fontWeight: '300'
        }}>
          AI Data Lake System
        </p>

        {!session ? (
          <form
            action={async () => {
              "use server"
              await signIn("keycloak", { redirectTo: "/dashboard" })
            }}
          >
            <button
              type="submit"
              style={{
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#fff',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
              }}
            >
              Sign In with SSO
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '1.5rem',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Welcome back</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0' }}>{session.user?.name}</h3>
              <p style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>{session.user?.email}</p>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {(session.user as any).roles?.map((role: string) => (
                  <span key={role} style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.75rem',
                    background: 'rgba(56, 189, 248, 0.2)',
                    color: '#7dd3fc',
                    borderRadius: '9999px',
                    border: '1px solid rgba(56, 189, 248, 0.3)'
                  }}>{role}</span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Link href="/dashboard" style={{
                padding: '0.75rem 1.5rem',
                background: '#fff',
                color: '#000',
                borderRadius: '10px',
                fontWeight: '600',
                transition: 'opacity 0.2s'
              }}>
                Go to Dashboard
              </Link>
              <form
                action={async () => {
                  "use server"
                  await signOut()
                }}
              >
                <button type="submit" style={{
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}>
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
