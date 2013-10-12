var socketio = require('socket.io');
var HashTable = require('./util/hashtable');

module.exports = function (server) {
  var io = socketio.listen(server);
  var sockets = new HashTable();
  io.sockets.on('connection', function (socket) {
    socket.params = {
      "user" : null
    };
    socket.on("message", function (data) {
      var fromuser, touser, sock;
      if (data.type === "requestjoin") {
        fromuser = data.fromuser;
        socket.params.user = data.fromuser;
        sockets.put(fromuser, socket);
        socket.broadcast.emit("message", { "type" : "join", "fromuser" : fromuser});
      } else if (data.type === "ackjoin") {
        touser = data.touser;
        sock = sockets.get(touser);
        if (sock) {
          sock.emit("message", { "type" : "ackjoin", "fromuser": data.fromuser });
        }
      } else {
        touser = data.touser;
        sock = sockets.get(touser);
        if (sock) {
          sock.emit("message", data);
        }
      }
    });
    socket.on("disconnect", function () {
      if (socket.params.user) {
        sockets.remove(socket.params.user);
        socket.broadcast.emit("message", { "type" : "leave", "fromuser" : socket.params.user});
      }
    });
  });
};
