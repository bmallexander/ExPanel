const express = require('express');
const router = express.Router();
const User = require('./models/User');
const VPS = require('./models/VPS');

router.post('/vps/create', async (req, res) => {
    const { name, os } = req.body;

    // Translate the selected OS into a Docker image
    let image;
    if (os === 'alpine') {
        image = 'alpine:latest';
    }

    try {
        const vps = new VPS({
            name,
            image,
            userId: req.user._id
        });
        await vps.save();
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error creating VPS:', error);
        res.redirect('/dashboard?error=1');
    }
});

module.exports = router;
