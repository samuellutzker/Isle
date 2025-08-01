'use strict';

// Server class: Static methods for WebSocket communication with the game server

class Server {
    static #url;                        // WebSocket URL
    static #socket;                     // WebSocket object
    static #message = async () => {};   // onMessage handler
    static #close = async () => {};     // onClose handler
    static #failed = [];                // Buffered queries during connection problem

    static setHandlers(message, close) {
        this.#message = message ?? this.#message;
        this.#close = close ?? this.#close;
    }

    // Keep connection alive
    static #reconnect = async () => {
        const reconnectInterval = 3;

        this.#socket = null;
        console.log('WebSocket connection lost. Reconnecting...');
        try {

            await this.#close();
            await this.connect(this.#url);

        } catch (error) {
            console.error('Attempt failed. Reason:', error, `Trying again in ${reconnectInterval}s...`);
            setTimeout(this.#reconnect, 1000 * reconnectInterval);
            this.#failed = [];
        }
    };

    // Main query routine. If query fails it is buffered for later retries upon reconnect.
    static query(params) {
        if (this.#socket) {
            this.#socket.send(JSON.stringify(params));
        }
        else {
            this.#failed.push(params);
            console.error('Server query unsuccessful: not connected.');
        }
    }

    // (Re-)establish connection and execute buffered (unsuccessful) queries
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
