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
        const destination = frame.headers.destination;
        if (destination && destination.startsWith('/topic/initData')) {
          setTimeout(() => {
            this.stompServer.send(
              destination,
              {},
              JSON.stringify({ currentDateTime: new Date().toISOString() }),
            );
          }, 0);
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
      if (!frame) {
        return;
      }

      const destination = frame?.headers?.destination || frame?.destination;
      if (destination && destination.startsWith('/app/initData')) {
        const topicDestination = destination.replace('/app/initData', '/topic/initData');
        console.log('Init data request received for destination:', destination);
        this.stompServer.send(
          topicDestination,
          {},
          JSON.stringify({ currentDateTime: new Date().toISOString() }),
        );
        return;
      }

      if (frame.body) {
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
