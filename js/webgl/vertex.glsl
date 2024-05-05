#version 300 es

layout(location = 0) in vec3 vPos;
layout(location = 1) in vec3 vNorm;
layout(location = 2) in vec2 vTex;

out vec2 fTex;
out vec3 fPos, fNorm;

uniform mat4 normal; // later make it a mat3
uniform mat4 model, projView;

void main() {
    fTex = vTex;
    mat3 normal = mat3(normal);
    fNorm = normal * vNorm;
    vec4 worldPos = model * vec4(vPos, 1.0);
    fPos = vec3(worldPos);

    gl_Position = projView * worldPos;
}