const TelegramBot = require('node-telegram-bot-api');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const prisma = new PrismaClient();

// Simple in-memory state management
const userState = {};

console.log('Bot is running (Menu-based)...');

const CAR_TYPES = ['Sedan', 'SUV', 'LG SUV', 'F150', 'Van', 'Cargo Truck'];
const SERVICES = ['Inside Outside', 'Outside Only', 'Inside Only', 'Shampoo'];

// Middleware to check if user is authorized
async function getAuthorizedUser(msg) {
    const telegramId = msg.from.id.toString();
    let user = await prisma.user.findUnique({
        where: { telegramId }
    });

    // If no users exist at all, make the first one the owner
    const userCount = await prisma.user.count();
    if (userCount === 0) {
        user = await prisma.user.create({
            data: {
                telegramId,
                username: msg.from.username || msg.from.first_name,
                role: 'OWNER'
            }
        });
        console.log(`First user registered as OWNER: ${user.username} (${telegramId})`);
    }

    return user;
}

// Comprehensive pricing structure based on pricing sheets
// Note: Shampoo pricing is on-demand and not predefined
const PRICES = {
    'Sedan': {
        'Inside Outside': 28,
        'Outside Only': 20,
        'Inside Only': 15
    },
    'SUV': {
        'Inside Outside': 32,
        'Outside Only': 25,
        'Inside Only': 20
    },
    'LG SUV': {
        'Inside Outside': 38,
        'Outside Only': 30,
        'Inside Only': 25
    },
    'F150': {
        'Inside Outside': 42,
        'Outside Only': 32,
        'Inside Only': 28
    },
    'Van': {
        'Inside Outside': 35,
        'Outside Only': 25,
        'Inside Only': 22
    },
    'Cargo Truck': {
        'Inside Outside': 50,
        'Outside Only': 35,
        'Inside Only': 30
    }
};

// Add-on services pricing - Sequential selection supported
const ADDONS = ['Tire Shine', 'Armoall Inside', 'Wax', 'Trunk Vacuum', 'Extra Dirty', 'Done with Add-ons'];
const ADDON_PRICES = {
    'Sedan': {
        'Tire Shine': 2,
        'Armoall Inside': 2,
        'Wax': 3,
        'Trunk Vacuum': 3,
        'Extra Dirty': 5
    },
    'SUV': {
        'Tire Shine': 3,
        'Armoall Inside': 3,
        'Wax': 4,
        'Trunk Vacuum': 3,
        'Extra Dirty': 7
    },
    'LG SUV': {
        'Tire Shine': 4,
        'Armoall Inside': 4,
        'Wax': 5,
        'Trunk Vacuum': 5,
        'Extra Dirty': 8
    },
    'F150': {
        'Tire Shine': 5,
        'Armoall Inside': 5,
        'Wax': 5,
        'Trunk Vacuum': 7,
        'Extra Dirty': 10
    },
    'Van': {
        'Tire Shine': 4,
        'Armoall Inside': 4,
        'Wax': 5,
        'Trunk Vacuum': 5,
        'Extra Dirty': 8
    },
    'Cargo Truck': {
        'Tire Shine': 5,
        'Armoall Inside': 5,
        'Wax': 10,
        'Trunk Vacuum': 15,
        'Extra Dirty': 10
    }
};

function resetState(chatId) {
    delete userState[chatId];
}

function showCarTypeMenu(chatId) {
    const keyboard = CAR_TYPES.map(type => ([{ text: type, callback_data: `type:${type}` }]));

    bot.sendMessage(chatId, "🚗 **Select Car Type:**", {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

function showServiceMenu(chatId, type) {
    const keyboard = SERVICES.map(service => {
        const price = PRICES[type] && PRICES[type][service];
        const label = price ? `${service} ($${price})` : service;
        return [{ text: label, callback_data: `service:${service}` }];
    });

    bot.sendMessage(chatId, `🚗 **Type:** ${type}\n🧼 **Select Service:**`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

function showAddonMenu(chatId, messageId, type) {
    const keyboard = ADDONS.map(addon => {
        const price = ADDON_PRICES[type] && ADDON_PRICES[type][addon];
        const label = price ? `${addon} (+$${price})` : addon;
        return [{ text: label, callback_data: `addon:${addon}` }];
    });

    return keyboard;
}

async function saveWash(chatId, msg, state, price) {
    try {
        const addonsArray = state.addons || [];
        const addonText = addonsArray.length > 0 ? ` + ${addonsArray.join(' + ')}` : '';
        const addonPriceText = state.totalAddonPrice > 0 ? ` (+$${state.totalAddonPrice})` : '';

        const savedWash = await prisma.wash.create({
            data: {
                originalMessage: `Menu Selection: ${state.carType} - ${state.service}${addonText} - $${price}`,
                carType: state.carType,
                parsedCar: state.carType,
                parsedService: `${state.service}${addonText}`,
                parsedPrice: price,
                senderName: msg.from.first_name || 'User',
                senderId: msg.from.id.toString(),
            },
        });

        bot.sendMessage(chatId, `✅ **Saved Entry!**\n\n🚗 **Type:** ${savedWash.carType}\n🧼 **Service:** ${state.service}${addonText}${addonPriceText}\n💰 **Total Price:** $${savedWash.parsedPrice.toFixed(2)}\n\n/start to log another one.`);
        resetState(chatId);
    } catch (error) {
        console.error('Save Error:', error);
        bot.sendMessage(chatId, "❌ Database error. Please try again.");
        resetState(chatId);
    }
}

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || msg.from.is_bot) return;

    const user = await getAuthorizedUser(msg);
    if (!user) {
        bot.sendMessage(chatId, "🚫 **Unauthorized.** Please ask the owner to add you as an employee.");
        return;
    }

    if (text.startsWith('/addemployee') && user.role === 'OWNER') {
        const parts = text.split(' ');
        if (parts.length < 2) {
            bot.sendMessage(chatId, "📝 **Usage:** `/addemployee [telegram_id]`\nYou can get a user's ID using @userinfobot");
            return;
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
        return;
    }

    if (text.startsWith('/removeemployee') && user.role === 'OWNER') {
        const parts = text.split(' ');
        if (parts.length < 2) {
            bot.sendMessage(chatId, "📝 **Usage:** `/removeemployee [telegram_id]`");
            return;
        }
        const empId = parts[1];
        try {
            await prisma.user.delete({ where: { telegramId: empId } });
            bot.sendMessage(chatId, `✅ User ${empId} has been removed.`);
        } catch (error) {
            bot.sendMessage(chatId, "❌ Error removing employee (user might not exist).");
        }
        return;
    }

    if (text === '/listusers' && user.role === 'OWNER') {
        const users = await prisma.user.findMany();
        let list = "👥 **User List:**\n\n";
        users.forEach(u => {
            list += `• ${u.username} (${u.telegramId}) - **${u.role}**\n`;
        });
        bot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
        return;
    }

    if (text === '/start' || text.toLowerCase() === 'cancel' || text.toLowerCase() === 'menu') {
        resetState(chatId);
        showCarTypeMenu(chatId);
        return;
    }

    const state = userState[chatId];
    if (state && state.step === 'awaiting_price') {
        const price = parseFloat(text.replace('$', '').trim());
        if (isNaN(price)) {
            bot.sendMessage(chatId, "⚠️ Please enter a valid number for the price.");
            return;
        }
        // Show add-on menu after price entry
        state.basePrice = price;
        state.addons = [];  // Initialize empty addons array
        state.totalAddonPrice = 0;
        state.step = 'awaiting_addon';
        const keyboard = showAddonMenu(chatId, null, state.carType);

        bot.sendMessage(chatId, `🚗 **Type:** ${state.carType}\n🧼 **Service:** ${state.service} ($${price})\n\n✨ **Select Add-ons (you can select multiple):**`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    } else if (!state) {
        showCarTypeMenu(chatId);
    }
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    const user = await getAuthorizedUser(query);
    if (!user) {
        bot.answerCallbackQuery(query.id, { text: "🚫 Unauthorized.", show_alert: true });
        return;
    }


    if (data.startsWith('type:')) {
        const type = data.split(':')[1];
        userState[chatId] = { carType: type, step: 'awaiting_service' };

        const keyboard = SERVICES.map(service => {
            const price = PRICES[type] && PRICES[type][service];
            const label = price ? `${service} ($${price})` : service;
            return [{ text: label, callback_data: `service:${service}` }];
        });

        bot.editMessageText(`🚗 **Selected Type:** ${type}\n\n🧼 **Now select Service:**`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    }
    else if (data.startsWith('service:')) {
        const service = data.split(':')[1];
        const state = userState[chatId];

        if (state) {
            state.service = service;
            const price = PRICES[state.carType] && PRICES[state.carType][service];

            if (price) {
                // Show add-on menu
                state.basePrice = price;
                state.addons = [];  // Initialize empty addons array
                state.totalAddonPrice = 0;
                state.step = 'awaiting_addon';
                const keyboard = showAddonMenu(chatId, messageId, state.carType);

                bot.editMessageText(`🚗 **Type:** ${state.carType}\n🧼 **Service:** ${service} ($${price})\n\n✨ **Select Add-ons (you can select multiple):**`, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: keyboard }
                });
            } else {
                // Ask for price if not predefined (Shampoo)
                state.step = 'awaiting_price';
                bot.editMessageText(`🚗 **Type:** ${state.carType}\n🧼 **Service:** ${service}\n\n💰 **Please type the PRICE ($):**`, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                });
            }
        }
    }
    else if (data.startsWith('addon:')) {
        const addon = data.split(':')[1];
        const state = userState[chatId];

        if (state) {
            // Initialize addons array if not exists
            if (!state.addons) {
                state.addons = [];
                state.totalAddonPrice = 0;
            }

            if (addon === 'Done with Add-ons') {
                // Finish and save
                const totalPrice = state.basePrice + state.totalAddonPrice;
                const addonsText = state.addons.length > 0 ? ` + ${state.addons.join(' + ')}` : '';
                const addonsPriceText = state.totalAddonPrice > 0 ? ` (+$${state.totalAddonPrice})` : '';

                bot.editMessageText(`🚗 **Type:** ${state.carType}\n🧼 **Service:** ${state.service}${addonsText}${addonsPriceText}\n💰 **Total:** $${totalPrice}\n\n✅ *Saving...*`, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                });
                await saveWash(chatId, query, state, totalPrice);
            } else {
                // Check if addon already selected
                if (state.addons.includes(addon)) {
                    bot.answerCallbackQuery(query.id, {
                        text: `❌ ${addon} already added!`,
                        show_alert: false
                    });
                    return;
                }

                // Add this addon to the list
                const addonPrice = ADDON_PRICES[state.carType] && ADDON_PRICES[state.carType][addon];
                if (addonPrice) {
                    state.addons.push(addon);
                    state.totalAddonPrice += addonPrice;
                }

                const currentTotal = state.basePrice + state.totalAddonPrice;
                const addonsText = state.addons.length > 0 ? `\n📋 **Selected:** ${state.addons.join(', ')}` : '';

                // Show menu again for more add-ons
                const keyboard = showAddonMenu(chatId, messageId, state.carType);
                bot.editMessageText(`🚗 **Type:** ${state.carType}\n🧼 **Service:** ${state.service} ($${state.basePrice})${addonsText}\n💰 **Current Total:** $${currentTotal}\n\n✨ **Add another or finish:**`, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: keyboard }
                });
            }
        }
    }

    bot.answerCallbackQuery(query.id);
});



