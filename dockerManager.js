const Docker = require('dockerode');
const docker = new Docker();
const { PassThrough } = require('stream');

// List all containers
async function listContainers() {
  try {
    const containers = await docker.listContainers({ all: true });
    return containers;
  } catch (error) {
    console.error('Error listing containers:', error);
    throw error;
  }
}

// Create a new container (supports different images, including Alpine)
async function createContainer(imageName, containerName, hostPort = null, containerPort = null) {
  try {
    const config = {
      Image: imageName,
      name: containerName,
      Tty: true, // Keep the terminal open (useful for Alpine)
    };

    if (hostPort && containerPort) {
      config.ExposedPorts = { [`${containerPort}/tcp`]: {} };
      config.HostConfig = {
        PortBindings: {
          [`${containerPort}/tcp`]: [{ HostPort: hostPort }]
        }
      };
    }

    const container = await docker.createContainer(config);
    await container.start();
    return container;
  } catch (error) {
    console.error('Error creating container:', error);
    throw error;
  }
}

// Create an Alpine-based container
async function createAlpineContainer(containerName) {
  return await createContainer('alpine:latest', containerName);
}

// Stop and remove a container
async function stopAndRemoveContainer(containerId) {
  try {
    const container = docker.getContainer(containerId);
    await container.stop();
    await container.remove();
  } catch (error) {
    console.error('Error stopping/removing container:', error);
    throw error;
  }
}

// Check the status of a specific container
async function getContainerStatus(containerId) {
  try {
    const container = docker.getContainer(containerId);
    const data = await container.inspect();
    return data.State.Status; // Returns 'running', 'stopped', etc.
  } catch (error) {
    console.error('Error inspecting container:', error);
    throw error;
  }
}

// Run a command in a specific container
async function runCommandInContainer(containerId, command) {
  try {
    const container = docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: [command],
      AttachStdout: true,
      AttachStderr: true,
    });

    const { Stdout, Stderr } = await exec.start();
    let output = '';

    Stdout.on('data', chunk => output += chunk.toString());
    Stderr.on('data', chunk => output += chunk.toString());

    await new Promise((resolve, reject) => {
      Stdout.on('end', resolve);
      Stderr.on('end', resolve);
    });

    return output;
  } catch (error) {
    console.error('Error running command in container:', error);
    throw error;
  }
}

// Attach a terminal to a container
async function attachTerminal(containerId, socket) {
  try {
    const container = docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: ['sh'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });

    const { stdin, stdout, stderr } = await exec.start();

    // Pipe data from the container to the socket
    stdout.on('data', (data) => {
      socket.emit('terminal-output', data.toString());
    });
    stderr.on('data', (data) => {
      socket.emit('terminal-output', data.toString());
    });

    // Handle input from the web client
    socket.on('terminal-input', (input) => {
      stdin.write(input);
    });

    socket.on('disconnect', () => {
      stdin.end();
    });
  } catch (error) {
    console.error('Error attaching terminal:', error);
    throw error;
  }
}

module.exports = { 
  listContainers, 
  createContainer, 
  createAlpineContainer, 
  stopAndRemoveContainer, 
  getContainerStatus,
  attachTerminal 
};