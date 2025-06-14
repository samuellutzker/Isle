'use strict';

// Person class: Each instance takes care of one logged on user

const PERSON_W = 0.1;
const PERSON_H = 0.15;
const PERSON_ASPECT = 1.6;

class Person {
    static selected;    // Currently selected user (for direct messaging)
    static myself;      // Contains the user's own instance

    static select(person) {
        if (this.selected) {
            $(".person.selected").removeClass('selected');
            $("body").removeClass("person-selected");
            this.selected = null;
        }

        if (person) {
            $(".person.selected").removeClass('selected');
            $("body").addClass("person-selected");
            Person.selected = person;
            person.$el.addClass('selected');
        }
    }

    static removeAll() {
        $(".person").remove();
    }

    static resetAll() {
        $(".stuff, .person .container").html('');
        $(".person.active").removeClass("active");
        $(".person .bubble").remove();
        Person.select();
    }

    static #screen() {
        let $c = $("#main");
        return { w: $c.width(), h: $(document).height() - $("#main").position().top };
    }

    #id;
    #name;
    #domId;
    #videoOn;   // VideoConn is active
    #videoConn; // VideoConn connection object
    #x;
    #y;
    #isMe;      // Is this the user himself?

    $el;        // jQuery element

    constructor(id, name, color, isMe) {
        this.#id = id;
        this.#name = name;
        this.#domId = 'user_'+id;
        this.#isMe = isMe;
        this.#show();
        this.#setColor(color);
        if (VideoConn.on) {
            VideoConn.signal();
        }
        if (isMe) {
            Person.myself = this;
            makeMovable(this.$el, (pos) => {
                let scr = Person.#screen();
                Server.query({ do: 'move', x: pos.x / scr.w, y: pos.y / scr.h });
            });

            let emojis = '';
            for (let i=0x1F601; i <= 0x1F64F; ++i) {
                emojis += `<span>&#${i};</span>`;
            }

            this.$el
                .find(".halo").append(`<div class='emojiselect'>${emojis}</div>`)
                .find(".face").click((e) => {
                    if (this.#videoOn)
                        return;
                    $(".emojiselect").show();
                    const f = () => {
                        $(".emojiselect").hide();
                        $(window).off('click', f);
                    };
                    e.stopPropagation();
                    $(window).on('click', f);
                }).end().find(".emojiselect").click(function (e) {
                    if (e.target != this)
                        Server.query({ do: 'status', msg: $(e.target).html() });
                });
        }
    }

    // Handle messages from the server
    update(obj) {
        switch (obj.do) {
            case 'rtc' :
                if (obj.signal !== undefined) {
                    this.#videoOn = obj.signal;
                    this.#videoOn ? this.$el.addClass('signal') : this.$el.removeClass('signal');
                }
                else {
                    this.#connectVideo();
                    this.#videoConn.receive(obj.msg);
                }
                break;

            case 'color' :
                this.#setColor(obj.color);
                break;

            case 'chat' :
                this.$el.find(".bubble").remove().end()
                        .append(`<span class='bubble'>${obj.type ? '['+this.#escape(obj.type)+'] ' : ''} &raquo;${this.#escape(obj.msg)}&laquo;</span>`);
                break;

            case 'rename' :
                this.#name = obj.name;
                this.$el.find(".nametag").html(this.#name).end()
                        .find(".face, .nametag").attr('data-initial', this.#name.charAt(0));
                break;

            case 'move' :
                this.move(obj.x, obj.y);
                break;

            case 'status' :
                this.status(obj.msg);
                break;
        }
    }

    #escape(str) {
        return new Option(str).innerHTML;
    }

    #show() {
        this.$el = $("<div class='person'></div>")
            .prop('id', this.#domId)
            .html(`
                <div class='halo'>
                    <div class='face'></div>
                </div>
                <div class='body'>
                    <div class='nametag'>${this.#name}</div>
                    <div class='container'></div>
                </div>
                <div class='stuff'></div>`)
            .find('.face, .nametag').attr('data-initial', this.#name.charAt(0)).end()
            .appendTo("div#main");

        this.adjustPos();
        if (this.#isMe) {
            this.$el.addClass('myself');
        } else {
            this.ping();
        }

        this.$el.on('click', (e) => {
            if (!$(e.target).hasClass('halo')) {
                return;
            }
            Person.select(Person.selected == this ? null : this);
        });
    }

    #setColor(color) {
        const whiteThreshold = 0.75;
        const textColor = (Math.min.apply(null, Scene.nameToRgba(color)) > whiteThreshold) ? "black" : "white";
        this.$el.css('--player-color', color).css("--player-text-color", textColor);
    }

    adjustPos() {
        const f = Math.floor;
        const scr = Person.#screen();
        const dim = Math.min(f(scr.w * PERSON_W), f(scr.h * PERSON_H))
        this.$el
            .css('font-size', Math.round(dim * 0.15)+'px')
            .width(PERSON_ASPECT * dim).height(dim)
            .find('.halo').width(dim).height(dim).end()
            .css('left', f(scr.w * this.#x)).css('top', f(scr.h * this.#y));

        this.#x > 0.5 ? this.$el.addClass('right') : this.$el.removeClass('right');
        this.#y > 0.5 ? this.$el.addClass('bottom') : this.$el.removeClass('bottom');
    }

    chat(text) {
        if (this.#videoConn !== undefined && this.#videoConn.active)
            this.#videoConn.chat(text);
        else
            Server.query({ do: 'send', to: this.#id, msg: { at: "user", do: "chat", msg: text, type: "PM" }});
    }

    setActive() {
        $(".person.active").removeClass("active");
        this.$el.addClass("active");
    }

    move(x, y) {
        this.#x = x;
        this.#y = y;
        this.adjustPos();
    }

    status(msg) {
        this.$el.find(".face").attr("data-status", msg);
    }

    ping() {
        Siedler.sound('ping');
    }

    remove() {
        if (this.#videoConn !== undefined && this.#videoConn.active) {
            this.#videoConn.hangup();
        }
        if (this.#isMe) {
            Person.myself = null;
        }
        this.$el.remove();
    }

    videoCall() {
        if (this.#videoOn && !this.#isMe) {
            this.#connectVideo();
            this.#videoConn.call();
        }
    }

    getId() { return this.#id; }
    getName() { return this.#name; }

    #connectVideo() {
        if (this.#videoConn === undefined) {
            this.#videoConn = new VideoConn(this.#id, this.$el.find(".face"), (msg) => this.update({ do: "chat", msg: msg, type: "DM" }));
        }
    }
}