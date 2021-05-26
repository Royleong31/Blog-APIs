// ?: By using a separate file to handle the connection to socket.io, the io can be used in separate files

let io;

module.exports = {
  init: (httpServer) => {
    io = require("socket.io")(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    return io;
  },

  getIO: () => {
    if (!io) throw new Error("Socket.io not initialised");

    return io;
  },
};
