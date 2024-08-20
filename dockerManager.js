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

// Function to get a container by ID
function getContainer(containerId) {
  try {
    return docker.getContainer(containerId);
  } catch (error) {
    console.error('Error getting container:', error);
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
    if (Stdout) {
      Stdout.on('data', chunk => output += chunk.toString());
    }
    if (Stderr) {
      Stderr.on('data', chunk => output += chunk.toString());
    }

    await new Promise((resolve, reject) => {
      if (Stdout) Stdout.on('end', resolve);
      if (Stderr) Stderr.on('end', resolve);
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

    const stream = await exec.start({ Detach: false });

    // Check if the stream has stdin
    if (stream.stdin) {
      // Pipe data from the container to the socket
      stream.stdout.on('data', (data) => {
        socket.emit('terminal-output', data.toString());
      });

      stream.stderr.on('data', (data) => {
        socket.emit('terminal-output', data.toString());
      });

      // Handle input from the web client
      socket.on('terminal-input', (input) => {
        if (stream.stdin && typeof stream.stdin.write === 'function') {
          stream.stdin.write(input);
        } else {
          console.error('stdin does not support writing');
        }
      });

      socket.on('disconnect', () => {
        if (stream.stdin) stream.stdin.end();
      });
    } else {
      console.error('stdin is not available on the stream');
    }
  } catch (error) {
    console.error('Error attaching terminal:', error);
    throw error;
  }
}


// Function to execute a command in a container
async function executeCommand(containerId, command) {
  try {
    const container = docker.getContainer(containerId);

    // Create exec instance
    const exec = await container.exec({
      Cmd: [command],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true
    });

    return exec;
  } catch (error) {
    console.error('Error creating exec instance:', error);
    throw error;
  }
}

module.exports = { 
  listContainers, 
  createContainer, 
  createAlpineContainer, 
  stopAndRemoveContainer, 
  getContainerStatus,
  attachTerminal,
  getContainer,
  executeCommand  
};
