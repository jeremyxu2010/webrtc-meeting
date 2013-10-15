/*global
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
  location:true,
  alert:true
  */
//the require library is configuring paths
require.config({
  paths: {
    //tries to load jQuery from Google's CDN first and falls back
    //to load locally
    "jquery": [
      /*"http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min",*/
      "libs/jquery/jquery.min"
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
  var iceServers = [/*{
      "url": "stun:stun.l.google.com:19302?transport=tcp"
    },{
      "url": "stun:119.145.0.153:80?transport=tcp",
      "username": "test",
      "credential": "123456"
    },*/{
      "url": "turn:119.145.0.153:80?transport=tcp",
      "username": "test",
      "credential": "123456"
    }];

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
    "audio": true
  }, function (stream) {
    var selfVideoView = $('#selfVideoView')[0];
    selfVideoView.src = URL.createObjectURL(stream);
    $('#selfVideoLabel').html('ME');

    var iosocketurl = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '');
    var socket = io.connect(iosocketurl);

    var pcs = new HashTable();

    var bandwidth = {
      "audio" : 0,
      "video": 56,
      "data": 0
    };

    function setBandwidth(sdp) {
      if (!bandwidth) {
        return;
      }

      // remove existing bandwidth lines
      sdp = sdp.replace(/b=AS([^\r\n]+\r\n)/g, '');

      if (bandwidth.audio) {
        sdp = sdp.replace(/a=mid:audio\r\n/g, 'a=mid:audio\r\nb=AS:' + bandwidth.audio + '\r\n');
      }

      if (bandwidth.video) {
        sdp = sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:' + bandwidth.video + '\r\n');
      }

      if (bandwidth.data) {
        sdp = sdp.replace(/a=mid:data\r\n/g, 'a=mid:data\r\nb=AS:' + bandwidth.data + '\r\n');
      }

      return sdp;
    }

    var framerate = {
      "minptime" : 5,
      "maxptime" : 255
    };

    function setFramerate(sdp) {
      sdp = sdp.replace('a=fmtp:111 minptime=10', 'a=fmtp:111 minptime=' + (framerate.minptime || 10));
      sdp = sdp.replace('a=maxptime:60', 'a=maxptime:' + (framerate.maxptime || 60));
      return sdp;
    }

    function setBitrate(sdp) {
        //sdp = sdp.replace( /a=mid:video\r\n/g , 'a=mid:video\r\na=rtpmap:120 VP8/90000\r\na=fmtp:120 x-google-min-bitrate=' + (bitrate || 10) + '\r\n');
        return sdp;
    }

    function getInteropSDP(sdp) {
      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
        extractedChars = '';

      function getChars() {
        extractedChars += chars[parseInt(Math.random() * 40)] || '';
        if (extractedChars.length < 40)
          getChars();

        return extractedChars;
      }

      // for audio-only streaming: multiple-crypto lines are not allowed
      /*
      if (options.onAnswerSDP)
        sdp = sdp.replace( /(a=crypto:0 AES_CM_128_HMAC_SHA1_32)(.*?)(\r\n)/g , '');
      */

      var inline = getChars() + '\r\n' + (extractedChars = '');
      sdp = sdp.indexOf('a=crypto') == -1 ? sdp.replace( /c=IN/g ,
        'a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:' + inline +
            'c=IN') : sdp;

      return sdp;
    }

    function serializeSdp(sdp) {
      //if (moz) return sdp;
      sdp = setBandwidth(sdp);
      sdp = setFramerate(sdp);
      sdp = setBitrate(sdp);
      sdp = getInteropSDP(sdp);
      return sdp;
    }

    function offer(pc, user) {
      pc.createOffer(function (description) {
        description.sdp = serializeSdp(description.sdp);
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
      $('#remoteViews').append('<div id="' + user + '_remoteView" class="remoteViewCls"><video muted=true autoplay=true/><div>' + user.toUpperCase() + '</div></div>');
      return $('#remoteViews #' + user + '_remoteView video')[0];
    }

    function removeRemoteView(user) {
      $('#remoteViews #' + user + '_remoteView').remove();
    }

    function create_rtc_pc(user) {

      var pc = new RTCPeerConnection({"iceServers": iceServers });

      pc.addStream(stream);

      pc.onicecandidate = function (event) {
        if (!event || !event.candidate) {
          return;
        }
        var candidate = new RTCIceCandidate(event.candidate);
        console.log(candidate);
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
              description.sdp = serializeSdp(description.sdp);
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
require(['jquery', 'socketio', 'hashtable', /*'jquery.bootstrap', 'css!libs/bootstrap/dist/css/bootstrap', */'less!../stylesheets/index'], function ($, io, HashTable) {
  start($, io, HashTable);
});
