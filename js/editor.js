'use strict';

// Next:
// Set author, text

class Editor {
	static start(scenario) {
		Server.query({ do: 'new_editor', scenario: scenario });
	}

	static delete(scenario) {
		Server.query({ do: 'delete_scenario', scenario: scenario });
	}

	isRunning;
	isRobberMode;
	canvas;
	scene;
	hex; // Current element in detail
	selected; // Current element as string
	situation; // Scenario data
	shift; // The center of the board
	pileIdx; // The current pile (1,2,3,4,fixed)
	available; // Number of available tiles
	placed; // Number of placed tiles
	dlgSetting; // Memory of dialog box

	constructor() {
		$("body").addClass("playing");
		$("<canvas id='siedler_board'></canvas>").prependTo("#main");
		const $board = $("#siedler_board");
		this.canvas = $board[0];
		this.scene = new Scene(this.canvas);
		this.situation = {};
		this.waterCursor();

		this.isRobberMode = false;
		this.pileIdx = 0;
		this.available = null;
		this.placed = {};
		this.dlgSetting = {};
	}

	waterCursor() {
		this.scene.setCursor('hex', false, false);
		this.scene.setClickables([ 'water' ]);
		this.hex = { terrain: 'water' };
		this.selected = 'water';
		this.isRobberMode = false;
	}

	robberCursor() {
		if (this.isRobberMode) {
			this.waterCursor();
			return;
		}
		this.scene.remove('cursor');
		this.scene.setCursor('robber', true);
		this.isRobberMode = true;
	}

	setHex(hex, x, y, remove) {
		!remove ? this.scene.placeHex(hex, x, y) : this.scene.remove(['hex','cursor','chip','triangle'], x, y);

		const f = (i) => this.placed[i] = (this.placed[i] ?? 0) + (!remove ? 1 : -1);
		if (typeof hex === 'string')
			return f(hex.slice(2));
		if ('_rnumber' in hex)
			return f(hex._rnumber);
		if ('harbor' in hex && '_rtype' in hex.harbor)
			return f(hex.harbor._rtype);
	}

	async update(obj) {
		switch (obj.do) {
			case 'load' :
				await this.run(obj.situation);
				this.situation = obj.situation;
				this.setupButtons();
				break;

			case 'hex' :
				const placed = this.setHex(obj.hex, obj.x, obj.y);
				if (!this.isRobberMode && this.available !== null && placed >= this.available) {
					// used up all chips
					this.waterCursor();
				}
				break;

			case 'message' :
				message(false, obj.msg);
				break;

			case 'pile' :
				this.situation[obj.name] = obj.content;
				break;

			case 'delete' :
				this.setHex(obj.hex, obj.x, obj.y, true);
				break;

			case 'robber' :
			case 'pirate' :
				obj.remove ? this.scene.remove(obj.do, obj.x, obj.y) : this.scene.placeFigure(obj.do, obj.x, obj.y, true);
				break;

		}
	}

	onClick(boardPos, scrPos) {
		if (this.isRobberMode) {
			Server.query({
				do: 'editor', what: { action: 'robber', ...boardPos }
			});
			return;
		}
		Server.query({
			do: 'editor', what: {
				...boardPos, 
				action: 'board',
				hex: this.hex
			} 
		});
	}

	selectTerrainBtn() {
		const piles = 4;
		const resources = Siedler.resources.concat([ 'generic' ]);

		let html = `<p><label for='select_terrain'>Pick a terrain</label>
			<select id='select_terrain' onchange="if ($('#select_pile').val() == 'fixed') $('#select_pile').val('1');">`;
		Siedler.terrains.concat([ 'random', 'delete' ]).forEach((res) => html += `<option value='${res}'>${capital(res)}</option>`);
		html += '</select></p>';

		html += `<p id='available_tiles' style='font-weight: bold'></p>`;

		// checkbox options:
		html += `<p id='terrain_hidden'><span class='custom-label'>Hidden Pile (discover during game)</span>
			<input type="checkbox" onchange="if (this.checked) $('#checkbox_terrain_init').prop('checked', 'checked')" id="checkbox_terrain_hidden" />
			<label for="checkbox_terrain_hidden"></label>`;

		html += `<p id='terrain_init'><span class='custom-label'>No first village here</span>
			<input type="checkbox" onchange="if (!this.checked) $('#checkbox_terrain_hidden').prop('checked', '')" id="checkbox_terrain_init" />
			<label for="checkbox_terrain_init"></label></p>`;

		html += `<p id='terrain_reward'><span class='custom-label'>VP reward for island</span>
			<input type="checkbox" id="checkbox_terrain_reward" />
			<label for="checkbox_terrain_reward"></label></p>`;

		html += `<p id='with_harbor'><span class='custom-label'>Harbor</span>
			<input type="checkbox" id="checkbox_with_harbor" onchange="this.checked ? $('#terrain_dlg').addClass('harbor') : $('#terrain_dlg').removeClass('harbor')" />
			<label for="checkbox_with_harbor"></label></p>`;

		html += `<p id='harbor_direction'>`;
		html += `<label for='select_harbor_direction'>Pick direction:</label><select id='select_harbor_direction'>`;
		[[4, "North East"], [3, "East"], [2, "South East"], [1, "South West"], [0, "West"], [5, "North West"]].forEach((x) => 
			html += `<option value='${x[0]}'>${x[1]}</option>`);
		html += '</select></p>';

		html += `<p><label for='select_pile'>Pick number from pile / fixed value:</label><select id='select_pile'>`;
		for (let i=1; i <= piles; ++i)
			html += `<option value='${i}'>Pile ${i}</option>`;
		html += `<option value='fixed'>Fixed value</option>`; // only for harbor + number piles
		html += '</select></p>';

		html += `<p id='fixed_number'>`;
		html += `<label for='select_fixed_number'>Pick number:</label><select id='select_fixed_number'>`;
		[2,3,4,5,6,8,9,10,11,12].forEach((x) => html += `<option value='${x}'>${x}</option>`);
		html += '</select></p>';

		html += `<p id='fixed_harbor'>`;
		html += `<label for='select_fixed_harbor'>Pick type of harbor:</label><select id='select_fixed_harbor'>`;
		resources.forEach((x) => html += `<option value='${x}'>${x}</option>`);
		html += '</select></p>';

		html += `<p id='terrain_pile' class='pile'>`;
		Siedler.terrains.forEach((x) => 
			html += `<span><label for='terrain_${x}'>${capital(x)}</label><input type='number' value=0 min=0 max=99 step=1 id='terrain_${x}' /></span>`);
		html += '</p>';

		html += `<p id='resource_pile' class='pile'>`;
		resources.forEach((x) => 
			html += `<span><label for='resource_${x}'>${capital(x)}</label><input type='number' value=0 min=0 max=99 step=1 id='resource_${x}' /></span>`);
		html += '</p>';

		html += `<p id='number_pile' class='pile'>`;
		[2,3,4,5,6,8,9,10,11,12].forEach((x) =>
			html += `<span><label for='number_${x}'>${x}</label><input type='number' value=0 min=0 max=99 step=1 id='number_${x}' /></span>${x==6?'<br />':''}`);
		html += '</p>';

		dialog("Select terrain", `<div id='terrain_dlg'>${html}</div>`, { "OK" : () => {
			// @ OK
			const hidden = $("#checkbox_terrain_hidden").is(":checked");
			const init = !$("#checkbox_terrain_init").is(":checked");
			const reward = $("#checkbox_terrain_reward").is(":checked");
			const harbor = $("#checkbox_with_harbor").is(":checked");

			this.selected = $('#select_terrain').val();
			this.hex = { 
				terrain: this.selected,
				init: init,
				reward: reward
			};

			if (this.selected == 'water' && harbor) {
				const direction = parseFloat($("#select_harbor_direction").val());
				if ($("#select_pile").val() == 'fixed') {
					this.hex.harbor = {
						type: $("#select_fixed_harbor").val(),
						direction: direction
					};
				} else {
					const name = "harbors"+$("#select_pile").val();

					this.hex.harbor = {
						_rtype: name,
						direction: direction
					};

					const content = [];
					resources.forEach((x) => content.push([x, parseFloat($(`#resource_${x}`).val())]));
					Server.query({ do: 'editor', what: { action: 'pile', name: `_e_s${name}`, content: content }});

				}

			} else if (this.selected == 'random') {
				// Update the pile and make cursor attached.
				const name = "terrains"+this.pileIdx;
				const content = [];
				Siedler.terrains.forEach((x) => 
					content.push([
						{ 
							terrain: x, 
							hidden: hidden, 
							init: !hidden & init,
							reward: reward,
							_rnumber: !['water','desert'].includes(x) ? `numbers${this.pileIdx}` : null
						}, parseFloat($(`#terrain_${x}`).val())]));
				Server.query({ do: 'editor', what: { action: 'pile', name: `_e_s${name}`, content: content }});
				this.hex = `_r${name}`;

			} else if (this.selected == 'delete') {
				this.hex = null;

			} 

			if (!['desert','delete','water'].includes(this.selected)) {
				if ($('#select_pile').val() != 'fixed') {
					const name = "numbers"+$("#select_pile").val();
					const content = [];
					[2,3,4,5,6,8,9,10,11,12].forEach((x) => 
						content.push([x, parseFloat($(`#number_${x}`).val())]));
					Server.query({ do: 'editor', what: { action: 'pile', name: `_e_s${name}`, content: content }});
					if (this.selected != 'random')
						this.hex._rnumber = name;

				} else {
					if (this.selected != 'random')
						this.hex.number = parseFloat($('#select_fixed_number').val());
				}
			}
			const cursor = this.selected == 'random' ? this.hex : this.selected;
			this.scene.setCursor('hex', false, false);
			this.scene.setClickables([ cursor ]); // Cursor
			this.isRobberMode = false;

			const available = $("#available_tiles").data('available') ?? 1;
			if (available <= 0) {
				dialog("Error", "You must increase the amount of number chips or terrain tiles on your pile", null, null, available < 0 ? "red" : null);
				available < 0 ? this.selectTerrainBtn() : this.waterCursor();
			}

			// Save current selection
			$("#terrain_dlg input[type=checkbox], #terrain_dlg select, #terrain_dlg").each((i,e) =>
				this.dlgSetting[$(e).prop('id')] = { checked: $(e).prop('checked'), val: $(e).val(), className: $(e)[0].className });

		}}, () => {
			// @ Startup
			const available = () => {
				// find available tiles in pile
				let numberPile = 0, terrainPile = 0, resourcePile = 0;

				$("#terrain_pile input[type=number]").each((i,x) => terrainPile -= -$(x).val());
				$("#number_pile input[type=number]").each((i,x) => numberPile -= -$(x).val());
				$("#resource_pile input[type=number]").each((i,x) => resourcePile -= -$(x).val());

				const numberless = parseFloat($("#terrain_water").val()) + parseFloat($("#terrain_desert").val());

				this.available = null;
				let prefix;

				if (this.selected == 'random') {
					this.available = numberPile - (this.placed["numbers"+this.pileIdx] ?? 0) < terrainPile - numberless ? 0 : terrainPile;
					prefix = "terrains";
				} else if (this.selected == 'water' && $("#terrain_dlg").hasClass('harbor') && this.pileIdx != 'fixed') {
					this.available = resourcePile;
					prefix = "harbors";
				} else if (!$("#terrain_dlg").hasClass('nonumber') && this.pileIdx != 'fixed') {
					this.available = numberPile + numberless - (this.placed["terrains"+this.pileIdx] ?? 0);
					prefix = "numbers";
				}

				if (this.available !== null) {
					const diff = this.available - (this.placed[prefix+this.pileIdx] ?? 0);
					$("#available_tiles")
						.html(`${Math.abs(diff)} tiles ${diff < 0 ? 'missing' : 'available'}`)
						.data('available', diff)
						.css('color', diff > 0 ? 'green' : (diff < 0 ? 'red' : 'black'));
				} else {
					$("#available_tiles").html('').data('available', null);
				}
			};

			const refresh = () => {
				this.selected = $('#select_terrain').val();
				this.pileIdx = $("#select_pile").val();

				// Reset+Load current piles
				$("#terrain_dlg input[type=number]").val(0);

				if (`_e_sharbors${this.pileIdx}` in this.situation) {
					const pile = this.situation[`_e_sharbors${this.pileIdx}`];
					for (let t in pile) {
						$(`#resource_${pile[t][0]}`).val(pile[t][1]);
					}
				}

				if (`_e_sterrains${this.pileIdx}` in this.situation) {
					const pile = this.situation[`_e_sterrains${this.pileIdx}`];
					for (let t in pile) {
						$(`#terrain_${pile[t][0]['terrain']}`).val(pile[t][1]);
					}
				}
				
				if (`_e_snumbers${this.pileIdx}` in this.situation) {
					const pile = this.situation[`_e_snumbers${this.pileIdx}`];
					for (let n in pile) {
						$(`#number_${pile[n][0]}`).val(pile[n][1]);
					}
				}

				// Show and hide available options:
				$("#select_terrain").val() == "random" ? $("#terrain_dlg").addClass("random") : $("#terrain_dlg").removeClass("random");
				$("#select_terrain").val() == "water" ? $("#terrain_dlg").addClass("water") : $("#terrain_dlg").removeClass("water");
				['delete','water'].includes($("#select_terrain").val()) ? $("#terrain_dlg").addClass("nothing") : $("#terrain_dlg").removeClass("nothing");
				['delete','desert','water'].includes($("#select_terrain").val()) ? $("#terrain_dlg").addClass("nonumber") : $("#terrain_dlg").removeClass("nonumber");
				$("#select_pile").val() == "fixed" ? $("#terrain_dlg").addClass("fixed") : $("#terrain_dlg").removeClass("fixed");

				available();
			};

			$("#select_terrain, #select_pile").on('change', refresh); // Call refresh & available
			$("#terrain_dlg input[type=number], #with_harbor").on('change', available);

			// Remember the current selection
			for (let id in this.dlgSetting)
				$("#"+id).val(this.dlgSetting[id].val).prop('checked', this.dlgSetting[id].checked)[0].className = this.dlgSetting[id].className;

			refresh();

		}, "wide");
	}


	setupButtons() {
		Person.myself.$el.find(".container").html("<div class='options'></div>");
		const $container = Person.myself.$el.find(".options");

		$(`<button title='Robber & Pirate'>&#x1f480;</button>`)
			.on('click', this.robberCursor.bind(this))
			.appendTo($container);

		$(`<button title='Select terrain'>&#127796;</button>`)
			.on('click', this.selectTerrainBtn.bind(this))
			.appendTo($container);

		$(`<button title='Save'>&#128190;</button>`).on('click', () => {
			const html = `
				<input type="text" id="dlg_save_name" placeholder="Scenario Name" />
				<p><label for="dlg_save_vp">VP limit:</label><input type="number" min=3 max=99 value=${this.situation['vp_limit']} id="dlg_save_vp" /></p>

				<p><span class='custom-label'>Reward discovery of new terrain</span>
				<input type="checkbox" id="checkbox_reward_terrain" ${this.situation['reward_discovery'] ? 'checked' : ''} />
				<label for="checkbox_reward_terrain"></label>

				<p><label for="input_island_bonus">Bonus VP for new island</label>
				<input type="number" min=0 value=${this.situation['reward_island']} max=99 id="input_island_bonus" /></p>`;

			dialog('Save', html, { "OK" : this.save, "Cancel" : null });
		}).appendTo($container);
	}

	save() {
		const scenario = $("#dlg_save_name").val();
		Server.query({ do: 'editor', what: { 
			action: 'save', 
			name: scenario, 
			vp_limit: parseFloat($("#dlg_save_vp").val()),
			reward_discovery: $("#checkbox_reward_terrain").is(":checked"),
			reward_island: parseFloat($("#input_island_bonus").val())
		}})
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

	async run(situation) {
		if (this.isRunning)
			return;

		this.isRunning = true;

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

	setupBoard(situation) {
		this.shift = { x: situation.shift_x, y: situation.shift_y };

		if (situation.robber) {
			for (let i in situation.robber) {
				const pos = situation.robber[i];
				this.scene.placeFigure('robber', Number(pos[0])-situation.shift_x, Number(pos[1])-situation.shift_y, true);
			}
		}

		if (situation.pirate) {
			for (let i in situation.pirate) {
				const pos = situation.pirate[i];
				this.scene.placeFigure('pirate', Number(pos[0])-situation.shift_x, Number(pos[1])-situation.shift_y, true);
			}
		}

		for (let y in situation.board) {
			for (let x in situation.board[y]) {
				if (situation.board[y][x]) 
					this.setHex(situation.board[y][x], Number(x)-situation.shift_x, Number(y)-situation.shift_y);
				else
					this.scene.placeHex({terrain: 'hidden'}, Number(x)-situation.shift_x, Number(y)-situation.shift_y, Scene.nameToRgba("transparent"), [0.8, 0]);
			}
		}
	}
}