'use strict';

// Siedler class: Responsible for the game interface. Creates an instance of class Scene for graphics.

class Siedler {
    static isSoundOn = true;
    static sounds = {};
    static terrains = [ 'water', 'mountains', 'hills', 'forest', 'pasture', 'fields', 'desert', 'river' ]; 
    static resources = [ 'lumber', 'brick', 'wool', 'grain', 'ore' ];

    static audioPreload(audioFiles) {
        audioFiles.forEach((f) => this.sounds[f] = new Audio(`sounds/${f}.mp3`));
    }

    static start(scenario) {
        Server.query({ do: 'new_game', scenario: scenario, debug: DEBUG_AUTH });
    }

    static stop() {
        Server.query({ do: 'quit_game' });
    }

    static audio(on) {
        this.isSoundOn = on;
    }

    static sound(event) {
        if (event in this.sounds && this.isSoundOn)
            this.sounds[event].play();
    }

    isRunning;
    isRobberMode;
    scene;
    canvas;
    players; 	// id -> class Person
    activeId; 	// id of active player
    storage; 	// resources in storage
    storageDlg; // current setting in resources dialog
    idx2id; 	// player index -> player id

    constructor(players) {
        $("body").addClass("playing");
        $("<canvas id='siedler_board'></canvas>").prependTo("#main");
        this.players = players;
        const $board = $("#siedler_board");
        this.canvas = $board[0];
        this.scene = new Scene(this.canvas);
    }

    // Handle message from the server
    async update(obj) {
        if (obj.description !== undefined) {
            message(obj.do == 'await', obj.description);
        }

        const replace = (className, html, player) => {
            const $info = player ? player.$el : Person.myself.$el;
            const $thing = $info.find("."+className);
            if ($thing.length > 0) {
                $thing.css('visibility', 'hidden').html(html).css('visibility', '');
            } else {
                $info.find(".container").append(`<div class='${className}'>${html}</div`);
            }
        }

        let html = '';
        let sound = obj.do;

        if (obj.do == 'await') {

            switch (obj.expected) {

                case 'dice' :
                    Person.select(Person.myself);
                    replace('options', `<button title='Roll dice' onclick="Server.query({ do: 'game', what: { action: 'dice' }})">&#x1F3B2;</button>`);
                    sound = 'ping';
                    break;

                case 'exchange' :
                    this.storageManager(obj.setup ?? null, obj.description);
                    break;

                case 'robber' :
                    this.moveRobber(true);
                    break;

                case 'point' :
                    this.selectPlayer(obj.clickables, obj.description);
                    break;

                case 'choose' :
                    this.chooseResource();
                    break;

                case 'build' :
                    this.freeBuild(true);
                    this.moveRobber(false);
                    break;

                default:
                    this.freeBuild(false);
                    this.moveRobber(false);
                    html = `
                    <button title='Development cards' onclick="Server.query({ do: 'game', what: { action: 'card', get: true }});">&#127183;</button>
                    <button title='Trade' onclick="Server.query({ do: 'game', what: { action: 'trade' }});">&#128176;</button>
                    <button title='Finish' onclick="Server.query({ do: 'game', what: { action: 'finish' }}); Person.select();">&#x2713;</button>`;
                    replace('options', html);
                    break;
            }

        } else switch (obj.do) {

            case 'exchange' :
                for (let res in obj.resources) {
                    const diff = obj.resources[res];
                    html += `<div class='icon ${res}' style='color: ${(diff >= 0 ? "green'>+" : "red'>") + diff}</div>`;
                }
                html = `<div class='popup'>${html}</div>`;
                const $el = this.players[obj.id].$el;
                if ($el.find(".banner").length > 0)
                    $el.find(".banner").append(html);
                else
                    $el.append(`<div class='banner'>${html}</div>`);
                break;

            case 'active' :
                this.activeId = obj.id;
                this.players[obj.id].setActive();
                $(".options").html('');
                if (obj.id != Person.myself.getId()) {
                    this.scene.setClickables(null);
                }
                break;

            case 'win' :
                this.scene.setClickables(null);
                $(".options").html('');
                break;

            case 'dice' :
                this.throwDice(obj.result);
                break;

            case 'storage' :
                Siedler.resources.forEach((key) => {
                    html += `<div title='${capital(key)}' class='icon bg ${key}'><div>${obj.resources[key]}</div></div>`;
                });
                replace('storage', html)
                this.storage = obj.resources;
                break;

            case 'build' :
                this.scene.place(obj.what.structure, obj.x, obj.y, obj.what.color);
                sound = obj.what.structure;
                break;

            case 'discover' :
                this.scene.placeHex(obj.what, obj.x, obj.y)
                break;

            case 'remove' :
                this.scene.remove('structure', obj.x, obj.y);
                break;

            case 'cursor' :
                this.scene.setClickables(obj.clickables);
                break;

            case 'cards' :
                this.cardManager(obj.cards);
                break;

            case 'use_card' :
                this.players[obj.id].$el.find(".stuff").append(this.card(obj.card));
                break;

            case 'buy_card' :
                this.players[obj.id].$el
                    .find(".banner")
                    .append("<div class='popup'><div class='icon cards' style='color: green'>+1</div></div>");
                break;

            case 'info' :
                const infoPoints = {'resources' : 'Resources', 'cards' : 'Development cards', 'road_max' : 'Longest road', 'knights' : 'Knights'};
                Object.keys(infoPoints).forEach((str) => {
                    html += `<div title='${infoPoints[str]}' class='icon ${str} ${obj.info.style[str] ?? ''}'><div>${obj.info[str]}</div></div>`;
                });
                replace('info', html, this.players[obj.id]);
                break;

            case 'pirate' :
            case 'robber' :
                this.scene.remove(obj.do);
                this.scene.placeFigure(obj.do, obj.x, obj.y);
                break;

            case 'leave' :
                this.leave();
                break;

            case 'index' :
                this.idx2id = obj.idx2id;
                // sort players:
                for (let i in this.idx2id) {
                    if (this.idx2id[i] in this.players) {
                        $("#main").append(this.players[this.idx2id[i]].$el);
                    }
                }
                break;

            case 'load' :
                await this.run(obj.situation);
                break;

        }

        Siedler.sound(sound);
    }

    setupBoard(situation) {
        this.scene.setCenter(situation.width / 2, situation.height / 2);
        
        // Setup landscape
        for (let y in situation.board)
            for (let x in situation.board[y])
                if (situation.board[y][x])
                    this.scene.placeHex(situation.board[y][x], x, y);

        // Setup content
        for (let y in situation.edges)
            for (let x in situation.edges[y])
                if (situation.edges[y][x])
                    this.scene.place(situation.edges[y][x].structure, x, y, situation.edges[y][x].color);

        if (situation.robber)
            this.scene.placeFigure('robber', situation.robber[0], situation.robber[1]);
        if (situation.pirate)
            this.scene.placeFigure('pirate', situation.pirate[0], situation.pirate[1]);
    }

    // Main rendering loop
    async run(situation) {
        if (this.isRunning)
            return;

        this.isRunning = true;

        this.activeId = situation.active;
        if (this.players[this.activeId]) {
            this.players[this.activeId].setActive();
            this.throwDice(situation.dice);
            if (situation.card) {
                this.players[this.activeId].$el.find(".stuff").append(this.card(situation.card));
            }
        }

        await this.scene.start(this.onClick.bind(this));

        this.setupBoard(situation);

        const render = (now) => {
            if (!this.isRunning || !this.scene)
                return;
            this.scene.draw();
            requestAnimationFrame(render);		
        }
        requestAnimationFrame(render);
    }

    onClick(boardPos, scrPos) {
        if (this.isRobberMode) {

            Server.query({ do: 'game', what: {...boardPos, action: 'robber' } });

        } else {
            const options = this.scene.getOptions(boardPos.x, boardPos.y);
            if (options.length == 0)
                return;

            const w = $(window).width(), h = $(window).height();

            const setX =  scrPos.x > w / 2 ? ["right", w - scrPos.x] : ["left", scrPos.x];
            const setY =  scrPos.y < h / 2 ? ["bottom", h - scrPos.y] : ["top", scrPos.y];

            $("#point_action")
                .css("top","auto").css("bottom","auto").css("left","auto").css("right","auto")
                .css(...setX).css(...setY).html('').show();

            for (let i in options) {
                $("#point_action").append($(`#${options[i]}`).clone());
                $(`#point_action #${options[i]}`).on('click', () => Server.query({
                    do: 'game', what: {
                        ...boardPos, 
                        action: 'build',
                        structure: options[i]
                    } 
                }));
            }

            this.scene.mouseEvents(false);

            const closeMenu = (e) => {
                if ($(e.target).parents("#point_action").length === 0) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                window.removeEventListener('click', closeMenu, true);
                $("#point_action").hide();
                this.scene.mouseEvents(true);
                var event = $.Event('pointermove');
                event.clientX = e.clientX;
                event.clientY = e.clientY;
                $(window).trigger(event);
            };

            setTimeout(() => {
                window.addEventListener('click', closeMenu, true);
                $("#point_action").show();
            }, 100);
        }
    }

    leave() {
        if (this.scene)
            this.scene.clearEvents();
        this.scene = null;
        this.isRunning = false;
        $("#siedler_board").remove();
        $("body").removeClass("playing");
        message(false, '');
    }

    // Trading resources dialog
    storageManager(setup, description) {
        const empty = {lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0};

        const update = () => {
            const f = (x) => `<span style='color: ${x >= 0 ? "green'>+" : "red'>"}${x}</span>`;
            var store = this.storage;
            var change = this.storageDlg;
            $("#storageDlg > div").each(function () {
                let res = $(this).data('resource'); // icon bg lumber => lumber
                $(this).html(`
                    <div class='have'>${store[res]+change[res]}</div>
                    <button class='up'>+</button>
                    <div class='change'>${f(change[res])}</div>
                    <button class='down'>-</button>
                `);
                $(this).find("button.up").click(() => {
                    change[res] += 1;
                    update();
                }).end().find("button.down").click(() => {
                    if (store[res]+change[res] == 0) return;
                    change[res] -= 1;
                    update();
                });
            });
        };

        if (!setup)
            setup = empty;

        this.storageDlg = setup;

        if ($("#storage").length == 0) {
            let html = `<div>${description}</div><br /><div id='storageDlg'>`;
            Siedler.resources.forEach((key) => {
                html += `<div class='icon bg ${key}' data-resource='${key}'></div>`;
            });
            html += '</div>';
            dialog("Select resources", html, { 
                "OK": () => {
                    Server.query({ do: "game", what: { action: "exchange", resources: this.storageDlg }});
                },
                "Cancel": () => {
                    Server.query({ do: "game", what: { action: "exchange", resources: empty }});
                }
            }, update, "wide");
        }
    }

    throwDice(dice) {
        $(".dice, .card, .popup").remove();
        if (dice) {
            this.players[this.activeId].$el.find('.stuff').prepend(`<div class='dice one'></div><div class='dice two'></div>`);
            $(".dice").each(function (i) { 
                $(this).css('background-image', `url('images/dice/${dice[i]}.jpg')`);
            });
        }
    }

    // Make some players clickable
    selectPlayer(clickable, description) {
        message(true, description);
        Person.select();
        
        const f = (e) => {
            message();
            $("#curtain").remove();
            $(".clickable").off('click', f).removeClass('clickable');
            Server.query({ do: "game", what: { action: "point", player: e.data.idx }});
        }

        $("#main").append("<div id='curtain'></div>");

        for (let i in clickable) {
            this.players[this.idx2id[clickable[i]]].$el.addClass('clickable').on('click', { idx: clickable[i] }, f);
        }
    }

    // Return html code of a card for cardManager()
    card(card, index) {
        if (!card) {
            // Buy a card
            const buy = `
                Server.query({ do: "game", what: { action: "card", buy: true }}); 
                closeDialog(); 
                Server.query({ do: "game", what: { action: "card", get: true }});`;
            return `
                <div title='Buy card' class='card clickable' onclick='${buy}'>
                    <h1>+</h1>
                    <div style='font-size: 1em'>
                        <div class='icon wool'></div>
                        <div class='icon grain'></div>
                        <div class='icon ore'></div>
                    </div>
                </div>`;
            
        } else {
            // Display existing card
            return `
                <div title='${card.title}' class='card ${card.type}`
                + (index 
                    ? ` clickable' onclick='Server.query({ do: "game", what: { action: "card", use: ${index} }}); closeDialog();'>`
                    : `'>`)
                +
                `	<div class='pic' style='background-image:url("images/cards/${card.name}.jpg")'></div>
                    <div>${card.description}</div>
                </div>`;
        }
    }

    // Show all development cards
    cardManager(cards) {
        message();

        let html = `<div>Click to play or buy a card</div><br /><div id='card_dlg'>`;
        for (let i in cards) {
            html += this.card(cards[i], i);
        }
        html += this.card() + '</div>';

        dialog("Select card", html, {
            "Close" : null
        }, null, "wide");
    }

    chooseResource() {
        let html = `<div>Pick a resource</div><br /><div id='resource_dlg'>`;
        Siedler.resources.forEach((res) => {
            html += `
                <div class='icon bg ${res}'>
                    <div>
                        <input type='radio' id='select_${res}' name='select_resource' value='${res}' ${res == 'lumber' ? 'checked ' : ''}/>
                        <label for='select_${res}'></label>
                    </div>
                </div>`;
        });
        html += '</div>';
        dialog("Select resource", html, { "OK" : () => {
            Server.query({ do: "game", what: { action: "choose", resource: $('input[name="select_resource"]:checked').val() }});
        }}, null, "wide");
    }

    freeBuild(yes) {
        yes ? $("body").addClass('free-build') : $("body").removeClass('free-build');
    }

    moveRobber(yes) {
        yes ? this.scene.setCursor('robber', true) : this.scene.setCursor('structure', false, true);
        this.isRobberMode = yes;
    }
}