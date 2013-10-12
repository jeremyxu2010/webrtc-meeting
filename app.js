
/**
 * Module dependencies.
 */

var express = require('express');
var index = require('./routes/index');
var http = require('http');
var path = require('path');
var HashTable = require('./util/hashtable');
var util = require('util');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.engine('.html', require('ejs').__express);
app.set('views', __dirname + '/views');
app.set('view engine', 'html');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

index(app);

var server = http.createServer(app);
var io = require('socket.io').listen(server);
server.listen(app.get('port'), "192.168.9.85", function () {
  console.log('Express server listening on port ' + app.get('port'));
});

var sockets = new HashTable();

io.sockets.on('connection', function (socket) {
  socket.on("message", function (data) {
    if (data.type === "requestjoin") {
      var name = data.fromuser;
      sockets.put(name, socket);
      socket.broadcast.emit("message", { "type" : "join", "name" : name});
    } else if (data.type === "ackjoin") {
      var touser = data.touser;
      var sock = sockets.get(touser);
      sock.emit("message", { "type" : "ackjoin", "user": data.fromuser });
    } else {
      var touser = data.touser;
      var sock = sockets.get(touser);
      sock.emit("message", data);
    }
  });
});
