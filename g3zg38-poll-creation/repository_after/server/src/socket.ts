import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

export function attachSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    path: '/socket.io',
  });

  // Req 4: join-poll for real-time updates
  io.on('connection', (socket: Socket) => {
    socket.on('join-poll', (pollId: string) => {
      if (pollId) socket.join(pollId);
    });
  });

  return io;
}

export function getIoFromApp(app: { get?: (key: string) => unknown }): Server | undefined {
  return app.get?.('io') as Server | undefined;
}
