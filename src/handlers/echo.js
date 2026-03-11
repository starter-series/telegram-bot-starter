module.exports = {
  name: 'echo',
  register(bot) {
    bot.on('message:text', async (ctx) => {
      await ctx.reply(ctx.message.text);
    });
  },
};
