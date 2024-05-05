'use strict';

class Light {
    static point_count = 0;
    static dir_count = 0;

    static reset() {
        this.point_count = this.dir_count = 0;
    }


    isPoint;
    index;

    ambient;
    diffuse;
    specular;

    pos;
    dir;

    constant;
    linear;
    quadratic;
    cutoff;

    constructor(gl, ambient, diffuse, specular, constant, linear, quadratic, cutoff) {
        this.pos = [0.0, 0.0, 0.0];
        this.dir = [0.0, 0.0, 0.0]
        this.ambient = ambient;
        this.diffuse = diffuse;
        this.specular = specular;

        if (constant === undefined) {
            // Directed light
            this.isPoint = false;
            this.index = Light.dir_count++;

        } else {
            // Point light
            this.constant = constant;
            this.linear = linear;
            this.quadratic = quadratic;
            this.cutoff = cutoff;
            this.isPoint = true;
            this.index = Light.point_count++;
        }
    }

    apply(gl, shader) {
        if (!shader.ready) return;
        shader.use(gl);
        let type = this.isPoint ? "point" : "dir";
        gl.uniform3fv(shader.loc(gl, type + "Light[" + this.index + "].ambient"), this.ambient);
        gl.uniform3fv(shader.loc(gl, type + "Light[" + this.index + "].diffuse"), this.diffuse);
        gl.uniform3fv(shader.loc(gl, type + "Light[" + this.index + "].specular"), this.specular);
        gl.uniform3fv(shader.loc(gl, type + "Light[" + this.index + "].dir"), this.dir);

        if (this.isPoint) {
            gl.uniform3fv(shader.loc(gl, "pointLight[" + this.index + "].pos"), this.pos);
            gl.uniform1f(shader.loc(gl, "pointLight[" + this.index + "].constant"), this.constant);
            gl.uniform1f(shader.loc(gl, "pointLight[" + this.index + "].linear"), this.linear);
            gl.uniform1f(shader.loc(gl, "pointLight[" + this.index + "].quadratic"), this.quadratic);
            gl.uniform1f(shader.loc(gl, "pointLight[" + this.index + "].cutoff"), this.cutoff);
        }
    }

    move(gl, pos, shader) {
        this.pos = pos;
        this.apply(gl, shader);
    }

    turn(gl, dir, shader) {
        this.dir = dir;
        this.apply(gl, shader);
    }
}