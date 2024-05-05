#version 300 es
precision mediump float;

#define NUM_POINT_LIGHTS 2
#define NUM_DIR_LIGHTS 1
#define CUTOFF_SMOOTH 0.01

in vec3 fPos;
in vec3 fNorm;
in vec2 fTex;

out vec4 outColor;

struct Material {
    sampler2D diffuse, specular;
    float shininess;
};

struct Light {
    vec3 pos, dir;
    vec3 ambient, diffuse, specular;
    float constant, linear, quadratic;
    float cutoff; // point-light: cutoff = -1.0f
};

uniform vec4 color; 
uniform vec2 colorSat; // bg and fg color. x-component: foreground intensity
uniform vec3 viewPos;
uniform Material material;
uniform Light pointLight[NUM_POINT_LIGHTS+1];
uniform Light dirLight[NUM_DIR_LIGHTS+1];

vec3 calcDirLight(Light light, vec3 viewDir, vec3 texDiff);
vec3 calcPointLight(Light light, vec3 viewDir, vec3 texDiff);

void main() {
    vec3 result = vec3(0.0);
    vec4 tex = texture(material.diffuse, fTex);
    
    vec3 texDiff = mix(vec3(tex), vec3(color), (1.0 - tex.w) * colorSat.y); // background
    texDiff = mix(texDiff, vec3(color), colorSat.x); // foreground
    float alpha = max(tex.w, color.w * colorSat.y) * (1.0 - colorSat.x * (1.0 - color.w)); // opacity

    vec3 viewDir = normalize(viewPos-fPos);

    for (int i=0; i < NUM_POINT_LIGHTS; ++i)
        result += calcPointLight(pointLight[i], viewDir, texDiff);
    for (int i=0; i < NUM_DIR_LIGHTS; ++i)
        result += calcDirLight(dirLight[i], viewDir, texDiff);

    outColor = vec4(result, alpha);
}

vec3 calcDirLight(Light light, vec3 viewDir, vec3 texDiff) {
    // diffuse
    vec3 norm = normalize(fNorm);// changed to -norm for some reason
    vec3 lightDir = normalize(light.dir);
    float diff = max(dot(norm, lightDir), 0.0); 

    // specular
    vec3 reflectDir = -reflect(lightDir, norm);
    float spec = pow(max(dot(reflectDir, viewDir), 0.0), 128.0 * material.shininess);

    vec3 texSpec = vec3(texture(material.specular, fTex));

    vec3 ambient =  light.ambient * texDiff;
    vec3 diffuse =  light.diffuse * diff * texDiff;
    vec3 specular = light.specular * spec * texSpec;

    return ambient + diffuse + specular;
}

vec3 calcPointLight(Light light, vec3 viewDir, vec3 texDiff) {
    vec3 lightDir = -normalize(fPos-light.pos);
    float angle = -dot(lightDir, normalize(light.dir));

    if (light.cutoff < 0.0 || angle > light.cutoff) {
        float smoother = light.cutoff >= 0.0 ? min(1.0, (angle - light.cutoff) / CUTOFF_SMOOTH) : 1.0; // this is actually dependent on the cutoff angle, better way: extra uniform
        float d = length(light.pos - fPos);
        light.dir = lightDir;

        return smoother * calcDirLight(light, viewDir, texDiff) / (light.constant + light.linear * d + light.quadratic * d * d);

    } else {
        // ambient
        return light.ambient * texDiff;
    }
}
