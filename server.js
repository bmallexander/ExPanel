const express = require('express');
const router = express.Router();
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const User = require('./models/User');
const VPS = require('./models/VPS');
const dockerManager = require('./dockerManager');
require('./auth');

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

mongoose.connect('mongodb+srv://mainuser:Allexander01@cluster0.3owwf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(session({
  secret: 'eae-zeaea-azeaze',
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes for authentication
app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', {
  failureRedirect: '/',
  successRedirect: '/dashboard',
}));

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/auth/discord');
}

// Dashboard route
app.get('/dashboard', isAuthenticated, async (req, res) => {
  const vpsList = await VPS.find({ owner: req.user._id });
  res.render('dashboard', { user: req.user, vpsList });
});

// Route to create a new VPS container
app.post('/vps/create', isAuthenticated, async (req, res) => {
  const { name, image } = req.body;
  const container = await dockerManager.createContainer(image, name);
  const vps = new VPS({
    name,
    image,
    owner: req.user._id,
    containerId: container.id,
  });
  await vps.save();
  res.redirect('/dashboard');
});

// Route to remove a VPS container
app.post('/vps/remove', isAuthenticated, async (req, res) => {
  const { vpsId } = req.body;
  const vps = await VPS.findById(vpsId);
  await dockerManager.stopAndRemoveContainer(vps.containerId);
  await vps.remove();
  res.redirect('/dashboard');
});

app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

router.post('/vps/create', async (req, res) => {
  const { name, os } = req.body;

  // Translate the selected OS into a Docker image
  let image;
  if (os === 'alpine') {
      image = 'alpine:latest';
  }

  try {
      // Create a new Docker container
      const container = await docker.createContainer({
          Image: image,
          Cmd: ['/bin/sh'],  // Command to run inside the container
          name: name,
          Tty: true
      });

      // Start the container
      await container.start();

      // Save VPS details in the database
      const vps = new VPS({
          name,
          image,
          userId: req.user._id,
          containerId: container.id // Store the Docker container ID
      });
      await vps.save();

      res.redirect('/dashboard');
  } catch (error) {
      console.error('Error creating VPS:', error);
      res.redirect('/dashboard?error=1');
  }
});

module.exports = router;


app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
