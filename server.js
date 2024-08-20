const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const User = require('./models/User');
const VPS = require('./models/VPS');
const dockerManager = require('./dockerManager');
require('./auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

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

// Consolidated WebSocket connection handler
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('attach-terminal', async (vpsId) => {
    try {
      const vps = await VPS.findById(vpsId);
      const container = dockerManager.getContainer(vps.containerId);

      const exec = await container.exec({
        Cmd: ['sh'],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true
      });

      exec.start((err, stream) => {
        if (err) {
          console.error('Error starting exec:', err);
          return;
        }

        stream.on('data', (data) => {
          socket.emit('terminal-output', data.toString());
        });

        socket.on('terminal-input', (data) => {
          // Send input to the container
          stream.write(data);
        });

        stream.on('end', () => {
          console.log('Exec stream ended');
        });
      });
    } catch (error) {
      console.error('Error attaching terminal:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

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
    image = 'default-image:latest'; // Or another suitable default image
  }

  try {
    const container = os === 'alpine' 
      ? await dockerManager.createAlpineContainer(name)
      : await dockerManager.createContainer(image, name);

    const vps = new VPS({
      name,
      os, 
      image,
      owner: req.user._id,
      containerId: container.id
    });

    await vps.save();
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error creating VPS:', error);
    res.redirect('/dashboard?error=1');
  }
});

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

app.post('/vps/:id/power', isAuthenticated, async (req, res) => {
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

app.post('/vps/:id/run-command', isAuthenticated, async (req, res) => {
  const { command } = req.body;
  try {
    const vps = await VPS.findById(req.params.id);
    const container = dockerManager.getContainer(vps.containerId);

    const exec = await container.exec({
      Cmd: [command],
      AttachStdout: true,
      AttachStderr: true
    });

    exec.start((err, stream) => {
      if (err) {
        console.error('Error starting exec:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      stream.on('data', data => {
        console.log('Command output:', data.toString());
      });

      res.status(200).json({ success: true });
    });

  } catch (error) {
    console.error('Error running command on VPS:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

//app.use('/');

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
