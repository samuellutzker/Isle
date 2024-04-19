'use strict';

class Server {
    static #url;
    static #socket;
    static #message = async () => {};
    static #close = async () => {};
    static #failed = []; // buffered messages

    static setHandlers(message, close) {
        this.#message = message ?? this.#message;
        this.#close = close ?? this.#close;
    }

    static #reconnect = async () => {
        const reconnectInterval = 3;

        this.#socket = null;
        console.log('WebSocket connection lost. Reconnecting...');
        try {

            await this.#close();
            await this.connect(this.#url);

        } catch (error) {
            console.error('Attempt failed. Reason:', error, `Trying again in ${reconnectInterval}s...`);
            setTimeout(this.#reconnect, 1000*reconnectInterval);
            this.#failed = [];
        }
    };


    static query(params) {
        if (this.#socket) {
            this.#socket.send(JSON.stringify(params));
        }
        else {
            this.#failed.push(params);
            console.error('Server query unsuccessful: not connected.');
        }
    }

    static async connect(url) {
        this.#url = url;

        return new Promise((resolve, reject) => {
            this.#socket = new WebSocket(this.#url);
            this.#socket.onopen = async () => {
                // console.log(`open event. buffered ${Server.#failed.length} queries.`);
    
                this.#socket.onclose = this.#reconnect;

                Server.#failed.forEach((q) => Server.query(q));
                Server.#failed = [];
                resolve();
            }
            this.#socket.onerror = reject;
            this.#socket.onmessage = async (event) => {
                try {
                    await this.#message($.parseJSON(event.data));
                } catch (error) {
                    console.error('Error in onmessage handler:', error);
                }
            };
        });
    }
}