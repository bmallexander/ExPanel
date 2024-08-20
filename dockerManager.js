const { exec, execSync } = require('child_process');
const { Writable } = require('stream');
const Docker = require('dockerode');
const docker = new Docker();

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

// Run a command in a specific container
async function runCommandInContainer(containerId, command) {
  try {
    // Use Docker CLI to execute the command in the container
    const result = execSync(`docker exec ${containerId} ${command}`, { encoding: 'utf8' });
    return result;
  } catch (error) {
    console.error('Error running command in container:', error);
    throw error;
  }
}

// Attach a terminal using Docker CLI and `pty`
async function attachTerminal(containerId, socket) {
  try {
    const cmd = `docker exec -it ${containerId} sh`;

    const terminal = exec(cmd, { stdio: ['pipe', 'pipe', 'pipe'] });

    terminal.stdout.on('data', (data) => {
      socket.emit('terminal-output', data.toString());
    });

    terminal.stderr.on('data', (data) => {
      socket.emit('terminal-output', data.toString());
    });

    socket.on('terminal-input', (input) => {
      if (terminal.stdin) {
        terminal.stdin.write(input);
      } else {
        console.error('stdin does not support writing or is not available');
      }
    });

    socket.on('disconnect', () => {
      if (terminal.stdin) terminal.stdin.end();
    });
  } catch (error) {
    console.error('Error attaching terminal:', error);
    throw error;
  }
}

// Function to execute a command in a container
async function executeCommand(containerId, command) {
  try {
    // Create exec instance and run the command using Docker CLI
    const result = execSync(`docker exec ${containerId} ${command}`, { encoding: 'utf8' });
    return result;
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
  executeCommand,
  runCommandInContainer
};
