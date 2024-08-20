const Docker = require('dockerode');
const docker = new Docker();
const { exec } = require('child_process');

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

// Create a new container
async function createContainer(imageName, containerName, hostPort = null, containerPort = null) {
  try {
    const config = {
      Image: imageName,
      name: containerName,
      Tty: true, // Keep the terminal open
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

// Attach a terminal to the container
async function attachTerminal(containerId, socket) {
  try {
    const container = docker.getContainer(containerId);

    // Create an exec instance
    const execInstance = await container.exec({
      Cmd: ['sh'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true
    });

    execInstance.start({ Detach: false }, (err, stream) => {
      if (err) {
        console.error('Error starting exec instance:', err);
        socket.emit('terminal-error', 'Failed to start exec instance');
        return;
      }

      if (!stream) {
        console.error('No stream returned from exec start');
        socket.emit('terminal-error', 'Stream not available');
        return;
      }

      const { stdin, stdout, stderr } = stream;

      if (!stdin || !stdout || !stderr) {
        console.error('One or more streams are missing');
        socket.emit('terminal-error', 'Stream components are missing');
        return;
      }

      // Handle stdout and stderr
      stdout.on('data', (data) => {
        socket.emit('terminal-output', data.toString());
      });

      stderr.on('data', (data) => {
        socket.emit('terminal-output', data.toString());
      });

      // Error handling for streams
      stdout.on('error', (err) => {
        console.error('stdout error:', err);
      });

      stderr.on('error', (err) => {
        console.error('stderr error:', err);
      });

      // Handle client input
      socket.on('terminal-input', (data) => {
        if (stdin) {
          stdin.write(data);
        } else {
          console.error('stdin is not available');
        }
      });

      // Handle socket disconnection
      socket.on('disconnect', () => {
        console.log('Client disconnected');
        if (stdin) {
          stdin.end(); // Properly close stdin
        }
        if (stream) {
          stream.destroy(); // Close the stream
        }
      });
    });
  } catch (error) {
    console.error('Error attaching terminal:', error);
    socket.emit('terminal-error', 'Error attaching terminal');
  }
}

// Function to execute a command in a container
async function executeCommand(containerId, command) {
  try {
    const container = docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: [command],
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false
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
    console.error('Error executing command in container:', error);
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
