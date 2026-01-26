
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Check connectivity to Keycloak via internal network
        const authUrl = process.env.AUTH_ISSUER_BASE?.replace('localhost', 'host.docker.internal') || 'http://host.docker.internal:18090';

        // Low timeout to fail fast
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(authUrl, {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-store'
        });

        clearTimeout(timeoutId);

        if (res.ok || res.status === 404) { // 404 is fine, it means service is listening
            return NextResponse.json({ status: 'ok' });
        }

        return NextResponse.json({ status: 'error', message: `Service returned ${res.status}` }, { status: 503 });
    } catch (error) {
        return NextResponse.json({ status: 'error', message: String(error) }, { status: 503 });
    }
}
