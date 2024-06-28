'use strict';

class VideoConn {

    static on = 0;
    static #all = {}; // userId -> class VideoConn
    static #localStream; // user media
    static #localVideo; // video tag

    // RTCPeerConnection configuration:
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
        if (this.on) return;
        this.on = 1;

        $(".myself")
            .addClass("video")
            .find(".face")
            .append("<video id='myvid' poster='images/loading.gif' style='transform: scaleX(-1)' playsinline autoplay muted></video>");

        VideoConn.#localVideo = $("video#myvid")[0];

        try {
            const stream = await navigator.mediaDevices.getUserMedia(VideoConn.#mediaConstraints);

            if (!this.on) return; // maybe video was turned off in the mean time
            VideoConn.#localStream = stream;
            VideoConn.#localVideo.srcObject = stream;
            this.signal();
        } catch (e) {
            console.error('getUserMedia() error: ' + e);
        }
    }

    static stop() {
        if (!this.on) return;
        this.on = 0;

        $(".myself").removeClass('video').find('video').remove();

        if (VideoConn.#localStream) {
            VideoConn.#localStream.getTracks().forEach((track) => { 
                track.stop(); 
                this.#localStream.removeTrack(track); 
            });
        }

        VideoConn.#localStream = VideoConn.#localVideo = null;

        this.signal();
        for (let id in VideoConn.#all) {
            VideoConn.#all[id].hangup();
        }
    }

    active;

    #id;
    #pc; // RTCPeerConnection
    #dc; // RTCDataChannel
    #ping; // RTCDataChannel
    #pingTimer; // for ping-pong clearTimeout
    #isAlive; // ping-pong ok
    #remoteStream;
    #remoteVideo;
    #dataCallback;
    #isInitiator; // is active part of reconnect process

    constructor(id, videoTagContainer, dataCallback) {
        const $video = $("<video id='video_user_"+id+"' poster='images/loading.gif' playsinline autoplay></video>").appendTo(videoTagContainer);

        this.active = false;
        this.#isInitiator = false;
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
        this.#dataChannel({ label: 'chat', channel: this.#pc.createDataChannel('chat') });
        this.#dataChannel({ label: 'ping', channel: this.#pc.createDataChannel('ping') });
        this.#isInitiator = true;
    }

    hangup() {
        this.#send({ type: 'bye' });
        this.#isInitiator = false;
        this.#setActive(false);
    }

    chat(msg) {
        if (this.#dc) {
            this.#dc.send(msg);
        }
    }

    async receive(msgs) {

        const msg = JSON.parse(msgs);

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
                // reconnect process: 
                // 1) initiator sends restart after removing his connection
                // 2) passive user sends restart after removing his connection
                // 3) initiator calls
                this.#setActive(false);
                if (this.#isInitiator)
                    this.call();
                else
                    this.#send({ type: 'restart' });
                break;

            case 'bye' :
                // console.log('VideoConn: received bye.');
                this.#isInitiator = false;
                this.#setActive(false);
                break;

            default :
                console.error('VideoConn: undefined message type received.');
                break;
        }
    }


    #heartbeat() {
        const heartbeatInterval = 500;

        if (this.#isInitiator) {
            if (!this.#pingTimer) {
                if (this.#ping.readyState == 'open') {
                    // console.log('ping');
                    this.#ping.send('ping');
                }
                this.#isAlive = false;
                this.#pingTimer = setTimeout(() => {
                    if (!this.#isAlive) {
                        console.log('VideoConn: Connection dead. Issuing restart.');
                        this.#reconnect();
                    }
                    else {
                        this.#pingTimer = null;
                        this.#heartbeat();
                    }
                }, heartbeatInterval);
            } else {
                this.#isAlive = true;
            }
        } else {
            // console.log('pong');
            this.#ping.send('ping');
        }
    }


    #createPc() {
        const pc = new RTCPeerConnection(VideoConn.#pcConfig);
        pc.onicecandidate               = this.#iceCandidate.bind(this);
        pc.ontrack                      = this.#trackAdded.bind(this);
        pc.oniceconnectionstatechange   = this.#connectionState.bind(this);
        pc.ondatachannel                = this.#dataChannel.bind(this);
        VideoConn.#localStream.getTracks()
            .forEach((track) => pc.addTrack(track, VideoConn.#localStream));

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
        if (state == this.active)
            return;

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
            if (this.#pingTimer) {
                clearTimeout(this.#pingTimer);
                this.#pingTimer = null; 
            }
        }
    }

    #reconnect() {
        this.#setActive(false);
        if (!this.#isInitiator) {
            console.log(`VideoConn: Passive mode, waiting for user ${this.#id} to initiate restart`);
            return;
        }
        console.log(`VideoConn: Initiating reconnect to ${this.#id}`);
        this.#send({ type: 'restart' });
    }

    #connectionState(event) {
        const reconnectTimeout = 2;

        console.log(`VideoConn: ICE Connection State - ${this.#pc.iceConnectionState}`);

        switch (this.#pc.iceConnectionState) {
            case "failed":
            case "disconnected":
                console.error(`VideoConn: Connection problem with user ${this.#id}. Reattempting in ${reconnectTimeout}s`);
                setTimeout(() => {
                    if (this.#pc.iceConnectionState != "connected") {
                        this.#reconnect();
                    }
                }, reconnectTimeout * 1000);
                break;

            case "closed":
                console.error(`VideoConn: Connection closed with user ${this.#id}. Reconnecting.`);
                this.#reconnect();
                break;

            default:
                break;
        }
    }

    #dataChannel(event) {
        switch (event.channel.label) {
            case 'chat' :
                this.#dc = event.channel;
                this.#dc.onmessage = this.#messageReceived.bind(this);
                break;

            case 'ping' :
                this.#ping = event.channel;        
                this.#ping.onmessage = this.#heartbeat.bind(this);
                this.#ping.onopen = () => {
                    if (this.#isInitiator) {
                        this.#heartbeat();
                    }
                };
                break;

            default:
                console.error(`VideoConn: data channel label ${event.channel.label} not found.`);
                return;

        }

        console.log(`VideoConn: data channel ${event.channel.label} open.`);
    }

    #messageReceived(event) {
        if (this.#dataCallback)
            this.#dataCallback(event.data);
    }
}