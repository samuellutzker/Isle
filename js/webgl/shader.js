'use strict';

class Shader {
	ready;
	program;
	attribs;
	uniforms;
	vertexSrc;
	fragSrc;

	#loadShader(gl, type, source) {
	  const shader = gl.createShader(type);

	  gl.shaderSource(shader, source);
	  gl.compileShader(shader);

	  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
	    alert(
	      `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`
	    );
	    gl.deleteShader(shader);
	    return null;
	  }

	  return shader;
	}


	#loadProgram(gl, vertexSrc, fragSrc) {
	  const vertexShader = this.#loadShader(gl, gl.VERTEX_SHADER, vertexSrc);
	  const fragmentShader = this.#loadShader(gl, gl.FRAGMENT_SHADER, fragSrc);
	  const program = gl.createProgram();

	  gl.attachShader(program, vertexShader);
	  gl.attachShader(program, fragmentShader);
	  gl.linkProgram(program);

	  // If creating the shader program failed, alert

	  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
	    alert(
	      `Unable to initialize the shader program: ${gl.getthis.shaderLog(
	        program
	      )}`
	    );
	    return null;
	  }
	  return program;
	}

	use(gl) {
		gl.useProgram(this.program);
	}

	loc(gl, name) {
		return this.ready ? gl.getUniformLocation(this.program, name) : null;
	}

	constructor(gl, attribs, uniforms) {
		this.attribs = attribs;
		this.uniforms = uniforms;
		this.ready = false;
	}

	async load(gl, vertexFile, fragFile) {
		let vertexSrc = await $.get(vertexFile);
		let fragSrc = await $.get(fragFile);

		const program = this.#loadProgram(gl, vertexSrc, fragSrc);
		this.program = program;

		for (let name in this.attribs)
			this.attribs[name] = gl.getAttribLocation(program, name);
		for (let name in this.uniforms) {
			if (this.uniforms[name] !== null) {
				for (let prop in this.uniforms[name]) {
					this.uniforms[name][prop] = gl.getUniformLocation(program, name+"."+prop);
				}
			}
			else
			{
				this.uniforms[name] = gl.getUniformLocation(program, name);	
			}
		}
		this.ready = true;
	}
}