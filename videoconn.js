'use strict';

class VideoConn {

    static on = 0;
    static #all = {};
    static #localStream;
    static #localVideo;

    static #mediaConstraints = {
        video: { 
            mandatory: { 
                maxWidth: 320, 
                maxHeight: 240 
            }
        },
        audio: true
    };

    static #sdpConstraints = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
    };

    static #pcConfig = {
        iceServers: [
            {
               urls: "stun:stun.relay.metered.ca:80",
            },
            {
                urls: "turn:a.relay.metered.ca:80",
                username: "2dcaf246d218ed003ef708e3",
                credential: "hM0+4VNmhi2bTQmK",
            },
            {
                urls: "turn:a.relay.metered.ca:80?transport=tcp",
                username: "2dcaf246d218ed003ef708e3",
                credential: "hM0+4VNmhi2bTQmK",
            },
            {
                urls: "turn:a.relay.metered.ca:443",
                username: "2dcaf246d218ed003ef708e3",
                credential: "hM0+4VNmhi2bTQmK",
            },
            {
                urls: "turn:a.relay.metered.ca:443?transport=tcp",
                username: "2dcaf246d218ed003ef708e3",
                credential: "hM0+4VNmhi2bTQmK",
            },
        ],
    };

    static signal() {
        Server.query({ do: 'send', msg: { at: "user", do: "rtc", signal: this.on }});
    }

    static async start() {
        $(".myself").addClass("video").find(".face").append("<video id='myvid' style='transform: scaleX(-1)' playsinline autoplay muted></video>");

        VideoConn.#localVideo = $("video#myvid")[0];

        try {
            var stream = await navigator.mediaDevices.getUserMedia(VideoConn.#mediaConstraints);
            this.on = 1;
            VideoConn.#localStream = stream;
            VideoConn.#localVideo.srcObject = stream;
            this.signal();
        } catch (e) {
            console.error('getUserMedia() error: ' + e);
        }
    }

    static stop() {
        if (VideoConn.#localVideo && VideoConn.#localStream) {
            this.on = 0;
            $("#myvid").parent().removeClass('video').end().remove();
            VideoConn.#localVideo.srcObject = null;
            VideoConn.#localStream.getTracks().forEach((track) => { 
                track.stop(); 
                this.#localStream.removeTrack(track); 
            });
            VideoConn.#localStream = VideoConn.#localVideo = null;

            this.signal();
            for (let id in VideoConn.#all) {
                VideoConn.#all[id].hangup();
            }
        }
    }

    active = false;

    #id;
    #pc; // RTCPeerConnection
    #dc; // RTCDataChannel
    #remoteStream;
    #remoteVideo;
    #dataCallback;
    #isInitiator = false;

    constructor(id, videoTagContainer, dataCallback) {
        let $video = $("<video id='video_user_"+id+"' playsinline autoplay></video>").appendTo(videoTagContainer);

        this.#id = id;
        this.#remoteVideo = $video[0];
        this.#dataCallback = dataCallback;
    }

    call() {
        this.#createPc();
        this.#pc.onnegotiationneeded = async () => {
            await this.#pc.setLocalDescription(await this.#pc.createOffer());
            this.#send(this.#pc.localDescription);
        }
        this.#isInitiator = true;
    }

    hangup() {
        this.#send({ type: 'bye' });
        this.#setActive(false);
    }

    chat(msg) {
        if (this.#dc) {
            this.#dc.send(msg);
        }
    }

    async receive(msgs) {

        let msg = JSON.parse(msgs);

        switch (msg.type) {
            case 'offer' :
                this.#createPc();

                await this.#pc.setRemoteDescription(new RTCSessionDescription(msg));
                await this.#pc.setLocalDescription(await this.#pc.createAnswer());

                this.#send(this.#pc.localDescription);
                // console.log('VideoConn: received offer. sent answer.')

                break;

            case 'answer' :
                // console.log('VideoConn: received answer. setting remote SDP.')
                await this.#pc.setRemoteDescription(new RTCSessionDescription(msg))
                break;

            case 'candidate' :
                // console.log('VideoConn: received ICE candidate.')
                await this.#pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                break;

            case 'restart' :
                console.log('VideoConn: received restart.');
                this.#setActive(false);
                if (!this.#isInitiator)
                    this.call();
                else
                    this.#isInitiator = false;
                break;

            case 'bye' :
                // console.log('VideoConn: received bye.');
                this.#setActive(false);
                break;

            default :
                console.error('VideoConn: undefined message type received.');
                break;
        }
    }


    #createPc() {
        var pc = new RTCPeerConnection(VideoConn.#pcConfig);
        pc.onicecandidate               = this.#iceCandidate.bind(this);
        pc.ontrack                      = this.#trackAdded.bind(this);
        pc.oniceconnectionstatechange   = this.#connectionState.bind(this);
        pc.ondatachannel                = this.#dataChannel.bind(this);
        VideoConn.#localStream.getTracks()
            .forEach((track) => pc.addTrack(track, VideoConn.#localStream));

        this.#dc = pc.createDataChannel('chat');
        this.#dc.onmessage              = this.#messageReceived.bind(this);
        this.#pc = pc;
    }

    #iceCandidate(event) {
        if (event.candidate) {
            this.#send({
              type: 'candidate',
              candidate: event.candidate
            });
        }
    }

    #send(msg) {
        Server.query({ do: 'send', to: this.#id, msg: { at: "user", do: "rtc", msg: JSON.stringify(msg) }});
    }

    #trackAdded(event) {
        this.#remoteVideo.srcObject = this.#remoteStream = event.streams[0];
        this.#setActive(true);
    }

    // activate / deactivate video connection
    #setActive(state) {
        this.active = state;
        if (state) {
            VideoConn.#all[this.#id] = this;
            $(this.#remoteVideo).parent().addClass('video'); // container class gets marked as video active
        }
        else {
            delete VideoConn.#all[this.#id];

            if (this.#remoteStream) {
                this.#remoteStream.getTracks().forEach((track) => { 
                    track.stop(); 
                    this.#remoteStream.removeTrack(track); 
                });
                this.#remoteStream = null;
            }
            if (this.#remoteVideo) {
                this.#remoteVideo.srcObject = null;
                $(this.#remoteVideo).parent().removeClass('video'); // container class unmarked
            }
            this.#pc.close();
        }
    }

    // Improved iceConnectionState handling (thanks @ChatGPT)
    #reconnect() {
        console.log(`VideoConn: Reconnecting to ${this.#id}`);
        this.#setActive(false);

        // Close the existing RTCPeerConnection
        if (this.#pc) {
            this.#pc.close();
        }

        this.#createPc();
        this.#send({ type: 'restart' });
    }

    #connectionState(event) {
        const reconnectTimeout = 3;

        console.log(`VideoConn: ICE Connection State - ${this.#pc.iceConnectionState}`);

        switch (this.#pc.iceConnectionState) {
            case "failed":
            case "disconnected":
                console.error(`VideoConn: Connection problem with user ${this.#id}. Reattempting in ${reconnectTimeout}s`);
                setTimeout(this.#reconnect.bind(this), reconnectTimeout * 1000);
                break;
            case "closed":
                console.error(`VideoConn: Connection closed with user ${this.#id}. Reconnecting.`);
                this.#reconnect();
                break;
            default:
                // Handle other states as needed
                break;
        }
    }

    #dataChannel(event) {
        this.#dc = event.channel;
        this.#dc.onopen = (e) => { 
            console.log('VideoConn: data channel open.'); 
        };
    }

    #messageReceived(event) {
        if (this.#dataCallback)
            this.#dataCallback(event.data);
    }
}