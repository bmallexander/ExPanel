const express = require('express');
const router = express.Router();
const Docker = require('dockerode');
const User = require('./models/User');
const VPS = require('./models/VPS');

const docker = new Docker();

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
