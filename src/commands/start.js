module.exports = {
  name: 'start',
  description: 'Start the bot',
  async execute(ctx) {
    await ctx.reply('Hello! I am a bot built with telegram-bot-starter. Type /help for commands.');
  },
};
