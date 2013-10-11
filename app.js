
/**
 * Module dependencies.
 */

var express = require('express');
var index = require('./routes/index');
var http = require('http');
var path = require('path');
var HashTable = require('hashtable');

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
server.listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});

var conns = new HashTable();

io.sockets.on('connection', function (conn) {
  conn.params = {
    "user" : null
  };
  conn.on("heartbeat", function (data) {
    conn.emit("ackheartbeat", {});
  });
  conn.on("ackheartbeat", function (data) {
    console.log("receive ack heartbeat");
  });
  conn.on("connected", function (data) {
    conn.params.user = data.user;
    console.log(data.user + " is connected.");
    var users = conns.keys();
    users.forEach(function (e, i) {
      var user_conn = conns.get(e);
      try {
        user_conn.emit("useradd", {name : conn.params.user});
        conn.emit("useradd", {name : e});
      } catch (e) {}
    });
    conns.put(conn.params.user, conn);
  });
  var heartbeatTask = setInterval(function () {
    conn.emit("heartbeat", {});
  }, 5000);

  conn.on('disconnect', function () {
    clearInterval(heartbeatTask);
    if (conn.params.user) {
      conns.remove(conn.params.user);
    }
    var users = conns.keys();
    users.forEach(function (e, i) {
      var user_conn = conns.get(e);
      try {
        user_conn.emit("userremove", {name : conn.params.user});
      } catch (e) {}
    });
  });
});
