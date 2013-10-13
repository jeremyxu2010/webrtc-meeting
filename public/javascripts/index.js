/*global
  document:true,
  navigator:true,
  window:true,
  URL:true,
  currentUser:true,
  RTCPeerConnection:true,
  webkitRTCPeerConnection:true,
  mozRTCPeerConnection:true,
  msRTCPeerConnection:true,
  RTCSessionDescription:true,
  RTCIceCandidate:true,
  serverhost:true,
  serverport:true,
  location:true,
  alert:true
  */
//the require library is configuring paths
require.config({
  paths: {
    //tries to load jQuery from Google's CDN first and falls back
    //to load locally
    "jquery": [
      "http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min",
      "libs/jquery/jquery"
    ],
    "jquery.bootstrap": "libs/bootstrap/dist/js/bootstrap.min",
    "socketio": "libs/socket.io-client/dist/socket.io.min",
    "hashtable": "libs/jshashtable/hashtable"
  },
  shim: {
    'hashtable': {
      exports: 'Hashtable'
    },
    "jquery.bootstrap": {
      deps: ["jquery"]
    }
  },
  map: {
    '*': {
      'css': 'libs/require-css/css',
      'less': 'libs/require-less/less'
    }
  },
  //how long the it tries to load a script before giving up, the default is 7
  waitSeconds: 10
});

function start($, io, HashTable) {
  navigator.getUserMedia = (navigator.getUserMedia ||
                         navigator.webkitGetUserMedia ||
                         navigator.mozGetUserMedia ||
                         navigator.msGetUserMedia);
  var URL = window.URL || window.webkitURL;
  var RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection || window.msRTCPeerConnection);

  function hasGetUserMedia() {
    // Note: Opera is unprefixed.
    return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
              navigator.mozGetUserMedia || navigator.msGetUserMedia);
  }

  if (!hasGetUserMedia()) {
    alert('getUserMedia() is not supported in your browser');
  }

  navigator.getUserMedia({
    "video": true,
    "audio": false
  }, function (stream) {
    var selfVideoView = document.getElementById("selfVideoView");
    selfVideoView.src = URL.createObjectURL(stream);
    var selfVideoLabel = document.getElementById("selfVideoLabel");
    selfVideoLabel.innerHTML = 'ME';

    var iosocketurl = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '');
    var socket = io.connect(iosocketurl);

    var pcs = new HashTable();

    function offer(pc, user) {
      pc.createOffer(function (description) {
        pc.setLocalDescription(description);
        socket.emit("message", {
          "fromuser": currentUser,
          "touser": user,
          type: "offer",
          "description": description
        });
      });
    }

    function createRemoteView(user) {
      var remoteViewContainer = document.createElement("div");
      remoteViewContainer.id = user + "_removeView";
      remoteViewContainer.className = "remoteViewCls";

      var remoteView = document.createElement("video");
      remoteView.muted = true;
      remoteView.autoplay = true;
      remoteViewContainer.appendChild(remoteView);

      var remoteViewLabel = document.createElement("div");
      remoteViewLabel.innerHTML = user.toUpperCase();
      remoteViewContainer.appendChild(remoteViewLabel);

      document.getElementById("remoteViews").appendChild(remoteViewContainer);
      return remoteView;
    }

    function removeRemoteView(user) {
      var remoteViewId = user + "_removeView";
      var remoteViewEle = document.getElementById(remoteViewId);
      if (remoteViewEle) {
        remoteViewEle.parentNode.removeChild(remoteViewEle);
      }
    }

    function create_rtc_pc(user) {
      var configuration = {
        "iceServers": [{
          "url": "stun:stun.ekiga.net:3478"
        }, {
          "url": "turn:test@74.117.58.198:3478",
          "credential": "123456"
        }]
      };

      var pc = new RTCPeerConnection(configuration);

      pc.addStream(stream);

      pc.onicecandidate = function (event) {
        if (!event || !event.candidate) {
          return;
        }
        socket.emit("message", {
          "fromuser": currentUser,
          "touser": user,
          "type": "iceCandidate",
          "candidate": event.candidate
        });
      };

      pc.onaddstream = function (event) {
        var remoteView = createRemoteView(user);
        remoteView.src = URL.createObjectURL(event.stream);
      };
      pcs.put(user, pc);
      return pc;
    }



    function destroy_rtc_pc(user) {
      var pc = pcs.get(user);
      if (pc) {
        try {
          pc.removeStream(stream);
          pc.close();
        } catch (e) {}
        pcs.remove(user);
      }
      removeRemoteView(user);
    }

    socket.on("connect", function () {
      socket.emit("message", {
        "type": "requestjoin",
        "fromuser": currentUser
      });

      socket.on("message", function (data) {
        var fromuser, pc;
        if (data.type === "join") {
          fromuser = data.fromuser;
          pc = create_rtc_pc(fromuser);
          socket.emit("message", { "type" : "ackjoin", "fromuser": currentUser,  "touser" : fromuser});
        } else if (data.type === "ackjoin") {
          fromuser = data.fromuser;
          pc = create_rtc_pc(fromuser);
          offer(pc, fromuser);
        } else if (data.type === "leave") {
          fromuser = data.fromuser;
          destroy_rtc_pc(fromuser);
        } else if (data.type === "iceCandidate") {
          var candidate = new RTCIceCandidate(data.candidate);
          pc = pcs.get(data.fromuser);
          if (pc) {
            pc.addIceCandidate(candidate);
          }
        } else if (data.type === "offer") {
          pc = pcs.get(data.fromuser);
          if (pc) {
            pc.setRemoteDescription(new RTCSessionDescription(data.description));
            pc.createAnswer(function (description) {
              pc.setLocalDescription(description);
              socket.emit("message", {"fromuser": currentUser, "touser": data.fromuser, type: "answer", description: description});
            });
          }
        } else if (data.type === "answer") {
          pc = pcs.get(data.fromuser);
          if (pc) {
            pc.setRemoteDescription(new RTCSessionDescription(data.description));
          }
        }
      });
    });

    socket.on("disconnect", function () {
      var users = pcs.keys();
      users.forEach(function (user, idx) {
        destroy_rtc_pc(user);
      });
    });
  });
}

//requiring the scripts in the first argument and then passing the library namespaces into a callback
//you should be able to console log all of the callback arguments
require(['jquery', 'socketio', 'hashtable', 'jquery.bootstrap', 'css!libs/bootstrap/dist/css/bootstrap', 'less!../stylesheets/index'], function ($, io, HashTable) {
  start($, io, HashTable);
});