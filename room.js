'use strict';

class Room {
    #users;
    #roomName;
    #myName;
    #ok;
    #$myself;
    #game;
    #active;
    #linkArgs;
    #key;

    constructor(myName, roomName, key) {
        this.#roomName = roomName;
        this.#myName = myName;
        this.#users = {};
        Person.removeAll();
        Server.query({ do: "enter", room: roomName, name: myName, key: key });
        this.#active = null;
    }

    enter() {
        $("#room").attr('title', `Room ${this.#roomName}`);
        $("body").addClass("logged-in");
        $(window).on('resize', () => {
            for (let i in this.#users)
                this.#users[i].adjustPos();
        });
        this.#ok = true;
    }

    exit() {
        $(window).off('resize');
        Server.query({ do: "exit" });
        for (let i in this.#users) {
            this.#users[i].remove();
            delete this.#users[i];
        }
        if (this.#game) 
            this.#game.leave();
        $("body").removeClass("logged-in");
        this.#ok = false;
    }

    chat(text) {
        Server.query({ do: 'send', msg: { at: "user", do: "chat", msg: `&raquo;${text}&laquo;` }});
    }

    async update(obj) {
        if (obj.at == 'room') {
            switch (obj.do) {
                case  'enter' :
                    if (obj.ok)
                        this.enter();
                    else
                        this.exit();
                    break;

                case 'add_user' :
                    let p = new Person(obj.id, obj.name, obj.color, obj.echo);
                    p.move(obj.x, obj.y);
                    p.status(obj.status);
                    this.#users[obj.id] = p;
                    break;

                case 'del_user' :
                    if (this.#users[obj.id]) {
                        this.#users[obj.id].remove();
                        delete this.#users[obj.id];
                    }
                    break;

                case 'active' :
                    this.#users[obj.id].setActive();
                    this.#active = obj.id;
                    break;

                case 'game_key' :
                    this.#key = obj.key;
                    this.setLink(`?user=${this.#myName}&room=${this.#roomName}&key=${obj.key}`);
                    break;

                case 'editor' :
                case 'game' :
                    Person.resetAll(); // Clean up the mess
                    if (this.#game) {
                        this.#game.leave();
                        this.#game = null;
                        this.setLink('');
                    }
                    if (obj.show) {
                        this.#game = obj.do == 'editor' ? new Editor() : new Siedler(this.#users);
                    }
                    break;

            }
        } else if (obj.at == 'user') {
            this.#users[obj.id].update(obj);
            
        } else if ((obj.at == 'game' || obj.at == 'editor') && this.#game) {
            await this.#game.update(obj);
        }
    }

    setLink(args) { 
        const link = window.location.origin + window.location.pathname + args;
        window.history.pushState({}, "", link);
    }

    isReady() { return this.#ok; }
    hasGame() { return this.#game != null; }
    getKey() { return this.#key; }

    videoCalls() {
        for (let id in this.#users)
            this.#users[id].videoCall();
    }
}