/*global document:true, navigator:true, URL:true, io:true, curUserName:true, HashTable:true*/

var localstream = null;
var selfView = document.getElementById("selfView");

navigator.getUserMedia = (navigator.getUserMedia ||
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia ||
                       navigator.msGetUserMedia);

// get the local stream, show it in the local video element and send it
navigator.getUserMedia({
  "video": true
}, function (stream) {
  localstream = stream;
  selfView.src = URL.createObjectURL(localstream);
});

var user_rtcconns = new HashTable();

var ctl_conn = io.connect('http://localhost');
ctl_conn.on('connect', function () {
  ctl_conn.on("heartbeat", function (data) {
    ctl_conn.emit("ackheartbeat", {});
  });
  ctl_conn.on("ackheartbeat", function (data) {
    console.log("receive ack heartbeat");
  });
  ctl_conn.on("useradd", function (data) {
    user_rtcconns.put(data.name, {});
  });
  ctl_conn.on("userremove", function (data) {
    user_rtcconns.remove(data.name);
  });
  ctl_conn.emit("connected", { user : curUserName});
  var heartbeatTask = setInterval(function () {
    ctl_conn.emit("heartbeat", {});
  }, 5000);
  ctl_conn.on('disconnect', function () {
    clearInterval(heartbeatTask);
    var users = user_rtcconns.keys();
    users.forEach(function (e, i) {
      if (e) {
        var user_rtcconn = user_rtcconns.get(e);
      }
    });
    user_rtcconns.clear();
  });
});

/*

function createConnectionForUser (username) {
  function createSignalingChannel(username) {
    return null;
  }

  var signalingChannel = createSignalingChannel();
  var pc;
  var configuration = {
    "iceServers": [{
      "url": "stun:stun.ekiga.net:3478"
    }, {
      "url": "turn:test@74.117.58.198:3478",
      "credential": "123456"
    }]
  };


  pc = new RTCPeerConnection(configuration);

  function gotDescription(desc) {
    pc.setLocalDescription(desc);
    signalingChannel.send(JSON.stringify({
      "type": "sdp",
      "data": desc
    }));
  }

  function gotAnswerDescription(desc) {
    pc.setLocalDescription(desc);
    signalingChannel.send(JSON.stringify({
      "type": "answersdp",
      "data": desc
    }));
  }

  // once remote stream arrives, show it in the remote video element
  pc.onaddstream = function (evt) {
    remoteView.src = URL.createObjectURL(evt.stream);
  };


  // send any ice candidates to the other peer
  pc.onicecandidate = function (evt) {
    signalingChannel.send(JSON.stringify({
      "type": "candidate",
      "data": evt.candidate
    }));
  };

  signalingChannel.onmessage = function (evt) {
    var signal = JSON.parse(evt.data);
    switch (signal.type) {
    case "candidate":
      pc.addIceCandidate(new RTCIceCandidate(signal.data));
      break;
    case "sdp":
      pc.setRemoteDescription(new RTCSessionDescription(signal.data));
      pc.createAnswer(pc.remoteDescription, gotAnswerDescription);
      break;
    case "answersdp":
      pc.setRemoteDescription(new RTCSessionDescription(signal.data));
      break;
    }
  };

  pc.addStream(localstream);
  pc.createOffer(gotDescription);
}
*/
