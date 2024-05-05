'use strict';

class ModelMaker {
	static triangle = {
		pos : [0, 0, 0.04, -0.94, 0.5, 0.04, -0.94, -0.5, 0.04, // up
				0, 0, 0.04, -0.94, 0.5, 0.04, -0.94, 0.5, 0.0, 0, 0, 0.0, // side +
				0, 0, 0.04, -0.94, -0.5, 0.04, -0.94, -0.5, 0.0, 0, 0, 0.0, // side -
				-0.94, 0.5, 0.04, -0.94, -0.5, 0.04, -0.94, -0.5, 0.0, -0.94, 0.5, 0.0, // outside
				0, 0, 0.0, -0.94, 0.5, 0.0, -0.94, -0.5, 0.0], // down
		norm : [0, 0, 1, 0, 0, 1, 0, 0, 1,
				0.5, 1, 0,  0.5, 1, 0,  0.5, 1, 0,  0.5, 1, 0,  
				0.5, -1, 0,  0.5, -1, 0,  0.5, -1, 0,  0.5, -1, 0,  
				-1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  
				0, 0, -1, 0, 0, -1, 0, 0, -1],
		tex : [0, 0, 1, 0.5, 1, -0.5,
				0, 0, 1, 0, 1, 1, 0, 1, 
				0, 0, 1, 0, 1, 1, 0, 1, 
				0, 0, 1, 0, 1, 1, 0, 1, 
				0, 0, 1, 0.5, 1, -0.5],
		idx : [0, 1, 2, 3, 5, 4, 3, 6, 5, 7, 8, 9, 7, 9, 10, 11, 13, 12, 11, 14, 13] //, 15, 16, 17] <-- bottom
	};

	static background = {
		pos : [-50, -50, -0.1, 50, -50, -0.1, 50, 50, -0.1, -50, 50, 0.1],
		norm : [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
		tex : [0, 0, 5, 0, 5, 5, 0, 5],
		idx : [0, 1, 2, 0, 2, 3]
	};

	static road = {
		pos : [
			-1, 0.1, 0.2, 1, 0.1, 0.2, 1, -0.1, 0.2, -1, -0.1, 0.2, 
			-1, -0.1, 0.2, 1, -0.1, 0.2, 1, -0.1, 0, -1, -0.1, 0, 
			-1, -0.1, 0, 1, -0.1, 0, 1, 0.1, 0, -1, 0.1, 0, 
			-1, 0.1, 0, 1, 0.1, 0, 1, 0.1, 0.2, -1, 0.1, 0.2, 
			-1, 0.1, 0.2, -1, -0.1, 0.2, -1, -0.1, 0, -1, 0.1, 0, 
			1, 0.1, 0.2, 1, -0.1, 0.2, 1, -0.1, 0, 1, 0.1, 0
		],
		norm : [
			0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
			0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 
			0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
			0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 
			-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 
			1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0
		],
		tex : [
			0, 0, 1, 0, 1, 0.1, 0, 0.1,
			0, 0, 1, 0, 1, 0.1, 0, 0.1,
			0, 0, 1, 0, 1, 0.1, 0, 0.1,
			0, 0, 1, 0, 1, 0.1, 0, 0.1,
			0, 0, 0.1, 0, 0.1, 0.1, 0, 0.1,
			0, 0, 0.1, 0, 0.1, 0.1, 0, 0.1,
		],
		idx : [
			0, 2, 1, 0, 3, 2, // fr
			4, 6, 5, 4, 7, 6, // ba
			// 8, 9, 10, 8, 10, 11, // bot
			12, 14, 13, 12, 15, 14, // r fr
			16, 18, 17, 16, 19, 18, // r ba
			20, 21, 22, 20, 22, 23
		]
	};

	static ship = {
		pos : [
			-0.6, 0, 0.3,  -0.35, 0.15, 0.3,  -0.3, 0.1, 0,  -0.4, 0, 0,  // back side facing + (4)
			-0.6, 0, 0.3,  -0.35, -0.15, 0.3,  -0.3, -0.1, 0,  -0.4, 0, 0,  // back side facing - (4)

			-0.35, 0.15, 0.3,  0.35, 0.15, 0.3,  0.3, 0.1, 0,  -0.3, 0.1, 0,  // side facing + (4)
			-0.35, -0.15, 0.3,  0.35, -0.15, 0.3,  0.3, -0.1, 0,  -0.3, -0.1, 0,  // side facing - (4)

			0.6, 0, 0.3,  0.35, 0.15, 0.3,  0.3, 0.1, 0,  0.4, 0, 0,  // front side facing + (4)
			0.6, 0, 0.3,  0.35, -0.15, 0.3,  0.3, -0.1, 0,  0.4, 0, 0,  // front side facing - (4)

			-0.6, 0, 0.3,  -0.35, -0.15, 0.3,  0.35, -0.15, 0.3,  0.6, 0, 0.3,  0.35, 0.15, 0.3,  -0.35, 0.15, 0.3, // cover (6)

			-0.3, 0.04, 0.3,  0, 0.04, 0.9,  0, 0.04, 0.3, // sail side facing + (3)
			-0.3, -0.04, 0.3,  0, -0.04, 0.9,  0, -0.04, 0.3, // sail side facing - (3)

			-0.3, -0.04, 0.3,  0, -0.04, 0.9,  0, 0.04, 0.9,  -0.3, 0.04, 0.3,  // sail back (4)
			0, 0.04, 0.3,  0, 0.04, 0.9,  0, -0.04, 0.9,  0, -0.04, 0.3 // sail front (4)
		],
		norm : [ // sides not updated to x=-0.6...0.6
    		-0.69, 0.69, -0.23, -0.69, 0.69, -0.23, -0.69, 0.69, -0.23, -0.69, 0.69, -0.23, // bsf+
    		-0.69, -0.69, -0.23, -0.69, -0.69, -0.23, -0.69, -0.69, -0.23, -0.69, -0.69, -0.23, // bsf-
			
			0, 0.99, -0.16, 0, 0.99, -0.16, 0, 0.99, -0.16, 0, 0.99, -0.16, // sf+
			0, -0.99, -0.16, 0, -0.99, -0.16, 0, -0.99, -0.16, 0, -0.99, -0.16, // sf-

    		0.69, 0.69, -0.23, 0.69, 0.69, -0.23, 0.69, 0.69, -0.23, 0.69, 0.69, -0.23, // fsf+
    		0.69, -0.69, -0.23, 0.69, -0.69, -0.23, 0.69, -0.69, -0.23, 0.69, -0.69, -0.23, // fsf-

    		0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, // c

    		0, 1, 0, 0, 1, 0, 0, 1, 0, // ssf+
			0, -1, 0, 0, -1, 0, 0, -1, 0, // ssf-

			-0.92, 0, 0.39, -0.92, 0, 0.39, -0.92, 0, 0.39, -0.92, 0, 0.39, 
			1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0
		],

		tex : [
			0, 0, 1, 0, 1, 1, 0, 1, 
			0, 0, 1, 0, 1, 1, 0, 1, 

			0, 0, 1, 0, 1, 1, 0, 1, 
			0, 0, 1, 0, 1, 1, 0, 1, 

			0, 0, 1, 0, 1, 1, 0, 1, 
			0, 0, 1, 0, 1, 1, 0, 1, 

			0, 0.5, 0.15, 0.35, 0.85, 0.35, 1, 0.5, 0.85, 0.65, 0.15, 0.65,

			0.2, 0.3, 0.5, 1, 0.5, 0.3,
			0.2, 0.3, 0.5, 1, 0.5, 0.3,

			0, 0, 1, 0, 1, 1, 0, 1, 
			0, 0, 1, 0, 1, 1, 0, 1, 
		],
		idx : [
			0, 1, 2, 0, 2, 3, 
			4, 6, 5, 4, 7, 6,

			8, 9, 10, 8, 10, 11,
			12, 14, 13, 12, 15, 14,

			16, 18, 17, 16, 19, 18,
			20, 21, 22, 20, 22, 23,

			24, 25, 29, 25, 26, 29, 29, 26, 28, 26, 27, 28,

			30, 31, 32,
			33, 35, 34,

			36, 37, 38, 36, 38, 39,
			40, 41, 42, 40, 42, 43
		]

	}

	static village = {
		pos : [
			-0.75, 0.5, 0, -0.75, 0.5, 0.5, 0.75, 0.5, 0.5, 0.75, 0.5, 0, // front (4)
			-0.75, -0.5, 0, -0.75, -0.5, 0.5, 0.75, -0.5, 0.5, 0.75, -0.5, 0, // back (4)
			-0.75, -0.5, 0, -0.75, 0.5, 0, 0.75, 0.5, 0, 0.75, -0.5, 0, // bottom (4)
			-0.75, 0.5, 0.5, -0.75, 0, 1, 0.75, 0, 1, 0.75, 0.5, 0.5, // roof-front (4)
			-0.75, -0.5, 0.5, -0.75, 0, 1, 0.75, 0, 1, 0.75, -0.5, 0.5, // roof-back (4)
			-0.75, -0.5, 0, -0.75, -0.5, 0.5, -0.75, 0, 1, -0.75, 0.5, 0.5, -0.75, 0.5, 0, // left side (5)
			0.75, -0.5, 0, 0.75, -0.5, 0.5, 0.75, 0, 1, 0.75, 0.5, 0.5, 0.75, 0.5, 0 // right side (5)
		],
		norm : [
			0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, // front (4)
			0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, // back (4)
			0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, // bottom (4)
			0, 0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, // roof-front (4)
			0, -0.5, 0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, // roof-back (4)
			-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, // left side (5)
			1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, // right side (5)
		],
		tex : [
			0.0, 0.0, 0.0, 0.5, 1.0, 0.5, 1.0, 0.0, // front
			0.0, 0.0, 0.0, 0.5, 1.0, 0.5, 1.0, 0.0, // back
			0.0, 0.0, 0.0, 0.5, 1.0, 0.5, 1.0, 0.0, // bottom
			0.0, 0.5, 0.0, 1.0, 1.0, 1.0, 1.0, 0.5, // roof-front
			0.0, 0.5, 0.0, 1.0, 1.0, 1.0, 1.0, 0.5, // roof-back
			0.0, 0.0, 0.0, 0.5, 0.5, 1.0, 1.0, 0.5, 1.0, 0.0, // left side
			0.0, 0.0, 0.0, 0.5, 0.5, 1.0, 1.0, 0.5, 1.0, 0.0, // right side
		],
		idx : [
			0, 1, 2, 0, 2, 3, // fr
			4, 6, 5, 4, 7, 6, // ba
			// 8, 9, 10, 8, 10, 11, // bot
			12, 13, 14, 12, 14, 15, // r fr
			16, 18, 17, 16, 19, 18, // r ba
			20, 21, 23, 20, 23, 24, 21, 22, 23, // l si
			25, 28, 26, 25, 29, 28, 26, 28, 27 // r si
		]
	};

	static city = {
		pos : [
			-1, 0.5, 0, -1, 0.5, 1.5, -0.5, 0.5, 2, 0, 0.5, 1.5, 0, 0.5, 1, 1, 0.5, 1, 1, 0.5, 0, // front (7)
			-1, -0.5, 0, -1, -0.5, 1.5, -0.5, -0.5, 2, 0, -0.5, 1.5, 0, -0.5, 1, 1, -0.5, 1, 1, -0.5, 0, // back (7)
			-1, -0.5, 0, -1, 0.5, 0, 1, 0.5, 0, 1, -0.5, 0, // bottom (4)
			-1, -0.5, 0, -1, -0.5, 1.5, -1, 0.5, 1.5, -1, 0.5, 0, // wall and tower (4)
			-1, -0.5, 1.5, -0.5, -0.5, 2, -0.5, 0.5, 2, -1, 0.5, 1.5, // roof (4)
			0, 0.5, 1.5, -0.5, 0.5, 2, -0.5, -0.5, 2, 0, -0.5, 1.5, // roof (4)
			0, 0.5, 1, 0, 0.5, 1.5, 0, -0.5, 1.5, 0, -0.5, 1, // tower (4)
			1, 0.5, 1, 0, 0.5, 1, 0, -0.5, 1, 1, -0.5, 1, // flat roof (4)
			1, 0.5, 0, 1, 0.5, 1, 1, -0.5, 1, 1, -0.5, 0 // wall (4)
		],
		norm : [
			0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 
			0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 
			0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 
			-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 
			-0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 
			0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 
			1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 
			0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 
			1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 
		],
		tex : [
			0, 0, 0, 0.75, 0.25, 1, 0.5, 0.75, 0.5, 0.5, 1, 0.5, 1, 0,
			0, 0, 0, 0.75, 0.25, 1, 0.5, 0.75, 0.5, 0.5, 1, 0.5, 1, 0,
			0, 0, 0, 1, 1, 1, 1, 0, 
			0, 0, 0, 1, 1, 1, 1, 0, 
			0, 0, 0, 1, 1, 1, 1, 0, 
			0, 0, 0, 1, 1, 1, 1, 0, 
			0, 0, 0, 1, 1, 1, 1, 0, 
			0, 0, 0, 1, 1, 1, 1, 0, 
			0, 0, 0, 1, 1, 1, 1, 0, 
		],
		idx : [
			0, 1, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 1, 2, 3, // front (7)
			7, 10, 8, 7, 11, 10, 7, 12, 11, 7, 13, 12, 8, 10, 9, // back (7)
			// 7, 8, 10, 7, 10, 11, 7, 11, 12, 7, 12, 13, 8, 9, 10, // back (7)
			// 14, 15, 16, 14, 16, 17, // bottom (4)
			18, 19, 20, 18, 20, 21, // wall and tower (4)
			22, 23, 24, 22, 24, 25, // roof (4)
			26, 27, 28, 26, 28, 29, // roof (4)
			30, 31, 32, 30, 32, 33, // tower (4)
			34, 35, 36, 34, 36, 37, // flat roof (4)
			38, 39, 40, 38, 40, 41 // wall (4)
		]
	};

	// c: center [x,y,z], r: radius, d: recursive depth
	static makeBall(c, r, d) {
		// texture oriented +z
		const out = { 
			idx: [0, 4, 2,  2, 4, 1,  1, 4, 3,  3, 4, 0,  0, 2, 5,  2, 1, 5,  1, 3, 5,  3, 0, 5],
			norm: [1, 0, 0,  -1, 0, 0,  0, 1, 0,  0, -1, 0,  0, 0, 1,  0, 0, -1],
			tex: [0, 0.5,  0.5, 0.5,  0.75, 0.5,  0.25, 0.5,  0.5, 1,  0.5, 0],
		};

		const mid_pos = (i, j) => {
			let pos = out.norm.slice(3*i, 3*i+3).map((a,i) => (a + out.norm[3*j+i]) / 2);
			let norm = Math.sqrt(pos.map((a) => a*a).reduce((partialSum, a) => partialSum+a, 0));
			pos = pos.map((a,i) => a / norm);
			return pos;
		};
		const mid_tex = (i, j) => {
			let p1 = out.tex.slice(2*i, 2*i+2);
			let p2 = out.tex.slice(2*j, 2*j+2);
			if (p1[1] == 0 || p1[1] == 1) p1[0] = p2[0];
			if (p2[1] == 0 || p2[1] == 1) p2[0] = p1[0];
			return p1.map((a,i) => (a+p2[i]) / 2);
		};

		for (let i=0; i < d; ++i) {
			let idx = [];
			for (let j=0; j < out.idx.length; j += 3) {
				let new_index = out.norm.length / 3;
				out.norm = out.norm
					.concat(mid_pos(out.idx[j], out.idx[j+1]))
					.concat(mid_pos(out.idx[j+1], out.idx[j+2]))
					.concat(mid_pos(out.idx[j], out.idx[j+2]));
				out.tex = out.tex
					.concat(mid_tex(out.idx[j], out.idx[j+1]))
					.concat(mid_tex(out.idx[j+1], out.idx[j+2]))
					.concat(mid_tex(out.idx[j], out.idx[j+2]));
				idx = idx.concat([
					out.idx[j], new_index+2, new_index,
					new_index, new_index+1, out.idx[j+1], 
					new_index+2, out.idx[j+2], new_index+1,
					new_index, new_index+2, new_index+1
				]);
			}
			out.idx = idx;
		}
		out.pos = out.norm.map((a,i) => a * r + c[i%3]);

		return out;
	}

	static makeFigure() {
		const ball = this.makeBall([0, 0, 4], 0.7, 3);
		const cone = this.makeCone([0, 0, 0], 1.2, 0.3, 4.0);
		const cone_idx = ball.pos.length / 3;
		const out = {
			pos: ball.pos.concat(cone.pos),
			norm: ball.norm.concat(cone.norm),
			tex: ball.tex.concat(cone.tex),
			idx: ball.idx.concat(cone.idx.map((i) => i + cone_idx))
		}
		return out;
	}

	static makeShipWithMast() {
		const r = 0.05;
		const c = [0.09,0,0.3];
		const h = 0.7;
		const mast = this.makeCone(c, r, r, h);
		const mast_top = this.makeDisc([c[0],c[1],c[2]+h], r+0.02, 0.04);


		const mast_top_idx = mast.pos.length / 3;
		const ship_idx = mast_top_idx + mast_top.pos.length / 3;

		const out = {
			pos: mast.pos.concat(mast_top.pos).concat(this.ship.pos),
			norm: mast.norm.concat(mast_top.norm).concat(this.ship.norm),
			tex: mast.tex.concat(mast_top.tex).concat(this.ship.tex),
			idx: mast.idx.concat(mast_top.idx.map((i) => i + mast_top_idx)).concat(this.ship.idx.map((i) => i + ship_idx))
		};

		return out;
	}

	static makeDisc(c, r, height) {
		const steps = 50, tex_inner_r = 0.45, tex_outer_r = 0.5;
		const out = { pos: [], norm: [], idx: [], tex: [] };


		for (let i=0; i <= steps; ++i) {
			const cos = Math.cos(2 * Math.PI * i / steps);
			const sin = Math.sin(2 * Math.PI * i / steps);
			var arr = [ cos * r, sin * r, height, cos * r, sin * r, 0 ];
			out.pos = out.pos.concat(arr).concat(arr);
			out.norm = out.norm.concat([
				cos, sin, 0, cos, sin, 0,
				0, 0, 1, 0, 0, -1
			]);
			arr = [ 0.5 + cos * tex_inner_r, 0.5 + sin * tex_inner_r, 0.5 + cos * tex_outer_r, 0.5 + sin * tex_outer_r ];
			out.tex = out.tex.concat(arr).concat(arr);
		}

		const center_top = out.pos.length / 3;
		out.pos = out.pos.concat([0, 0, height]);
		out.norm = out.norm.concat([0, 0, 1]);
		out.tex = out.tex.concat([0.5, 0.5]);
		const center_bottom = out.pos.length / 3;
		out.pos = out.pos.concat([0, 0, 0]);
		out.norm = out.norm.concat([0, 0, -1]);
		out.tex = out.tex.concat([0.5, 0.5]);

		for (let i=0; i < 4*steps; i += 4) {
			out.idx = out.idx.concat([ i, i+1, i+4, i+4, i+1, i+5 ]);
			// no bottom:
			out.idx = out.idx.concat([ i+2, i+6, center_top ]); // , i+3, center_bottom, i+7 ]); // <-- bottom
		}
		out.pos = out.pos.map((a,i) => a + c[i % 3]);

		return out;
	}

	// c: center [x,y,z], r: radius at c, top_r: radius at top, height (+z is up)
	static makeCone(c, r, top_r, height) {
		const steps = 50;
		const out = { pos: [], norm: [], idx: [], tex: [] };
		let normal_v = r - top_r, normal_h = height;
		const normal_abs = Math.sqrt(normal_v*normal_v + normal_h*normal_h);
		normal_v /= normal_abs; 
		normal_h /= normal_abs;

		for (let i=0; i <= steps; ++i) {
			const cos = Math.cos(2 * Math.PI * i / steps);
			const sin = Math.sin(2 * Math.PI * i / steps);
			out.pos = out.pos.concat([ 
				cos * top_r, sin * top_r, height,
				cos * r, sin * r, 0
			]);
			out.norm = out.norm.concat([
				cos * normal_h, sin * normal_h, normal_v,
				cos * normal_h, sin * normal_h, normal_v
			]);
			out.tex = out.tex.concat([ i / steps, 0, i / steps, 1 ]);
		}
		for (let i=0; i < steps+steps; i += 2)
			out.idx = out.idx.concat([ i, i+1, i+2, i+2, i+1, i+3 ]);
		out.pos = out.pos.map((a,i) => a + c[i % 3]);

		return out;
	}

	static hexagon(scale, shift, z) {
		const h = Scene.tileHeight;
		const top = Scene.tan30 / 2.0;

		const a = [
			-1.0, -1.0 * h + top,
			 0.0, -1.0 * h - top,
			 1.0, -1.0 * h + top,
			 1.0,  1.0 * h - top,
			 0.0,  1.0 * h + top,
			-1.0,  1.0 * h - top
		];

		var b = [];

		scale ??= 1.0;
		shift ??= 0.0;

		for (let i=0; i < a.length; ++i) {
			b.push(a[i] * scale + shift);
			if (typeof z !== 'undefined' && z !== null && i % 2 === 1) {
				b.push(z);
			}
		}
		return b;
	}

	static makeHex() {
		// Hexagon model
		var positions = this.hexagon(null, null, 0.0).concat(this.hexagon(null, null, -0.1));
		positions = positions.concat(positions);
		var texCoords = this.hexagon(0.85 / 2.0, 0.5).concat(this.hexagon(0.93 / 2.0, 0.5));
		texCoords = texCoords.concat(texCoords);

		var normals = [];
		normals = new Array(positions.length/12).fill([0, 0, 1]).flat();
		normals = normals.concat(new Array(positions.length/12).fill([0, 0, -1]).flat());
		for (let i = positions.length/6; i < positions.length/3; i += 2) {
	  		let n = [positions[(i+1)*3+1]-positions[i*3+1], -positions[(i+1)*3]+positions[i*3], 0];
  			normals = normals.concat(n,n);
  		}

		const indices = [
			0, 1, 2, 0, 2, 3, 0, 3, 5, 5, 3, 4, // top
			6, 8, 7, 6, 9, 8, 6, 11, 9, 11, 10, 9, // bottom
			// sides:
			12, 18, 19, 12, 19, 13, 
			13, 19, 20, 13, 20, 14, 
			14, 20, 21, 14, 21, 15, 
			15, 21, 22, 15, 22, 16, 
			16, 22, 23, 16, 23, 17, 
			17, 23, 18, 17, 18, 12,
		];

		return { pos: positions, norm: normals, tex: texCoords, idx: indices };
	}
}