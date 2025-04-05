// test-ws.js
const WebSocket = require('ws');

// Define the WebSocket URL
const wsUrl = 'ws://localhost:5000/ws';
console.log(`Connecting to WebSocket at ${wsUrl}`);

// Create a new WebSocket connection
const ws = new WebSocket(wsUrl);

// Connection opened
ws.on('open', () => {
  console.log('Connection established!');
  
  // Send a test message
  const message = {
    type: 'join',
    data: { username: 'test-user' }
  };
  
  console.log('Sending test message:', message);
  ws.send(JSON.stringify(message));
});

// Listen for messages
ws.on('message', (data) => {
  console.log('Received message from server:', JSON.parse(data));
});

// Connection error
ws.on('error', (error) => {
  console.error('WebSocket connection error:', error);
});

// Connection closed
ws.on('close', (code, reason) => {
  console.log(`Connection closed: ${code} - ${reason}`);
});

// Exit after 5 seconds
setTimeout(() => {
  console.log('Test complete, closing connection...');
  ws.close();
  process.exit(0);
}, 5000);