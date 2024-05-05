'use strict';

class Interface {

    #room;
    #scenarios;

    #leaveRoom() {
        if (this.#room) {
            this.#videoOn(false);
            this.#room.exit();
            this.#room = null;
            Server.setHandlers(null, async () => {});
        }
    }

    #enterRoom(myName, roomName, key) {
        key = key ?? (this.#room ? this.#room.getKey() : null);
        this.#leaveRoom();
        if (myName && roomName) {
            this.#room = new Room(myName, roomName, key ?? null);
            Server.setHandlers(null, async () => this.#enterRoom(myName, roomName, key));
        }
    }

    #hideMenu() {
        $("#checkbox_controls").prop("checked", false);
    }

    async #videoOn(on) {
        if (on) {
            await VideoConn.start();
            this.#room.videoCalls();
        } else {
            VideoConn.stop(); // hang up
        }
    }

    dlgAbout() {
        const html = `<h1>Thanks for stopping by!</h1>
            <p>This implementation of the base game and Seafarers extension of Catan by Klaus Teuber was programmed by Sam Lutzker in 2023/24, 
            for private, non-commercial use only.</p>
            <p>To view the rules, or a short overview of building prices click the options below.</p>`;

        dialog("CATAN to go", html, {
            "Close" : null, 
            "Prices" : () => dialog("Building Prices", $("#info").html(), null, null, 'wide'), 
            "Rules" : () => dialog("Open Rules", "<p>Display the rules of Catan base game, or the seafarer extension?</p>", {
                    "Cancel" : null,
                    "Base" : () => window.open('rules/rules_catan_base_2020.pdf'),
                    "Seafarers" : () => window.open('rules/rules_catan_seafarers_2021.pdf')
                })
        }, null, 'wide');
    }

    btnExit() {
        var leave = () => {
            this.#leaveRoom();
            $("#checkbox_video").prop("checked", false);
            this.#hideMenu();
        };

        if (this.#room && this.#room.hasGame()) {
            const html = `<h1>Going so soon?</h1>
                <p>Click pause if you want to continue the game later.
                You may resume playing with the address in the navigation bar and clipboard.</p>`;

            dialog("Leave game", html, { 
                "Pause" : () => { 
                    if (navigator.clipboard) {
                        navigator.clipboard.writeText(window.location.href); 
                    }
                    leave(); 
                }, 
                "Stop" : Siedler.stop,
                "Cancel" : null }, null, 'wide');
        } else {
            leave();
        }
    }

    btnGame() {
        const start = () => {
            let html = "<h1>Play or edit one of the following scenarios:</h1><select id='dlg_load_scenario'>";
            this.#scenarios.forEach((s) => html += `<option value='${s}'>${capital(s)}</option>`);
            html += '</select>';

            dialog("Start Game", html, {
                "Play" : () => Siedler.start($("#dlg_load_scenario").val()),
                "Edit" : () => {
                    const scenario = $("#dlg_load_scenario").val();
                    dialog("Editor", `Do you want to open or delete ${capital(scenario)}, or create a new scenario?`, {
                        "Open" : () => Editor.start(scenario),
                        "Delete" : () => {
                            dialog("Editor", `Are you sure?`, { "Yes" : () => Editor.delete(scenario), "No" : null });
                        },
                        "New" : Editor.start
                    });
                },
                "Cancel" : null
            });
        }

        if ($("body").hasClass('playing')) {
            dialog("Play", "Start new game? The current board will be lost.", { "Yes" : start, "No" : null }, null, "red");
        } else {
            start();
        }
    }

    addScenario(name) {
        this.#scenarios.push(name);
    }

    async checkboxVideo() {
        const state = $("#checkbox_video").is(":checked");
        await this.#videoOn(state);
    }

    checkboxFullscreen() {
        const state = $("#checkbox_fullscreen").is(":checked");
        state ? $("#main")[0].requestFullscreen() : document.exitFullscreen();
    }

    checkboxSounds() {
        Siedler.audio($("#checkbox_sounds").is(":checked"));
    }

    formEnter(e) {
        e.preventDefault();
        this.#enterRoom($("#input_name_user").val(), $("#input_name_room").val());
    }

    formChat(e) {
        e.preventDefault();
        let target = !$("body").hasClass('playing') && Person.selected && Person.selected != Person.myself ? Person.selected : this.#room;
        target.chat($("#input_chat").val());
        $("#input_chat").val('');
    }

    async onMessage(obj) {
        if (obj.alert) {
            dialog("Error", obj.alert, null, null, "red");
        } else if (obj.dialog) {
            let options = null;
            if (obj.options) {
                options = {};
                for (let btn in obj.options) {
                    options[btn] = obj.options[btn] ? () => Server.query(obj.options[btn]) : null;
                }
            }
            dialog(obj.title ?? "Catan", obj.dialog, options, null, obj.style ?? null);
        } else if (obj.scenarios) {
            this.#scenarios = obj.scenarios;
        } else if (this.#room) {
            await this.#room.update(obj);
        }
    }

    constructor(scenarios, user, room, key) {
        this.#scenarios = scenarios;

        Server.setHandlers(this.onMessage.bind(this));

        $("#room input").click((e) => {
            if(['button', 'checkbox', 'submit'].includes(e.target.type))
                this.#hideMenu();
        });

        $("#logo, #btn_about").click(this.dlgAbout.bind(this));
        $("#btn_game").click(this.btnGame.bind(this));
        $("#btn_exit").click(this.btnExit.bind(this));
        $("#form_enter").submit(this.formEnter.bind(this));
        $("#form_chat").submit(this.formChat.bind(this));
        $("#checkbox_video").change(this.checkboxVideo.bind(this));
        $("#checkbox_sounds").change(this.checkboxSounds.bind(this));
        $("#checkbox_fullscreen").change(this.checkboxFullscreen.bind(this));

        $("#main").on('mozfullscreenchange webkitfullscreenchange fullscreenchange', () => {
            const fullscreen = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen;
            $("#checkbox_fullscreen").prop('checked', fullscreen ? 'checked' : '');
        });

        if (!$("#main")[0].requestFullscreen) {
            $("#checkbox_fullscreen").prop('disabled','disabled');
        }

        if (user && room && key) {
            this.#enterRoom(user, room, key);
        } 
    }
}

