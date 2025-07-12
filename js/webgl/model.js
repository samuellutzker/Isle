'use strict';

class Model {
    // Same model, different texture:
    static clone(gl, model, diffuse, specular, shininess) {
        let out = new Model(gl, null, null, null, null, diffuse, specular, shininess);
        out.vao = model.vao;
        out.vertexCount = model.vertexCount;
        return out;
    }

    static LOC_VPOS = 0;
    static LOC_VNORM = 1;
    static LOC_VTEX = 2;

    vPos;
    vTex;
    vNorm;
    shininess;
    indices;
    vertexCount;
    textureIndex; // Not needed for now- only 1+1 texture per model

    #setAttribute(gl, buffer, location, numComponents) {
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(location, numComponents, type, normalize, stride, offset);
        gl.enableVertexAttribArray(location);
    }

    #makeBuffer(gl, type, data) {
        const buffer = gl.createBuffer();
        gl.bindBuffer(type, buffer);
        gl.bufferData(type, data, gl.STATIC_DRAW);
        return buffer;
    }

    #loadTexture(gl, url) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        const level = 0;
        const internalFormat = gl.RGBA;
        const width = 1;
        const height = 1;
        const border = 0;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;
        const pixel = new Uint8Array([200, 200, 200, 255]); // default color
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        const image = new Image();
        image.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);

            // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            // gl.generateMipmap(gl.TEXTURE_2D);

            // Only generate mipmaps of textures with power of 2 dimensions.
            const isPowerOf2 = (value) => {
              return (value & (value - 1)) === 0;
            };

            if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            }
            else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            }
        };
        image.src = url;

        return texture;
    }

    draw(gl, shader) {
        shader.use(gl);

        gl.bindVertexArray(this.vao)
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.diffuse);
        gl.uniform1i(shader.uniforms.material.diffuse, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.specular);
        gl.uniform1i(shader.uniforms.material.specular, 1);

        gl.uniform1f(shader.uniforms.material.shininess, this.shininess);

        gl.drawElements(gl.TRIANGLES, this.vertexCount, gl.UNSIGNED_SHORT, 0);

    }


    constructor(gl, indices, vertices, texCoords, normals, diffuse, specular, shininess, transform) {
        // Textures
        this.diffuse = this.#loadTexture(gl, diffuse);
        this.specular = this.#loadTexture(gl, specular);
        this.shininess = shininess;

        if (!indices || !vertices || !texCoords || !normals)
            return; // this is going to be a clone

        if (vertices.length != normals.length || vertices.length / 3 != texCoords.length / 2) {
            console.error("Model: Vertices / Normals / texCoord dimensions do not match.");
            return;
        }
        const N = vertices.length;
        this.vertexCount = indices.length;

        // preprocess vertices: apply a transformation matrix to position and normals
        if (transform) {
            let new_vertices = [], new_normals = [];
            let transform_mat3 = mat3.create();
            mat3.fromMat4(transform_mat3, transform);

            for (let i=0; i < N; i += 3) {
                let v = vertices.slice(i, i+3).concat(0);
                vec4.transformMat4(v, v, transform);
                v.pop();
                new_vertices = new_vertices.concat(v)
                v = normals.slice(i, i+3);
                vec3.transformMat3(v, v, transform_mat3);
                new_normals = new_normals.concat(v);
            }
            vertices = new_vertices;
            normals = new_normals;
        }

        // VAO
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        // Buffers
        this.vPos = this.#makeBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(vertices));
        this.vTex = this.#makeBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(texCoords));
        this.vNorm = this.#makeBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(normals));
        this.indices = this.#makeBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices));

        // Attributes
        this.#setAttribute(gl, this.vTex, Model.LOC_VTEX, 2);
        this.#setAttribute(gl, this.vPos, Model.LOC_VPOS, 3);
        this.#setAttribute(gl, this.vNorm, Model.LOC_VNORM, 3);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices); // Elements
    }
}
