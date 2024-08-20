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
  try {
    const vpsList = await VPS.find({ owner: req.user._id });
    res.render('dashboard', { user: req.user, vpsList });
  } catch (error) {
    console.error('Error fetching VPS list:', error);
    res.redirect('/dashboard?error=1');
  }
});

app.post('/vps/create', isAuthenticated, async (req, res) => {
  const { name, os } = req.body;

  let image;
  if (os === 'alpine') {
    image = 'alpine:latest';
  } else {
    // Default to a placeholder image or another image as needed
    image = 'default-image:latest';
  }

  try {
    // Create the container using the selected image
    const container = os === 'alpine' 
      ? await dockerManager.createAlpineContainer(name)
      : await dockerManager.createContainer(image, name);

    // Save VPS details in the database
    const vps = new VPS({
      name,
      os, // Store the OS for display
      image,
      owner: req.user._id, // Make sure this field matches your schema
      containerId: container.id
    });

    await vps.save();
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error creating VPS:', error);
    res.redirect('/dashboard?error=1');
  }
});

// Route to remove a VPS container
app.post('/vps/remove', isAuthenticated, async (req, res) => {
  const { vpsId } = req.body;

  try {
    const vps = await VPS.findById(vpsId);
    if (!vps) {
      throw new Error('VPS not found');
    }
    await dockerManager.stopAndRemoveContainer(vps.containerId);
    await vps.remove();
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error removing VPS:', error);
    res.redirect('/dashboard?error=1');
  }
});

// Route to get management options for a VPS
router.get('/vps/:id/manage', async (req, res) => {
  try {
    const vps = await VPS.findById(req.params.id);
    // Fetch container status or other details
    const container = dockerManager.getContainer(vps.containerId);
    const containerInfo = await container.inspect();
    
    res.json({ status: containerInfo.State.Status });
  } catch (error) {
    console.error('Error fetching VPS management options:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to restart or shutdown a VPS
router.post('/vps/:id/power', async (req, res) => {
  const { action } = req.body; // action can be 'restart' or 'shutdown'
  try {
    const vps = await VPS.findById(req.params.id);
    const container = dockerManager.getContainer(vps.containerId);

    if (action === 'restart') {
      await container.restart();
    } else if (action === 'shutdown') {
      await container.stop();
    }

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error handling VPS power action:', error);
    res.status(500).redirect('/dashboard?error=1');
  }
});

// Route to run a command on a VPS
router.post('/vps/:id/run-command', async (req, res) => {
  const { command } = req.body;
  try {
    const vps = await VPS.findById(req.params.id);
    const container = dockerManager.getContainer(vps.containerId);

    await container.exec({
      Cmd: [command],
      AttachStdout: true,
      AttachStderr: true
    }).start();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error running command on VPS:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;

app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
