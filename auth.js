const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const mongoose = require('mongoose');
const User = require('./models/User');

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id); // Using async/await instead of callback
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(new DiscordStrategy({
  clientID: '1272176739841216523',
  clientSecret: 'OyCg2p1UQUsYDra4uYLn8Pekund3evVe',
  callbackURL: 'http://localhost:3000/auth/discord/callback',
  scope: ['identify', 'email', 'guilds']
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await User.findOneAndUpdate(
      { discordId: profile.id },
      { 
        discordId: profile.id,
        username: profile.username,
        avatar: profile.avatar,
        discriminator: profile.discriminator,
      },
      { upsert: true, new: true }
    );
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));
