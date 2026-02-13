import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!url) {
        return NextResponse.json({ error: 'Missing "url" query parameter. Example: ?url=https://your-domain.vercel.app' }, { status: 400 });
    }

    if (!token) {
        return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not defined in environment variables' }, { status: 500 });
    }

    // specific endpoint for the bot logic
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
