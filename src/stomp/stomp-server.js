const StompServer = require('stomp-broker-js');
const dataService = require('../services/data.service');

class StompServerManager {
  constructor(httpServer, wsPath = '/ws') {
    this.stompServer = new StompServer({
      server: httpServer,
      path: wsPath,
    });
    this.setupSubscriptions();
  }

  setupSubscriptions() {
    // Subscribe to client connections
    this.stompServer.on('subscribe', (frame) => {
      if (frame && frame.headers) {
        console.log('Client subscribed:', frame.headers.id || 'unknown', 'to', frame.headers.destination);
        const allData = dataService.getAllData();
        if (frame.headers.destination) {
          this.stompServer.send(frame.headers.destination, {}, JSON.stringify(allData));
        }
      } else {
        console.log('Client subscribed with null/undefined frame headers');
      }
    });

    // Subscribe to client disconnections
    this.stompServer.on('unsubscribe', (frame) => {
      if (frame && frame.headers) {
        console.log('Client unsubscribed:', frame.headers.id || 'unknown');
      } else {
        console.log('Client unsubscribed with null/undefined frame headers');
      }
    });

    // Handle incoming messages
    this.stompServer.on('send', (frame) => {
      if (frame && frame.body) {
        console.log('Message received:', frame.body);
        // Process message and broadcast if needed
      }
    });
  }

  getServer() {
    return this.stompServer;
  }

  broadcast(destination, message) {
    this.stompServer.send(destination, {}, JSON.stringify(message));
  }
}

module.exports = StompServerManager;
