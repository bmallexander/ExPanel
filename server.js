const express = require('express');
const bodyParser = require('body-parser');
const dockerManager = require('./dockerManager');

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));

// Home Route - List containers
app.get('/', async (req, res) => {
  const containers = await dockerManager.listContainers();
  res.render('index', { containers });
});

// Route to create a new container
app.post('/create', async (req, res) => {
  const { imageName, containerName } = req.body;
  await dockerManager.createContainer(imageName, containerName);
  res.redirect('/');
});

// Route to stop and remove a container
app.post('/remove', async (req, res) => {
  const { containerId } = req.body;
  await dockerManager.stopAndRemoveContainer(containerId);
  res.redirect('/');
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
