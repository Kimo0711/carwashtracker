import { NextResponse } from 'next/server';
import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not defined');
}

// Initialize bot for sending messages (stateless)
const bot = new TelegramBot(token, { polling: false });

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
    // We keep the record but reset fields
    return await prisma.botSession.update({
        where: { chatId },
        data: {
            step: 'start',
            carType: null,
            service: null,
            basePrice: null,
            addons: null,
            totalAddonPrice: 0
        }
    });
}

async function showCarTypeMenu(chatId: string) {
    const keyboard = CAR_TYPES.map(type => ([{ text: type, callback_data: `type:${type}` }]));

    await bot.sendMessage(chatId, "🚗 **Select Car Type:**", {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

async function showServiceMenu(chatId: string, type: string) {
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

        await bot.sendMessage(chatId, `✅ **Saved Entry!**\n\n🚗 **Type:** ${savedWash.carType}\n🧼 **Service:** ${session.service}${addonText}${addonPriceText}\n💰 **Total Price:** $${savedWash.parsedPrice?.toFixed(2)}\n\n/start to log another one.`);
        await resetSession(chatId);
    } catch (error) {
        console.error('Save Error:', error);
        await bot.sendMessage(chatId, "❌ Database error. Please try again.");
        await resetSession(chatId);
    }
}

// --- Main Route Handler ---

export async function POST(req: Request) {
    try {
        const body = await req.json();

        if (body.message) {
            const msg = body.message;
            const chatId = msg.chat.id.toString();
            const text = msg.text;
            const telegramId = msg.from.id.toString();

            if (!text || msg.from.is_bot) return NextResponse.json({ ok: true });

            const user = await getAuthorizedUser(telegramId, msg.from.username, msg.from.first_name);

            if (!user) {
                bot.sendMessage(chatId, "🚫 **Unauthorized.** Please ask the owner to add you as an employee.");
                return NextResponse.json({ ok: true });
            }

            // Command Handling
            if (text.startsWith('/addemployee') && user.role === 'OWNER') {
                const parts = text.split(' ');
                if (parts.length < 2) {
                    bot.sendMessage(chatId, "📝 **Usage:** `/addemployee [telegram_id]`\nYou can get a user's ID using @userinfobot");
                    return NextResponse.json({ ok: true });
                }
                const empId = parts[1];
                try {
                    await prisma.user.upsert({
                        where: { telegramId: empId },
                        update: { role: 'EMPLOYEE' },
                        create: { telegramId: empId, role: 'EMPLOYEE', username: 'New Employee' }
                    });
                    bot.sendMessage(chatId, `✅ User ${empId} has been added as an **EMPLOYEE**.`);
                } catch (error) {
                    bot.sendMessage(chatId, "❌ Error adding employee.");
                }
                return NextResponse.json({ ok: true });
            }

            if (text.startsWith('/removeemployee') && user.role === 'OWNER') {
                const parts = text.split(' ');
                if (parts.length < 2) {
                    bot.sendMessage(chatId, "📝 **Usage:** `/removeemployee [telegram_id]`");
                    return NextResponse.json({ ok: true });
                }
                const empId = parts[1];
                try {
                    await prisma.user.delete({ where: { telegramId: empId } });
                    bot.sendMessage(chatId, `✅ User ${empId} has been removed.`);
                } catch (error) {
                    bot.sendMessage(chatId, "❌ Error removing employee (user might not exist).");
                }
                return NextResponse.json({ ok: true });
            }

            if (text === '/listusers' && user.role === 'OWNER') {
                const users = await prisma.user.findMany();
                let list = "👥 **User List:**\n\n";
                users.forEach(u => {
                    list += `• ${u.username} (${u.telegramId}) - **${u.role}**\n`;
                });
                bot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
                return NextResponse.json({ ok: true });
            }

            if (text === '/start' || text.toLowerCase() === 'cancel' || text.toLowerCase() === 'menu') {
                console.log(`Command received: ${text} from ${chatId}`);
                await resetSession(chatId);
                await showCarTypeMenu(chatId);
                return NextResponse.json({ ok: true });
            }

            // State Handling for Text Input (Price)
            const session = await getSession(chatId);
            if (session.step === 'awaiting_price') {
                const price = parseFloat(text.replace('$', '').trim());
                if (isNaN(price)) {
                    bot.sendMessage(chatId, "⚠️ Please enter a valid number for the price.");
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
                bot.sendMessage(chatId, `🚗 **Type:** ${session.carType}\n🧼 **Service:** ${session.service} ($${price})\n\n✨ **Select Add-ons (you can select multiple):**`, {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: keyboard }
                });
            } else if (session.step === 'start') {
                showCarTypeMenu(chatId);
            }

        } else if (body.callback_query) {
            const query = body.callback_query;
            const chatId = query.message.chat.id.toString();
            const messageId = query.message.message_id;
            const data = query.data;
            const telegramId = query.from.id.toString();

            const user = await getAuthorizedUser(telegramId, query.from.username, query.from.first_name);
            if (!user) {
                bot.answerCallbackQuery(query.id, { text: "🚫 Unauthorized.", show_alert: true });
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

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Error in webhook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
