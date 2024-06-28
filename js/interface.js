'use strict';

class Interface {
    static isFullscreen() {
        return document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen;
    }

    #room;
    #scenarios;

    #leaveRoom() {
        if (this.#room) {
            this.#videoOn(false);
            this.#room.exit();
            this.#room = null;
            Server.setHandlers(null, async () => {});
            if (Interface.isFullscreen()) {
                document.exitFullscreen();
            }
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

    btnAbout() {
        const html = `<div class='icon hexagon'></div><h1>Thanks for stopping by!</h1>
            <p>This implementation of the base game and Seafarers extension of Catan by Klaus Teuber was programmed by Sam Lutzker in 2023/24, 
            for private, non-commercial use only.</p>
            <p>To view the rules, or a short overview of building prices click the options below.</p>`;

        dialog("CATAN to go", html, {
            "Close" : null, 
            "Prices" : () => dialog("Building Prices", $("#info").html(), null, null, 'wide'), 
            "Rules" : () => dialog("View Rules", "<p>Display the rules of the Catan base game, or the Seafarers extension?</p>", {
                "Base" : () => window.open('rules/rules_catan_base_2020.pdf'),
                "Seafarers" : () => window.open('rules/rules_catan_seafarers_2021.pdf'),
                "Close" : null
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
                "Cancel" : null
            }, null, 'wide');
        } else {
            leave();
        }
    }

    btnGame() {
        const start = () => {
            let html = "<div class='icon hexagon'></div><h1>Play Catan</h1><p>Play or edit one of the following scenarios, or create a new one:</p><select id='dlg_load_scenario'>";
            this.#scenarios.forEach((s) => html += `<option value='${s}'>${capital(s)}</option>`);
            html += '<option value="_new">New scenario...</option></select><hr width="70%" />';

            dialog("Start Game", html, {
                "Play" : () => $("#dlg_load_scenario").val() == '_new' ? Editor.start() : Siedler.start($("#dlg_load_scenario").val()),
                "Edit" : () => {
                    const scenario = $("#dlg_load_scenario").val();
                    dialog("Edit Scenario", `Do you want to open or delete ${capital(scenario)}?`, {
                        "Open" : () => Editor.start(scenario),
                        "Delete" : () => {
                            dialog("Delete", `Delete scenario ${scenario}. Are you sure?`, { "Yes" : () => Editor.delete(scenario), "No" : null }, null, "red");
                        },
                        "Cancel" : null
                    });
                },
                "Cancel" : null
            }, () => $("#dlg_load_scenario").on('change', () => $("#dlg_load_scenario").val() == '_new' ? closeDialog() : null));
        }

        if ($("body").hasClass('playing')) {
            dialog("Play", "Start new game? The current board will be lost.", { "Yes" : start, "No" : null }, null, "red");
        } else {
            start();
        }
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

        $("#logo, #btn_about").click(this.btnAbout.bind(this));
        $("#btn_game").click(this.btnGame.bind(this));
        $("#btn_exit").click(this.btnExit.bind(this));
        $("#form_enter").submit(this.formEnter.bind(this));
        $("#form_chat").submit(this.formChat.bind(this));
        $("#checkbox_video").change(this.checkboxVideo.bind(this));
        $("#checkbox_sounds").change(this.checkboxSounds.bind(this));
        $("#checkbox_fullscreen").change(this.checkboxFullscreen.bind(this));

        $("#main").on('mozfullscreenchange webkitfullscreenchange fullscreenchange', () => {
            $("#checkbox_fullscreen").prop('checked', Interface.isFullscreen() ? 'checked' : '');
        });

        if (!$("#main")[0].requestFullscreen) {
            $("#checkbox_fullscreen").prop('disabled','disabled');
        }

        if (user && room && key) {
            this.#enterRoom(user, room, key);
        } 
    }
}

