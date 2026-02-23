import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    let url = searchParams.get('url');
    const token = process.env.TELEGRAM_BOT_TOKEN;

    // Automatic detection if URL is missing
    if (!url) {
        const host = request.headers.get('host');
        if (host) {
            const protocol = host.includes('localhost') ? 'http' : 'https';
            url = `${protocol}://${host}`;
        }
    }

    if (!url) {
        return NextResponse.json({ error: 'Could not determine current URL. Please provide ?url= param.' }, { status: 400 });
    }

    if (!token) {
        return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not defined' }, { status: 500 });
    }

    const webhookEndpoint = `${url}/api/telegram`;
    const telegramUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${webhookEndpoint}`;

    try {
        const res = await fetch(telegramUrl);
        const data = await res.json();
        return NextResponse.json({
            success: data.ok,
            telegram_response: data,
            webhook_url: webhookEndpoint
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to set webhook', details: error }, { status: 500 });
    }
}
