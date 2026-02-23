import { NextRequest, NextResponse } from 'next/server';
import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Singleton Prisma Client
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const token = process.env.TELEGRAM_BOT_TOKEN;

// Initialize bot for sending messages (stateless)
const bot = token ? new TelegramBot(token, { polling: false }) : null;

const CAR_TYPES = ['Sedan', 'SUV', 'LG SUV', 'F150', 'Van', 'Cargo Truck'];
const SERVICES = ['Inside Outside', 'Outside Only', 'Inside Only', 'Shampoo'];

const PRICES: Record<string, Record<string, number>> = {
    'Sedan': { 'Inside Outside': 28, 'Outside Only': 20, 'Inside Only': 15 },
    'SUV': { 'Inside Outside': 32, 'Outside Only': 25, 'Inside Only': 20 },
    'LG SUV': { 'Inside Outside': 38, 'Outside Only': 30, 'Inside Only': 25 },
    'F150': { 'Inside Outside': 42, 'Outside Only': 32, 'Inside Only': 28 },
    'Van': { 'Inside Outside': 35, 'Outside Only': 25, 'Inside Only': 22 },
    'Cargo Truck': { 'Inside Outside': 50, 'Outside Only': 35, 'Inside Only': 30 }
};

const ADDONS = ['Tire Shine', 'Armoall Inside', 'Wax', 'Trunk Vacuum', 'Extra Dirty', 'Done with Add-ons'];
const ADDON_PRICES: Record<string, Record<string, number>> = {
    'Sedan': { 'Tire Shine': 2, 'Armoall Inside': 2, 'Wax': 3, 'Trunk Vacuum': 3, 'Extra Dirty': 5 },
    'SUV': { 'Tire Shine': 3, 'Armoall Inside': 3, 'Wax': 4, 'Trunk Vacuum': 3, 'Extra Dirty': 7 },
    'LG SUV': { 'Tire Shine': 4, 'Armoall Inside': 4, 'Wax': 5, 'Trunk Vacuum': 5, 'Extra Dirty': 8 },
    'F150': { 'Tire Shine': 5, 'Armoall Inside': 5, 'Wax': 5, 'Trunk Vacuum': 7, 'Extra Dirty': 10 },
    'Van': { 'Tire Shine': 4, 'Armoall Inside': 4, 'Wax': 5, 'Trunk Vacuum': 5, 'Extra Dirty': 8 },
    'Cargo Truck': { 'Tire Shine': 5, 'Armoall Inside': 5, 'Wax': 10, 'Trunk Vacuum': 15, 'Extra Dirty': 10 }
};

// --- Helper Functions ---

async function getAuthorizedUser(telegramId: string, username?: string, firstName?: string) {
    let user = await prisma.user.findUnique({
        where: { telegramId }
    });

    // If no users exist, make the first one the owner
    const userCount = await prisma.user.count();
    if (userCount === 0) {
        user = await prisma.user.create({
            data: {
                telegramId,
                username: username || firstName || 'Owner',
                role: 'OWNER'
            }
        });
        console.log(`First user registered as OWNER: ${user.username} (${telegramId})`);
    }

    return user;
}

// Helper to get or create session
async function getSession(chatId: string) {
    return await prisma.botSession.upsert({
        where: { chatId },
        update: {},
        create: { chatId, step: 'start' }
    });
}

async function updateSession(chatId: string, data: any) {
    return await prisma.botSession.update({
        where: { chatId },
        data
    });
}

async function resetSession(chatId: string) {
    // Use upsert to handle both new and existing sessions
    return await prisma.botSession.upsert({
        where: { chatId },
        update: {
            step: 'start',
            carType: null,
            service: null,
            basePrice: null,
            addons: null,
            totalAddonPrice: 0
        },
        create: {
            chatId,
            step: 'start'
        }
    });
}

async function showCarTypeMenu(chatId: string) {
    if (!bot) return;
    const keyboard = CAR_TYPES.map(type => ([{ text: type, callback_data: `type:${type}` }]));

    await bot.sendMessage(chatId, "🚗 **Select Car Type:**", {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

async function showServiceMenu(chatId: string, type: string) {
    if (!bot) return;
    const keyboard = SERVICES.map(service => {
        const price = PRICES[type] && PRICES[type][service];
        const label = price ? `${service} ($${price})` : service;
        return [{ text: label, callback_data: `service:${service}` }];
    });

    await bot.sendMessage(chatId, `🚗 **Type:** ${type}\n🧼 **Select Service:**`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

function showAddonMenu(chatId: string, messageId: number | undefined, type: string) {
    const keyboard = ADDONS.map(addon => {
        const price = ADDON_PRICES[type] && ADDON_PRICES[type][addon];
        const label = price ? `${addon} (+$${price})` : addon;
        return [{ text: label, callback_data: `addon:${addon}` }];
    });
    return keyboard;
}

async function saveWash(chatId: string, user: any, session: any, price: number) {
    try {
        const addonsArray = session.addons ? JSON.parse(session.addons) : [];
        const addonText = addonsArray.length > 0 ? ` + ${addonsArray.join(' + ')}` : '';
        const addonPriceText = session.totalAddonPrice > 0 ? ` (+$${session.totalAddonPrice})` : '';

        const savedWash = await prisma.wash.create({
            data: {
                originalMessage: `Menu Selection: ${session.carType} - ${session.service}${addonText} - $${price}`,
                carType: session.carType,
                parsedCar: session.carType,
                parsedService: `${session.service}${addonText}`,
                parsedPrice: price,
                senderName: user.username || user.firstName || 'User',
                senderId: user.telegramId,
            },
        });

        if (bot) {
            await bot.sendMessage(chatId, `✅ **Saved Entry!**\n\n🚗 **Type:** ${savedWash.carType}\n🧼 **Service:** ${session.service}${addonText}${addonPriceText}\n💰 **Total Price:** $${savedWash.parsedPrice?.toFixed(2)}\n\n/start to log another one.`);
        }
        await resetSession(chatId);
    } catch (error) {
        console.error('Save Error:', error);
        if (bot) {
            await bot.sendMessage(chatId, "❌ Database error. Please try again.");
        }
        await resetSession(chatId);
    }
}

// --- Main Route Handler ---

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const testOwnerId = searchParams.get('test_owner_id');

    console.log(`GET /api/telegram called. test_owner_id: ${testOwnerId}`);

    if (testOwnerId) {
        if (!bot) {
            return NextResponse.json({ success: false, error: 'Bot not initialized' }, { status: 500 });
        }
        try {
            await bot.sendMessage(testOwnerId, "🔔 **System Update:** Bot communication verified from Vercel.");
            return NextResponse.json({
                success: true,
                message: `Test message sent to ${testOwnerId}`,
                bot_username: (await bot.getMe()).username
            });
        } catch (error: any) {
            console.error('Test send failed:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    return NextResponse.json({
        status: 'active',
        bot_configured: !!token,
        time: new Date().toISOString(),
        build_id: 'debug-check-3'
    });
}

export async function POST(req: Request) {
    console.log('--- TELEGRAM WEBHOOK START ---');
    try {
        if (!bot) {
            console.error('TELEGRAM_BOT_TOKEN is missing!');
            return NextResponse.json({ ok: true, error: 'Bot not configured' });
        }

        const body = await req.json();
        console.log('Update received:', JSON.stringify(body));

        if (body.message) {
            const msg = body.message;
            const chatId = msg.chat.id.toString();
            const text = msg.text;
            const telegramId = msg.from?.id ? msg.from.id.toString() : null;

            console.log(`Processing message: "${text}" from ${telegramId} in chat ${chatId}`);

            if (!text || !telegramId || msg.from.is_bot) {
                console.log('Skipping message: invalid text/id or bot sender');
                return NextResponse.json({ ok: true });
            }

            let user = await getAuthorizedUser(telegramId, msg.from.username, msg.from.first_name);

            // Fast-track invite links so new users can get authorized before being rejected
            if (text.startsWith('/start invite_')) {
                const parts = text.split(' ');
                const token = parts[1].replace('invite_', '');

                // Validate token
                const inviteToken = await prisma.inviteToken.findUnique({ where: { token } });
                if (!inviteToken || inviteToken.used) {
                    await bot.sendMessage(chatId, "❌ Invalid or expired invite link. Please ask the owner for a new one.");
                    return NextResponse.json({ ok: true });
                }

                // Register user - ensure we don't downgrade owners if they test their own invite links
                const targetRole = user?.role === 'OWNER' ? 'OWNER' : 'EMPLOYEE';
                user = await prisma.user.upsert({
                    where: { telegramId },
                    update: { role: targetRole },
                    create: { telegramId, role: 'EMPLOYEE', username: msg.from?.username || msg.from?.first_name || 'New Employee' }
                });

                // Mark token used
                await prisma.inviteToken.update({
                    where: { token },
                    data: { used: true }
                });

                await bot.sendMessage(chatId, "✅ **Access Granted!** You have been successfully added as an Employee.\n\nType /start to open the car wash menu.");
                return NextResponse.json({ ok: true });
            }

            console.log('Authorized User search result:', JSON.stringify(user));

            if (!user) {
                console.log(`User ${telegramId} is NOT authorized.`);
                await bot.sendMessage(chatId, "🚫 **Unauthorized.** Please ask the owner to add you as an employee.");
                return NextResponse.json({ ok: true });
            }

            // Command Handling
            if (text.startsWith('/addemployee') && user.role === 'OWNER') {
                const parts = text.split(' ');
                if (parts.length < 2) {
                    await bot.sendMessage(chatId, "📝 **Usage:** `/addemployee [telegram_id]`\nYou can get a user's ID using @userinfobot");
                    return NextResponse.json({ ok: true });
                }
                const empId = parts[1];
                try {
                    await prisma.user.upsert({
                        where: { telegramId: empId },
                        update: { role: 'EMPLOYEE' },
                        create: { telegramId: empId, role: 'EMPLOYEE', username: 'New Employee' }
                    });
                    await bot.sendMessage(chatId, `✅ User ${empId} has been added as an **EMPLOYEE**.`);
                } catch (error) {
                    await bot.sendMessage(chatId, "❌ Error adding employee.");
                }
                return NextResponse.json({ ok: true });
            }

            if (text.startsWith('/removeemployee') && user.role === 'OWNER') {
                const parts = text.split(' ');
                if (parts.length < 2) {
                    await bot.sendMessage(chatId, "📝 **Usage:** `/removeemployee [telegram_id]`");
                    return NextResponse.json({ ok: true });
                }
                const empId = parts[1];
                try {
                    await prisma.user.delete({ where: { telegramId: empId } });
                    await bot.sendMessage(chatId, `✅ User ${empId} has been removed.`);
                } catch (error) {
                    await bot.sendMessage(chatId, "❌ Error removing employee (user might not exist).");
                }
                return NextResponse.json({ ok: true });
            }

            if (text === '/listusers' && user.role === 'OWNER') {
                const users = await prisma.user.findMany();
                let list = "👥 **User List:**\n\n";
                users.forEach(u => {
                    list += `• ${u.username} (${u.telegramId}) - **${u.role}**\n`;
                });
                await bot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
                return NextResponse.json({ ok: true });
            }

            if (text === '/checkin') {
                // Determine if user has an active shift
                const activeShift = await prisma.timeEntry.findFirst({
                    where: { userId: user.id, checkOut: null },
                    orderBy: { checkIn: 'desc' }
                });

                if (activeShift) {
                    await bot.sendMessage(chatId, `⚠️ **You are already checked in!**\nStarted at: ${new Date(activeShift.checkIn).toLocaleTimeString()}`);
                    return NextResponse.json({ ok: true });
                }

                await prisma.timeEntry.create({
                    data: {
                        userId: user.id,
                        checkIn: new Date(),
                    }
                });

                await bot.sendMessage(chatId, `✅ **Checked In!**\nTime: ${new Date().toLocaleTimeString()}\n\nHave a great shift! Send \`/checkout\` when you're done.`);
                return NextResponse.json({ ok: true });
            }

            if (text === '/checkout') {
                const activeShift = await prisma.timeEntry.findFirst({
                    where: { userId: user.id, checkOut: null },
                    orderBy: { checkIn: 'desc' }
                });

                if (!activeShift) {
                    await bot.sendMessage(chatId, "⚠️ **You are not currently checked in.**\nUse `/checkin` to start a shift.");
                    return NextResponse.json({ ok: true });
                }

                await updateSession(chatId, { step: 'checkout_breaks' });
                await bot.sendMessage(chatId, `🕒 **Checking out...**\nStarted at: ${new Date(activeShift.checkIn).toLocaleTimeString()}\n\n*How many hours of break did you take?*\n(Type a number, e.g. \`0\`, \`0.5\`, \`1\`)`, { parse_mode: 'Markdown' });
                return NextResponse.json({ ok: true });
            }

            if (text === '/invite' && user.role === 'OWNER') {
                const crypto = require('crypto');
                const token = crypto.randomBytes(16).toString('hex');
                try {
                    await prisma.inviteToken.create({
                        data: {
                            token,
                            createdBy: user.telegramId
                        }
                    });
                    const botInfo = await bot.getMe();
                    const inviteLink = `https://t.me/${botInfo.username}?start=invite_${token}`;
                    await bot.sendMessage(chatId, `🔗 **Unique Invite Link Generated:**\n\n${inviteLink}\n\nSend this link to the person you want to invite. It can only be used once.`);
                } catch (error) {
                    console.error('Invite generation error:', error);
                    await bot.sendMessage(chatId, "❌ Error generating invite link.");
                }
                return NextResponse.json({ ok: true });
            }

            if (text.startsWith('/start')) {
                console.log(`Resetting session and showing menu for ${chatId}`);
                await resetSession(chatId);
                await showCarTypeMenu(chatId);
                return NextResponse.json({ ok: true });
            }

            if (text.toLowerCase() === 'cancel' || text.toLowerCase() === 'menu') {
                console.log(`Resetting session and showing menu for ${chatId}`);
                await resetSession(chatId);
                await showCarTypeMenu(chatId);
                return NextResponse.json({ ok: true });
            }

            // State Handling for Text Input
            const session = await getSession(chatId);
            console.log(`Current session step: ${session.step}`);

            if (session.step === 'checkout_breaks') {
                const breakHours = parseFloat(text.trim());
                if (isNaN(breakHours) || breakHours < 0) {
                    await bot.sendMessage(chatId, "⚠️ Please enter a valid number for break hours (e.g. 0, 1).");
                    return NextResponse.json({ ok: true });
                }

                // Temporary storage using Session basePrice for breaks (since basePrice is float)
                await updateSession(chatId, {
                    basePrice: breakHours,
                    step: 'checkout_tips'
                });

                await bot.sendMessage(chatId, `💰 **Tips**\n\n*How much did you make in tips today?*\n(Type a number, e.g. \`0\`, \`20\`)`, { parse_mode: 'Markdown' });
                return NextResponse.json({ ok: true });
            }

            if (session.step === 'checkout_tips') {
                const tips = parseFloat(text.replace('$', '').trim());
                if (isNaN(tips) || tips < 0) {
                    await bot.sendMessage(chatId, "⚠️ Please enter a valid number for tips.");
                    return NextResponse.json({ ok: true });
                }

                const activeShift = await prisma.timeEntry.findFirst({
                    where: { userId: user.id, checkOut: null },
                    orderBy: { checkIn: 'desc' }
                });

                if (activeShift) {
                    const checkOutTime = new Date();
                    const breakHours = session.basePrice || 0;

                    const diffMs = checkOutTime.getTime() - activeShift.checkIn.getTime();
                    const diffHours = diffMs / (1000 * 60 * 60);
                    const totalHours = Math.max(0, diffHours - breakHours);

                    await prisma.timeEntry.update({
                        where: { id: activeShift.id },
                        data: {
                            checkOut: checkOutTime,
                            breakHours,
                            tips,
                            totalHours
                        }
                    });

                    await bot.sendMessage(chatId, `✅ **Checked Out Successfully!**\n\n🕒 **Shift:** ${new Date(activeShift.checkIn).toLocaleTimeString()} - ${checkOutTime.toLocaleTimeString()}\n☕ **Breaks:** ${breakHours} hrs\n⏱️ **Total Hours:** ${totalHours.toFixed(2)} hrs\n💸 **Tips:** $${tips.toFixed(2)}\n\nGreat job today!`);
                }

                await resetSession(chatId);
                return NextResponse.json({ ok: true });
            }

            if (session.step === 'awaiting_price') {
                const price = parseFloat(text.replace('$', '').trim());
                if (isNaN(price)) {
                    await bot.sendMessage(chatId, "⚠️ Please enter a valid number for the price.");
                    return NextResponse.json({ ok: true });
                }

                // Update session and show add-ons
                await updateSession(chatId, {
                    basePrice: price,
                    addons: JSON.stringify([]),
                    totalAddonPrice: 0,
                    step: 'awaiting_addon'
                });

                const keyboard = showAddonMenu(chatId, undefined, session.carType!);
                await bot.sendMessage(chatId, `🚗 **Type:** ${session.carType}\n🧼 **Service:** ${session.service} ($${price})\n\n✨ **Select Add-ons (you can select multiple):**`, {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: keyboard }
                });
            } else if (session.step === 'start') {
                await showCarTypeMenu(chatId);
            }

        } else if (body.callback_query) {
            const query = body.callback_query;
            const chatId = query.message.chat.id.toString();
            const messageId = query.message.message_id;
            const data = query.data;
            const telegramId = query.from.id.toString();

            console.log(`Processing callback query: "${data}" from ${telegramId} in chat ${chatId}`);

            const user = await getAuthorizedUser(telegramId, query.from.username, query.from.first_name);
            if (!user) {
                console.log(`Unauthorized callback query from ${telegramId}`);
                await bot.answerCallbackQuery(query.id, { text: "🚫 Unauthorized.", show_alert: true });
                return NextResponse.json({ ok: true });
            }

            // Ensure session exists
            let session = await getSession(chatId);

            if (data.startsWith('type:')) {
                const type = data.split(':')[1];
                await updateSession(chatId, { carType: type, step: 'awaiting_service' });
                session = (await getSession(chatId))!; // Refresh

                const keyboard = SERVICES.map(service => {
                    const price = PRICES[type] && PRICES[type][service];
                    const label = price ? `${service} ($${price})` : service;
                    return [{ text: label, callback_data: `service:${service}` }];
                });

                await bot.editMessageText(`🚗 **Selected Type:** ${type}\n\n🧼 **Now select Service:**`, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: keyboard }
                });
            }
            else if (data.startsWith('service:')) {
                const service = data.split(':')[1];
                await updateSession(chatId, { service }); // Update service temporarily
                session = (await getSession(chatId))!;

                const price = PRICES[session.carType!] && PRICES[session.carType!][service];

                if (price) {
                    await updateSession(chatId, {
                        basePrice: price,
                        addons: JSON.stringify([]),
                        totalAddonPrice: 0,
                        step: 'awaiting_addon'
                    });
                    // Refresh session for passing to showAddonMenu if needed, but we have data
                    const keyboard = showAddonMenu(chatId, messageId, session.carType!);

                    await bot.editMessageText(`🚗 **Type:** ${session.carType}\n🧼 **Service:** ${service} ($${price})\n\n✨ **Select Add-ons (you can select multiple):**`, {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: keyboard }
                    });
                } else {
                    await updateSession(chatId, { step: 'awaiting_price' });
                    await bot.editMessageText(`🚗 **Type:** ${session.carType}\n🧼 **Service:** ${service}\n\n💰 **Please type the PRICE ($):**`, {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown'
                    });
                }
            }
            else if (data.startsWith('addon:')) {
                const addon = data.split(':')[1];

                // Helper to parse addons safely
                let currentAddons: string[] = [];
                try {
                    currentAddons = session.addons ? JSON.parse(session.addons) : [];
                } catch (e) { currentAddons = [] }

                if (addon === 'Done with Add-ons') {
                    const totalPrice = (session.basePrice || 0) + (session.totalAddonPrice || 0);
                    const addonsText = currentAddons.length > 0 ? ` + ${currentAddons.join(' + ')}` : '';
                    const addonsPriceText = (session.totalAddonPrice || 0) > 0 ? ` (+$${session.totalAddonPrice})` : '';

                    await bot.editMessageText(`🚗 **Type:** ${session.carType}\n🧼 **Service:** ${session.service}${addonsText}${addonsPriceText}\n💰 **Total:** $${totalPrice}\n\n✅ *Saving...*`, {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown'
                    });

                    await saveWash(chatId, user, session, totalPrice);
                } else {
                    if (currentAddons.includes(addon)) {
                        await bot.answerCallbackQuery(query.id, {
                            text: `❌ ${addon} already added!`,
                            show_alert: false
                        });
                        return NextResponse.json({ ok: true });
                    }

                    const addonPrice = ADDON_PRICES[session.carType!] && ADDON_PRICES[session.carType!][addon];
                    if (addonPrice) {
                        currentAddons.push(addon);
                        const newTotalAddonPrice = (session.totalAddonPrice || 0) + addonPrice;

                        await updateSession(chatId, {
                            addons: JSON.stringify(currentAddons),
                            totalAddonPrice: newTotalAddonPrice
                        });

                        // Refresh display
                        const currentTotal = (session.basePrice || 0) + newTotalAddonPrice;
                        const addonsText = currentAddons.length > 0 ? `\n📋 **Selected:** ${currentAddons.join(', ')}` : '';

                        const keyboard = showAddonMenu(chatId, messageId, session.carType!);
                        await bot.editMessageText(`🚗 **Type:** ${session.carType}\n🧼 **Service:** ${session.service} ($${session.basePrice})${addonsText}\n💰 **Current Total:** $${currentTotal}\n\n✨ **Add another or finish:**`, {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'Markdown',
                            reply_markup: { inline_keyboard: keyboard }
                        });
                    }
                }
            }

            await bot.answerCallbackQuery(query.id);
        }

        console.log('--- TELEGRAM WEBHOOK END ---');
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('CRITICAL ERROR IN WEBHOOK:', error);
        return NextResponse.json({ ok: true }); // Always return 200 to Telegram
    }
}
