/*global document:true, navigator:true, URL:true, io:true, curUserName:true, HashTable:true, RTCPeerConnection:true, RTCSessionDescription:true, RTCIceCandidate:true*/

var selfView = document.getElementById("selfView");

navigator.getUserMedia = (navigator.getUserMedia ||
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia ||
                       navigator.msGetUserMedia);
var RTCPeerConnection = (RTCPeerConnection ||
                    webkitRTCPeerConnection || mozRTCPeerConnection || msRTCPeerConnection);

var socket = io.connect("http://192.168.9.85:3000");

socket.on("connect", function () {
  navigator.getUserMedia({
    "video": true
  }, function (stream) {
    selfView.src = URL.createObjectURL(stream);

    socket.emit("message", { "type" : "requestjoin", "fromuser" : curUserName});

    var pcs = new HashTable();

    socket.on("message", function(data) {
        if (data.type === "join") {
          var name = data.name;
          var pc = create_rtc_pc(name);
          pcs.put(name, pc);
          socket.emit("message", { "type" : "ackjoin", "fromuser": curUserName,  "touser" : name});
        } else if (data.type === "ackjoin") {
          var user = data.user;
          var pc = create_rtc_pc(user);
          offer(pc, user);
          pcs.put(user, pc);
        } else if (data.type === "iceCandidate") {
          console.log("got candidate from " + data.fromuser);
          var candidate = new RTCIceCandidate(data.candidate);
          var pc = pcs.get(data.fromuser);
          if (pc) {
            pc.addIceCandidate(candidate);
          }
        } else if (data.type === "offer") {
          console.log("got offer from" + data.fromuser);
          var pc = pcs.get(data.fromuser);
          if (pc) {
            pc.setRemoteDescription(new RTCSessionDescription(data.description));
            pc.createAnswer(function(description) {
                pc.setLocalDescription(description);
                socket.emit("message", {"fromuser": curUserName, "touser": data.fromuser,type: "answer", description: description});
            });
          }
        } else if (data.type === "answer") {
          console.log("got answer from " + data.fromuser);
          var pc = pcs.get(data.fromuser);
          if (pc) {
            pc.setRemoteDescription(new RTCSessionDescription(data.description));
          }
        }
    });

    function offer(pc, user) {
        pc.createOffer( function (description) {
            pc.setLocalDescription(description);
            socket.emit("message", { "fromuser": curUserName, "touser": user, type: "offer", "description": description});
        });
    }

    function create_rtc_pc (user) {
      var configuration = {
        "iceServers": [{
          "url": "stun:stun.ekiga.net:3478"
        }, {
          "url": "turn:test@74.117.58.198:3478",
          "credential": "123456"
        }]
      };
      pc = new RTCPeerConnection(configuration);

      pc.addStream(stream);

      pc.onicecandidate = function (event) {
          if (!event || !event.candidate) return;
          socket.emit("message", {
              "fromuser": curUserName,
              "touser": user,
              type: "iceCandidate",
              "candidate": event.candidate
          });
      };

      pc.onaddstream = function(event) {
          var remoteView = document.createElement("video");
          remoteView.id = user + "_removeView";
          remoteView.autoplay = true;
          remoteView.src = webkitURL.createObjectURL(event.stream);
          remoteView.className = "remoteViewCls";
          document.getElementById("remoteViews").appendChild(remoteView);
          console.log("Got Remote Stream");
      };
      return pc;
    }



    // var candidate;

    // socket.on("message", function(data) {
    //     if (data.type === "iceCandidate") {
    //         candidate = new RTCIceCandidate(data.candidate);
    //         if (candidate && pc.remoteDescription) {
    //           pc.addIceCandidate(candidate);
    //         }
    //     } else if (data.type === "offer") {
    //         pc.setRemoteDescription(new RTCSessionDescription(data.description));
    //         pc.createAnswer(function(description) {
    //             pc.setLocalDescription(description);
    //             socket.emit("message", {type: "answer", description: description});
    //         });
    //     } else if (data.type === "answer") {
    //         pc.setRemoteDescription(new RTCSessionDescription(data.description));
    //         if (candidate && pc.remoteDescription) {
    //           pc.addIceCandidate(candidate);
    //         }
    //     }
    // });



  });
});





// get the local stream, show it in the local video element and send it
/*
navigator.getUserMedia({
  "video": true
}, function (stream) {
  localstream = stream;
  selfView.src = URL.createObjectURL(localstream);

  function create_user_rtc_conn(user, signal_conn) {
    var pc;
    var pccandidate;
    var remoteView = document.createElement("video");
    remoteView.id = user + "_remoteView";
    remoteView.autoplay = true;
    remoteView.className = "remoteViewCls";
    var origRemoteView = document.getElementById(remoteView.id);
    if (origRemoteView) {
      origRemoteView.parentNode.removeChild(origRemoteView);
    }
    document.getElementById("remoteViews").appendChild(remoteView);
    var configuration = {
      "iceServers": [{
        "url": "stun:stun.ekiga.net:3478"
      }, {
        "url": "turn:test@74.117.58.198:3478",
        "credential": "123456"
      }]
    };


    pc = new RTCPeerConnection(configuration);

    pc.addStream(localstream);

    function gotDescription(desc) {
      pc.setLocalDescription(desc);
      signal_conn.emit("rtcmsg", {
        "user": user,
        "type": "offer",
        "data": desc
      });
    }

    function gotAnswerDescription(desc) {
      pc.setLocalDescription(desc);
      signal_conn.emit("rtcmsg", {
        "user": user,
        "type": "answer",
        "data": desc
      });
    }

    // once remote stream arrives, show it in the remote video element
    pc.onaddstream = function (evt) {
      remoteView.src = URL.createObjectURL(evt.stream);
    };


    // send any ice candidates to the other peer
    pc.onicecandidate = function (evt) {
      if (!evt || !evt.candidate) return;
      signal_conn.emit("rtcmsg", {
        "user": user,
        "type": "candidate",
        "data": evt.candidate
      });
    };

    signal_conn.on("rtcmsg", function (signal) {
      switch (signal.type) {
      case "candidate":
        pccandidate = new RTCIceCandidate(signal.data);
        if (pc.remoteDescription && pccandidate) {
          pc.addIceCandidate(pccandidate);
        }
        break;
      case "offer":
        pc.setRemoteDescription(new RTCSessionDescription(signal.data));
        pc.createAnswer(gotAnswerDescription);
        break;
      case "answer":
        pc.setRemoteDescription(new RTCSessionDescription(signal.data));
        if (pc.remoteDescription && pccandidate) {
          pc.addIceCandidate(pccandidate);
        }
        break;
      }
    });


    pc.createOffer(gotDescription);

    return pc;
  }

  var rtc_conns = new HashTable();

  var signal_conn = io.connect('http://localhost');
  signal_conn.on('connect', function () {
    signal_conn.on("heartbeat", function (data) {
      signal_conn.emit("ackheartbeat");
    });
    signal_conn.on("ackheartbeat", function (data) {
      console.log("receive ack heartbeat");
    });
    signal_conn.on("useradd", function (data) {
      var rtc_conn = create_user_rtc_conn(data.name, signal_conn);
      rtc_conns.put(data.name, rtc_conn);
    });
    signal_conn.on("userremove", function (data) {
      rtc_conns.remove(data.name);
    });
    signal_conn.emit("connected", { user : curUserName});
    var heartbeatTask = setInterval(function () {
      signal_conn.emit("heartbeat");
    }, 5000);
    signal_conn.on('disconnect', function () {
      clearInterval(heartbeatTask);
      var users = rtc_conns.keys();
      users.forEach(function (e, i) {
        if (e) {
          var rtc_conn = rtc_conns.get(e);
          rtc_conn.close();
          var origRemoteView = document.getElementById(e + "_remoteView");
          if (origRemoteView) {
            origRemoteView.parentNode.removeChild(origRemoteView);
          }
        }
      });
      rtc_conns.clear();
    });
  });
});
*/



