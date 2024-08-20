const Docker = require('dockerode');
const docker = new Docker();

// List all containers
async function listContainers() {
  const containers = await docker.listContainers({ all: true });
  return containers;
}

// Create a new container (example for a game server)
async function createContainer(imageName, containerName) {
  const container = await docker.createContainer({
    Image: imageName,
    name: containerName,
    ExposedPorts: { "25565/tcp": {} }, // Example for Minecraft server
    HostConfig: {
      PortBindings: {
        "25565/tcp": [{ "HostPort": "25565" }]
      }
    }
  });
  await container.start();
  return container;
}

// Stop and remove a container
async function stopAndRemoveContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.stop();
  await container.remove();
}

module.exports = { listContainers, createContainer, stopAndRemoveContainer };
