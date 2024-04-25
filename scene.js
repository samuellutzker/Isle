'use strict';

// improve hard coding for edgeToWorld, onBoard
// upon hiding order gets changed, problems with transparency

var debug;

class Scene {
	static roadRotation(x) {
		if ((x % 5) == 0) return 0;
		return (x % 5) > 2 ? (2 * Math.PI / 3) : (Math.PI / 3);
	}

	static isCrossing(x,y) {
		return (x % 5) % 2 == 1;
	}

	static tan30 = Math.tan(Math.PI / 6.0);
	static tileHeight = (this.tan30 + Math.sqrt(1.0 + this.tan30 * this.tan30)) / 2.0;

	fieldOfView = (45 * Math.PI) / 180;
	zNear = 0.1;
	zFar = 100.0;

	canvas;
	shader;
	projView; // ProjectMat * ViewMat

	models; // object: name -> class Model

	// lights:
	backlight;
	lamp;
	flashlight;

	edges; // hexagon edge coordinates
	rgba; // rgba of color names

	mouse; // positions
	queue; // drawing queue

	clickables; // 2d array board-pos -> build option (depends on stickyEdge)

	viewRefresh; // flag to mark necessary update of projView

	doAction; // handler for clicks

	constructor(canvas) {
		this.canvas = canvas;
		this.onResize();
		this.clickables = null;
		this.queue = [];
		this.projView = mat4.create();
		this.viewRefresh = true;
		this.mouse = { 
			isTouch: matchMedia('(hover: none), (pointer: coarse)').matches,
			over: true, // mouse on screen
			cursorOn: matchMedia('(hover: none), (pointer: coarse)').matches, // show / hide cursor
			numCursors: 0, // number of cursors
			isEdge: true, // board and world refer to edge coordinates
			evt: [],
			pinch: null,
			down: null,
			autoTilt: true
		};
		['scr','last','pos','world','closest','tilt','shift','board','cursor'].forEach((i) => this.mouse[i] = { x: 0, y: 0});

		const h = ModelMaker.hexagon();
		this.edges = [
			-1.0, 0.0, h[0], h[1], 0.5*(h[0]+h[2]), 0.5*(h[1]+h[3]), h[2], h[3], 0.5*(h[2]+h[4]), 0.5*(h[3]+h[5]), h[4], h[5],
			1.0, 0.0, h[6], h[7], 0.5*(h[6]+h[8]), 0.5*(h[7]+h[9]), h[8], h[9], 0.5*(h[8]+h[10]), 0.5*(h[9]+h[11]), h[10], h[11]
		];
		this.edgeOnBoard = [
			0, 0, 1, 0, 2, 0, 3, 0, 4, 0, 6, 0, 5, 0, 8, 1, 7, 1, 6, 1, 4, 1, 3, 1
		];
		this.models = {};

		const attribs = { 
			vPos: null, 
			vTex: null, 
			vNorm: null 
		};
		
		const uniforms = { 
			color: null,
			colorSat: null,
			model: null, 
			projView: null, 
			normal: null,
			viewPos: null, 
			material: { 
				diffuse: null, 
				specular: null, 
				shininess: null 
			}
		};
		this.shader = new Shader(this.gl, attribs, uniforms);

		Light.reset();

		this.setCenter(0, 0);
	}

	setCenter(x,y) {
		this.center = { x: x, y: y };
	}

	clearEvents() {
		$(document).off('touchstart mouseover');
		$(window).off('resize pointermove wheel pointerout pointerover pointerup');
		$(this.canvas).off('click dblclick pointerdown pointerup pointermove pointerout pointercancel');
	}

	onResize() {
		const $canvas = $(this.canvas);
		$canvas
			.prop('width', $canvas.width())
			.prop('height', $canvas.height())
			.css('background-color', 'gray');
		this.gl = this.canvas.getContext("webgl2");
		if (this.gl === null) {
			alert('WebGL2 is not supported.');
			return;
		}
		this.gl.viewport(0, 0, $canvas.width(), $canvas.height());
		this.viewRefresh = true;
	}

	// Place a structure (village, road, etc) on the edges
	place(what, x, y, color, rotation) {
		const p = this.edgeToWorld(x, y);
		let transform = null;
		if (!Scene.isCrossing(x,y)) {
			transform = mat4.fromZRotation(mat4.create(), Scene.roadRotation(x));
		}
		this.addObject(what, p.x, p.y, 0, color, [0.5, 0], transform, x, y, 'structure');
	}

	// Undo place()
	remove(what, x, y) {
		if (typeof what === 'object') {
			what.forEach((w) => this.remove(w,x,y));
			return;
		}

		const q = this.queue;
		for (let i in q) {
			for (let r=q[i],s=null; r != null; s=r,r=r.replace) {
				if (what == (r.id_type ?? r.what) && r.id_x == x && r.id_y == y) {
					const out = r;
					if (s) {
						s.replace = r.replace;
					} else if (r.replace) {
						q[i] = r.replace;
					} else {
					 	q[i] = q[q.length-1];
					 	q.pop();
					}
					return out;
				}
			}
		}
		return null;
	}

	addObject(what, x, y, z, color, colorSat, transform, id_x, id_y, id_type, replace) {
		const model = {
			what: what,
			x: x,
			y: y,
			z: z,
			color: (typeof color === 'string') ? Scene.nameToRgba(color) : (color ?? [0,0,0,0]),
			colorSat: colorSat ?? [0,0],
			transform: transform ?? null,
			id_x: id_x ?? null,
			id_y: id_y ?? null,
			id_type: id_type ?? null,
			replace: replace ?? null
		};
		this.queue.push(model);
		return model;
	}

	drawQueue() {
		for (let i in this.queue) {
			this.drawModel(this.queue[i]);
		}
	}

	drawModel(model) {
		const gl = this.gl;

		const modelMatrix = mat4.create();

		mat4.translate(modelMatrix, modelMatrix, [model.x, model.y, model.z]);

		if (model.transform)
			mat4.multiply(modelMatrix, modelMatrix, model.transform);
		if (model.color)
			gl.uniform4fv(this.shader.uniforms.color, model.color);

		gl.uniform2fv(this.shader.uniforms.colorSat, model.colorSat ?? [0,0]);

		gl.uniformMatrix4fv(this.shader.uniforms.model, false, modelMatrix);
		gl.uniformMatrix4fv(this.shader.uniforms.normal, false, modelMatrix);

		this.models[model.what].draw(gl, this.shader);
	}

	// Converts between board matrix edge coords (edge,corner,edge,corner,edge)
	// and real world coordinates (assumed z=0)
	edgeToWorld(x, y) {
		const place = x % 5;
		x = Math.floor(x / 5);
		const center = this.centerToWorld(x, y);
		return { x: center.x + this.edges[2*place], y: center.y + this.edges[2*place + 1] };
	}

	edgeToBoard(x, y) {
		const rounded = this.centerToBoard(x, y);
		const rounded_world = this.centerToWorld(rounded.x, rounded.y);

		const sq = (x) => x*x;
		const dist = (i) => sq(rounded_world.x + this.edges[i] - x) + sq(rounded_world.y + this.edges[i+1] - y);

		let place = 0;
		for (let i=2; i < this.edges.length; i += 2) {
			if (dist(i) < dist(place))
				place = i;
		}
		return { x: rounded.x * 5 + this.edgeOnBoard[place], y: rounded.y + this.edgeOnBoard[place+1] };
	}

	// Converts between board matrix coords
	// and real world coordinates (assumed z=0)
	centerToWorld(x, y) {
		// center it, (3, 3) => (0,0)
		x -= (y - this.center.y) * 0.5 + this.center.x;
		y -= this.center.y;
		y *= Scene.tileHeight;
		return { x: 2*x, y: 2*y };
	}

	// Reverse centerToWorld (and round properly)
	centerToBoard(x, y) {
		x /= 2; y /= 2;
		y /= Scene.tileHeight;
		y = Math.ceil(y + this.center.y - 0.5)
		x = Math.ceil(x + (y - this.center.y) * 0.5 + this.center.x - 0.5);
		return { x: x, y: y };
	}

	// Converts between canvas (x,y) and world (x,y,0)
	canvasToWorld(x, y) {
		const invPV = mat4.create();
		mat4.invert(invPV, this.projView);
		const invPVarr = Array.from(invPV);
		const v = vec4.create();
		vec4.transformMat4(v, [x, y, 0, 1.0], invPV);
		const z = -v[2] / invPVarr[10];
		vec4.transformMat4(v, [x, y, z, 1.0], invPV);
		return { x: v[0]/v[3], y: v[1]/v[3] };
	}

	updateCam(gl) {
		this.viewRefresh = false;

		if (!this.mouse.isTouch) {
			// smoothing
			const sq = (x) => x*x;
			const resolution = 0.1;

			const x = this.mouse.over ? -this.mouse.pos.x : 0.0;
			const y = this.mouse.over ? -this.mouse.pos.y : 0.0;

			const step = sq(x - this.mouse.shift.x) + sq(y - this.mouse.shift.y);

			if (step > resolution) {
				const d = resolution / step;
				this.mouse.shift.x += d * (x - this.mouse.shift.x);
				this.mouse.shift.y += d * (y - this.mouse.shift.y);
				this.viewRefresh = true;
				this.mouse.cursorOn = false;
			}  else {
				this.mouse.shift = { x: x, y: y };
				this.mouse.cursorOn = true;
			}
		}

		if (!this.mouse.isTouch && this.mouse.autoTilt) {
			this.mouse.tilt = { x: 0.25 * this.mouse.shift.x, y: 0.25 * this.mouse.shift.y - 0.3 };
		}

		const rho = this.mouse.tilt.x * Math.PI / 3;
		const phi = -this.mouse.tilt.y * Math.PI / 3;
		const x = -6 * this.mouse.shift.x;
		const y = -6 * this.mouse.shift.y;

		vec3.rotateX(this.cam.pos, [x, y, this.cam.dist], [x,y,0], phi);
		vec3.rotateY(this.cam.pos, this.cam.pos, [x,y,0], rho);
		this.cam.lookat = [x, y, 0.0];

		this.setProjView(gl);
	}

	setProjView(gl) {
		// maybe create proj only once:
		const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
		const projectionMatrix = mat4.create();
		const viewMatrix = mat4.create();
 
		mat4.perspective(projectionMatrix, this.fieldOfView, aspect, this.zNear, this.zFar);
		mat4.lookAt(viewMatrix, this.cam.pos, this.cam.lookat, [0,1,0]);
		mat4.multiply(this.projView, projectionMatrix, viewMatrix);
		gl.uniformMatrix4fv(this.shader.uniforms.projView, false, this.projView);
		gl.uniform3fv(this.shader.uniforms.viewPos, this.cam.pos);
	}

	getOptions(x, y) {
		if (!this.clickables) return [];
		if (typeof this.clickables[0] === 'string') return this.clickables;
		return x >= 0 && y >= 0 && y < this.clickables.length && x < this.clickables[0].length ? this.clickables[y][x] : [];
	}

	draw() {
		const gl = this.gl;

		gl.clearColor(0.0, 0.0, 0.0, 1.0); // black
		// gl.clearColor(1.0, 1.0, 1.0, 1.0); // white
		gl.clearDepth(1.0);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);

		// blend
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		// face culling
		gl.enable(gl.CULL_FACE);
		gl.cullFace(gl.BACK);
		gl.frontFace(gl.CCW);

		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		if (this.viewRefresh) {
			// something changed and we need to update projView
			this.updateCam(gl);

			this.mouse.world = this.canvasToWorld(this.mouse.pos.x, this.mouse.pos.y); // expensive...
			if (this.mouse.isEdge) {
				this.mouse.board = this.edgeToBoard(this.mouse.world.x, this.mouse.world.y);
				this.mouse.closest = this.edgeToWorld(this.mouse.board.x, this.mouse.board.y);
			} else {
				this.mouse.board = this.centerToBoard(this.mouse.world.x, this.mouse.world.y);
				this.mouse.closest = this.centerToWorld(this.mouse.board.x, this.mouse.board.y);
			}

			const flashDir = [this.mouse.world.x, this.mouse.world.y, 0.0]; 
			if (!this.mouse.isTouch) {
				this.flashlight.move(gl, this.cam.pos, this.shader);
				this.flashlight.turn(gl, flashDir.map((e,i) => { return e - this.cam.pos[i] }), this.shader);
			}
		}

		this.drawQueue();

		this.drawCursor();
	}

	drawCursor() {
		if (!this.mouse.sticky && this.mouse.cursorType) {
			this.drawModel({
				// robber
				what: this.mouse.cursorType,
				x: this.mouse.world.x,
				y: this.mouse.world.y,
				z: 0,
				color: Scene.nameToRgba("transparent"),
				colorSat: [0.2, 0],
				transform: null
			});

		} else {
			// village / city / road
			if (this.mouse.cursor.x != this.mouse.board.x || this.mouse.cursor.y != this.mouse.board.y) {
				for (; this.mouse.numCursors > 0; --this.mouse.numCursors)
					this.remove('cursor'); // , this.mouse.cursor.x, this.mouse.cursor.y);

				if (!this.mouse.cursorOn) return;

				this.mouse.cursor = this.mouse.board;

				const options = this.getOptions(this.mouse.board.x, this.mouse.board.y);
				let last = null;
				for (let i in options) {
					last = this.addObject(options[i], this.mouse.closest.x, this.mouse.closest.y, 0, 
						Scene.nameToRgba("transparent"), [0.2, 0],
						this.mouse.isEdge && !Scene.isCrossing(this.mouse.board.x, this.mouse.board.y) 
						? mat4.fromZRotation(mat4.create(), Scene.roadRotation(this.mouse.board.x)) : null,
						null, null, 'cursor', // this.mouse.board.x, this.mouse.board.y, 'cursor', 
						i == 0 ? this.remove(this.mouse.cursorType, this.mouse.cursor.x, this.mouse.cursor.y) : null);
				}
				this.mouse.numCursors = options.length;
			}
		}
	}

	setCursor(type, isRobber, isEdge) {
		this.mouse.cursorType = type;
		this.mouse.isEdge = isEdge;
		this.mouse.sticky = !isRobber;
	}

	setClickables(clickables) {
		this.clickables = clickables;
	}

	setupLights(gl) {
		// Position and lights
		this.backlight = new Light(gl, [0.15,0.15,0.15], [0.35,0.35,0.35], [0.15,0.15,0.15]);
		this.backlight.turn(gl, [0.0, -0.3, 1.0], this.shader);

		this.lamp = new Light(gl, [0.05,0.05,0.05], [0.7,0.7,0.7], [0.35,0.35,0.35], 1.0, 0.02, 0.0032, -1.0);
		this.lamp.move(gl, [0, 0, 4], this.shader);

		this.flashlight = new Light(gl, [0.0,0.0,0.0],[0.9,0.9,0.9], [0.9,0.9,0.9], 3.0, 0.02, 0.0096, Math.cos(12.5*Math.PI/180.0));
	}

	placeFigure(figure, x, y, isEditor) {
		const c = this.centerToWorld(x, y);
		const pirateTransform = mat4.fromScaling(mat4.create(), [2,2,2]);
		mat4.rotateZ(pirateTransform, pirateTransform, 2 * Math.PI / 3);
		this.addObject(figure, c.x, c.y, 0, 'black', [0.75, 0.0], figure == 'pirate' ? pirateTransform : null, isEditor ? x : null, isEditor ? y : null);
	}

	placeHex(place, x, y, color, colorSat) {
		// Editor stuff:
		place = typeof place === 'string' ? { terrain: place } : place;
		if ('_rnumber' in place)
			place.number = place._rnumber;
		if ('harbor' in place && '_rtype' in place.harbor)
			place.harbor.type = place.harbor._rtype.replace('harbors','numbers');
		// End

		const normalize = (arr) => arr.map((v) => v / 255.0);
		const oceanColor = normalize([165,217,242,128]);
		const c = this.centerToWorld(x, y);

		this.remove('cursor');
		this.remove(['hex','chip','triangle'], x, y); // assuming there is one
		this.addObject(place.terrain, c.x, c.y, 0, color, colorSat, mat4.fromScaling(mat4.create(), [0.95, 0.95, 0.95]), x, y, 'hex');
		if (place.number) {
			this.addObject('chip_' + place.number, c.x, c.y, 0, 'ivory', [0,0.8], null, x, y, 'chip'); // '#c4b7a57a'
		}
		if (place.harbor) {
			const rotation = mat4.fromZRotation(mat4.create(), place.harbor.direction * Math.PI / 3)
			if (typeof place.harbor.type !== 'undefined') {
				this.addObject('chip_' + place.harbor.type, c.x, c.y, 0, oceanColor, [0,1], null, x, y, 'chip');
			}
			this.addObject('triangle', c.x, c.y, 0, oceanColor, [0,1], rotation, x, y, 'triangle')
		}
	}

	async start(clickHandler) {
		const gl = this.gl;

		this.doAction = clickHandler;

		// Shader:		
		await this.shader.load(gl, 'webgl/vertex.glsl', 'webgl/frag.glsl');
		this.shader.use(gl);

		// Cam:		
		const init_dist = 14.0
		this.cam = { pos: [0.0, 0.0, init_dist], lookat: [0.0, 0.0, 0.0], dist: init_dist };

		this.setupModels(gl);
		this.setupLights(gl);
		this.setupEvents();

    	this.viewRefresh = true;
	}

	mouseEvents(state) {
		state ? intercept() : intercept('pointermove wheel pointerdown pointerup pointerout pointerover');
	}

	setupEvents() {
		const normalizeMouse = (e) => {
			let offs = $(this.canvas).offset();
			return { 
				x : 2.0 * (e.clientX - offs.left) / $(this.canvas).width() - 1.0,
				y : 1.0 - 2.0 * (e.clientY - offs.top) / $(this.canvas).height()
			};
		}

		const maxSpeed = 0.3;
		const closeDist = 1.3, farDist = 20.0;

		$(window).on('resize', this.onResize.bind(this));

		// Pointer controls:
		const updateTilt = () => {
			const diff = { x: this.mouse.pos.x - this.mouse.last.x, y: this.mouse.pos.y - this.mouse.last.y };
			this.mouse.tilt.x = Math.max(-0.6, Math.min(0.6, this.mouse.tilt.x + diff.x));
			this.mouse.tilt.y = Math.max(-0.6, Math.min(0.6, this.mouse.tilt.y + diff.y));
		};

		// hybrid device hack:
		var touched = false, touchTimer = null;
		$(document).on('touchstart', () => {
			if (!this.mouse.isTouch) {
				this.mouse.isTouch = true;
				this.clearEvents();
				this.setupEvents();
			}
			clearTimeout(touchTimer);
			touched = true;
			touchTimer = setTimeout(() => touched = false, 500);

		}).on('mouseover', () => {
			if (!touched && this.mouse.isTouch) {
				this.mouse.isTouch = false;
				this.clearEvents();
				this.setupEvents();
			}
		});

		if (!this.mouse.isTouch) {

			// Mouse events

			$(this.canvas).on('dblclick', (e) => {
				this.mouse.autoTilt = !this.mouse.autoTilt;

			}).on('pointerdown', (e) => {
				this.mouse.down = this.mouse.pos = this.mouse.last = normalizeMouse(e);

			});

	    	$(window).on('pointermove', (e) => {
				this.mouse.pos = normalizeMouse(e);
				this.mouse.scr = { x: e.clientX, y: e.clientY };

				if (!this.mouse.autoTilt && this.mouse.down) {
					updateTilt();
				}
				this.mouse.last = this.mouse.pos;
				this.viewRefresh = true;

			}).on('wheel', (e) => {
				const speed = Math.max(Math.min(e.originalEvent.wheelDelta / 100.0, maxSpeed), -maxSpeed);
				this.cam.dist = Math.max(Math.min(this.cam.dist + speed, farDist), closeDist);
				this.viewRefresh = true;

	    	}).on('pointerup', (e) => {
	    		if (!this.mouse.down)
	    			return;
				const diff = { x: this.mouse.pos.x - this.mouse.down.x, y: this.mouse.pos.y - this.mouse.down.y };
				if (diff.x == 0 && diff.y == 0) {
					this.doAction(this.mouse.board, { x: e.clientX, y: e.clientY });
				}
				this.mouse.down = null;

			}).on('pointerout', () => { 
		    	this.mouse.over = false; 
				this.viewRefresh = true;

		    }).on('pointerover', () => this.mouse.over = true);

		} else {

			// Touch events

			const idx = (e) => { 
				for (let i=0; i < this.mouse.evt.length; ++i)
					if (this.mouse.evt[i].pointerId == e.pointerId)
						return i;
				return undefined;
			};
			const pinchDist = () =>
				  Math.abs(this.mouse.evt[0].clientX-this.mouse.evt[1].clientX)
				+ Math.abs(this.mouse.evt[0].clientY-this.mouse.evt[1].clientY);
			const pointerPos = () => {
				if (this.mouse.evt.length > 1) {
					const p1 = normalizeMouse(this.mouse.evt[0]), p2 = normalizeMouse(this.mouse.evt[1]);
					return { x: 0.5 * (p1.x + p2.x), y: 0.5 * (p1.y + p2.y) };
				} else return normalizeMouse(this.mouse.evt[0]);
			};

			$(this.canvas).on('pointerdown', (e) => { 
				this.mouse.evt.push(e);
				this.mouse.down = this.mouse.last = this.mouse.pos = normalizeMouse(e);
				this.viewRefresh = true;
				this.mouse.cursorOn = false;

			}).on('pointermove', (e) => {
				if (this.mouse.evt.length == 2) {
					// 2 fingers are touching
					this.mouse.evt[idx(e)] = e;
					if (!this.mouse.pinch) {
						this.mouse.pinch = pinchDist();
						this.mouse.pos = pointerPos();
					} else {
						const d = pinchDist();
						this.cam.dist -= (farDist - closeDist) * (d - this.mouse.pinch) / Math.min($(this.canvas).width(), $(this.canvas).height());
						this.cam.dist = Math.max(Math.min(this.cam.dist, farDist), closeDist);
						this.mouse.pinch = d;
						this.mouse.pos = pointerPos();
						updateTilt();
					}
				} else {
					this.mouse.pos = normalizeMouse(e);
					this.mouse.scr = { x: e.clientX, y: e.clientY };
					const diff = { x: this.mouse.pos.x - this.mouse.last.x, y: this.mouse.pos.y - this.mouse.last.y };
					this.mouse.shift.x += diff.x;
					this.mouse.shift.y += diff.y;
				}
				this.mouse.last = this.mouse.pos;
				this.viewRefresh = true;

			}).on('pointerup pointerout pointercancel', (e) => {
				const diff = { x: this.mouse.pos.x - this.mouse.down.x, y: this.mouse.pos.y - this.mouse.down.y };
				this.mouse.evt.splice(idx(e), 1);
				if (this.mouse.evt.length == 1) {
					this.mouse.last = normalizeMouse(this.mouse.evt[0]);
				}
				if (event.type == 'pointerup' && diff.x == 0 && diff.y == 0 && !this.mouse.pinch) {
					this.mouse.cursorOn = true;
					this.mouse.cursor = { x: 0, y: 0 };
					this.doAction(this.mouse.board, { x: e.clientX, y: e.clientY });
				}
				this.mouse.pinch = null;
			});
		}
	}

	setupModels(gl) {
		// Terrains:
		const hex = ModelMaker.makeHex();
		const terrain_names = [...Siedler.terrains, 'hidden', '_rterrains1', '_rterrains2', '_rterrains3', '_rterrains4', 'delete' ];
		const terrain = terrain_names.pop();

		this.models[terrain] = new Model(gl, hex.idx, hex.pos, hex.tex, hex.norm, "images/terrains/"+terrain+".jpg", "images/terrains/"+terrain+".jpg", 1.12);
		terrain_names.forEach(
			(other) => this.models[other] = Model.clone(gl, this.models[terrain], "images/terrains/"+other+".jpg", "images/terrains/"+other+".jpg", 1.12)
		);

		// Figures:
		const wood_diffuse = "images/wood.jpg";
		const wood_specular = "images/wood.jpg";

		const village_transform = mat4.rotateZ(mat4.create(), mat4.fromScaling(mat4.create(), [0.3, 0.3, 0.3]), Math.PI / 6);
		this.models['village'] = new Model(gl, ModelMaker.village.idx, ModelMaker.village.pos, ModelMaker.village.tex, ModelMaker.village.norm, wood_diffuse, wood_specular, 1.12, village_transform);

		const city_transform = mat4.rotateZ(mat4.create(), mat4.fromScaling(mat4.create(), [0.3, 0.3, 0.3]), Math.PI / 6);
		this.models['city'] = new Model(gl, ModelMaker.city.idx, ModelMaker.city.pos, ModelMaker.city.tex, ModelMaker.city.norm, wood_diffuse, wood_specular, 1.12, city_transform);

		const road_transform = mat4.rotateZ(mat4.create(), mat4.fromScaling(mat4.create(), [0.6, 0.45, 0.6]), Math.PI / 2);
		this.models['road'] = new Model(gl, ModelMaker.road.idx, ModelMaker.road.pos, ModelMaker.road.tex, ModelMaker.road.norm, wood_diffuse, wood_specular, 1.12, road_transform);

		const ship = ModelMaker.makeShipWithMast();
		this.models['ship'] = new Model(gl, ship.idx, ship.pos, ship.tex, ship.norm, wood_diffuse, wood_specular, 1.12, road_transform);
		this.models['move_ship'] = Model.clone(gl, this.models['ship'], wood_diffuse, wood_specular, 1.12);

		this.models['pirate'] = Model.clone(gl, this.models['ship'], wood_diffuse, wood_specular, 1.12);

		const robber_transform = mat4.fromScaling(mat4.create(), [0.3, 0.3, 0.3]);
		const robber = ModelMaker.makeFigure();
		this.models['robber'] = new Model(gl, robber.idx, robber.pos, robber.tex, robber.norm, wood_diffuse, wood_specular, 0.33, robber_transform);

		this.models['background'] = new Model(gl, ModelMaker.background.idx, ModelMaker.background.pos, ModelMaker.background.tex, ModelMaker.background.norm, "images/background.jpg", "images/background.jpg", .5);

		// Draw this one:
		this.addObject('background', 0, 0, 0);

		const chip = ModelMaker.makeDisc([0,0,0], 0.3, 0.05);
		this.models['chip_2'] = new Model(gl, chip.idx, chip.pos, chip.tex, chip.norm, "images/numbers/2.png", "images/numbers/2.png", 0.33);
		for (let i=3; i <= 12; ++i) {
			if (i == 7) continue;
			const fname = 'images/numbers/'+i+'.png';
			this.models['chip_'+i] = Model.clone(gl, this.models['chip_2'], fname, fname, 0.33);
		}
		Siedler.resources.concat(['generic','numbers1','numbers2','numbers3','numbers4']).forEach(
			(res) => this.models['chip_'+res] = Model.clone(gl, this.models['chip_2'], `images/resources/${res}.png`, `images/resources/${res}.png`, 0.33)
		);

		this.models['triangle'] = new Model(gl, ModelMaker.triangle.idx, ModelMaker.triangle.pos, ModelMaker.triangle.tex, ModelMaker.triangle.norm, 'images/empty.png', 'images/empty.png', 0.33);
	}

	static nameToRgba(name) {
		if (!this.rgba)
			this.rgba = {};
		if (!(name in this.rgba)) {
		    var canvas = document.createElement('canvas');
		    var context = canvas.getContext('2d');
		    context.fillStyle = name;
		    context.fillRect(0,0,1,1);
		    this.rgba[name] = Array.from(context.getImageData(0,0,1,1).data).map((v) => v / 255.0);
		}
	    return this.rgba[name];
	}

}
