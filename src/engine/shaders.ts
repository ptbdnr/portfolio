/**
 * The shaders. One full-screen pass draws the panorama (or two, mid-walk) and everything that
 * belongs to the camera: glare, lens ghosts, exposure, vignette and grain. A second, small pass
 * draws particles (dust in sunbeams, drizzle, birds far off) on top.
 */

export const FULLSCREEN_VERT = /* glsl */ `#version 300 es
out vec2 vNdc;
void main() {
  // One triangle that covers the screen.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
  vNdc = p;
  gl_Position = vec4(p, 0.0, 1.0);
}
`

export const PANORAMA_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vNdc;
out vec4 fragColor;

uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uFwd;
uniform vec2 uTan;
uniform float uAspect;
uniform float uTime;
uniform float uLod;

// Two panoramas, A and B; uMix blends from one to the other (walking, or the light changing).
uniform float uMix;
uniform sampler2D uLoA;
uniform sampler2D uHiA;
uniform sampler2D uLoB;
uniform sampler2D uHiB;
uniform float uHiMixA;
uniform float uHiMixB;
uniform float uYawA;   // radians: the camera's frame turned into each photo's own
uniform float uYawB;
uniform vec3 uOrgA;    // where the camera stands, metres from where each photo was taken
uniform vec3 uOrgB;
uniform vec2 uProxyA;  // eye height, distance to the surroundings (metres)
uniform vec2 uProxyB;
uniform vec4 uWaterA[4];   // yaw from, yaw to, pitch from, pitch to (degrees)
uniform vec4 uWaterB[4];
uniform vec4 uWaterStrA;
uniform vec4 uWaterStrB;

uniform vec3 uSunA;
uniform vec3 uSunB;
uniform float uSunKA;
uniform float uSunKB;
uniform vec3 uSunColor;
uniform vec2 uSunNdc;
uniform float uFlare;

uniform vec3 uMeteorTail;
uniform vec3 uMeteorHead;
uniform float uMeteor;

uniform float uExposure;
uniform float uSaturation;
uniform float uDim;
uniform float uVignette;
uniform float uGrain;
uniform vec4 uFade;

const float PI = 3.14159265359;

vec3 rotY(vec3 d, float a) {
  float c = cos(a), s = sin(a);
  return vec3(d.x * c - d.z * s, d.y, d.x * s + d.z * c);
}

// The photo is treated as painted on the ground (a plane at eye height below) and on a sphere around
// it. Seen from a little way off the spot where it was taken, that gives the parallax of walking.
vec3 proxy(vec3 o, vec3 d, vec2 p) {
  float t = 1e5;
  if (d.y < -1e-4) t = (-p.x - o.y) / d.y;
  float b = dot(o, d);
  float c = dot(o, o) - p.y * p.y;
  float ts = -b + sqrt(max(b * b - c, 0.0));
  return normalize(o + d * min(t, ts));
}

vec2 toUv(vec3 d) {
  return vec2(atan(d.x, -d.z) / (2.0 * PI) + 0.5, 0.5 - asin(clamp(d.y, -1.0, 1.0)) / PI);
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float waterMask(vec2 yp, vec4 box) {
  if (box.y <= box.x) return 0.0;
  float c = 0.5 * (box.x + box.y), hw = 0.5 * (box.y - box.x);
  float dy = abs(mod(yp.x - c + 540.0, 360.0) - 180.0);
  return (1.0 - smoothstep(hw - 5.0, hw, dy)) * smoothstep(box.z, box.z + 1.5, yp.y) * (1.0 - smoothstep(box.w - 0.6, box.w, yp.y));
}

vec3 pano(sampler2D lo, sampler2D hi, float hiMix, vec3 d, vec4 water[4], vec4 strength, out float glint) {
  vec2 uv = toUv(d);
  // The seam where the photo's left and right edges meet: take whichever texture coordinates
  // change smoothly across a pixel, so the mipmap choice doesn't jump there.
  vec2 uv2 = vec2(fract(uv.x + 0.5), uv.y);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec2 dx2 = dFdx(uv2), dy2 = dFdy(uv2);
  if (dot(dx2, dx2) + dot(dy2, dy2) < dot(dx, dx) + dot(dy, dy)) { dx = dx2; dy = dy2; }
  float k = exp2(uLod);
  dx *= k;
  dy *= k;

  glint = 0.0;
  vec2 yp = vec2((uv.x - 0.5) * 360.0, (0.5 - uv.y) * 180.0);
  float m = 0.0;
  for (int i = 0; i < 4; i++) m = max(m, waterMask(yp, water[i]) * strength[i]);
  if (m > 0.001) {
    // Ripples drawn on the water's surface (in metres), so they shrink with distance.
    float below = max(-yp.y, 0.4) * PI / 180.0;
    float r = min(1.6 / tan(below), 400.0);
    vec2 P = vec2(sin(yp.x * PI / 180.0), cos(yp.x * PI / 180.0)) * r;
    float t = uTime;
    float n1 = vnoise(P * 0.9 + vec2(t * 0.35, t * 0.2)) + 0.5 * vnoise(P * 2.1 - vec2(t * 0.5, -t * 0.3));
    float n2 = vnoise(P * 0.9 + vec2(13.1 - t * 0.25, 7.7 + t * 0.3)) + 0.5 * vnoise(P * 2.3 + vec2(t * 0.4, t * 0.45));
    float fade = 1.0 / (1.0 + r / 50.0);
    float amp = (0.06 + 0.018 * min(-yp.y, 25.0)) * fade * m;
    uv += vec2((n1 - 0.75) * amp / 360.0 * 0.5, (n2 - 0.75) * amp / 180.0);
    glint = m * pow(vnoise(P * 5.0 + vec2(t * 1.1, -t * 0.8)), 14.0) * (0.3 + fade);
  }

  vec3 c;
  if (hiMix >= 0.999) c = textureGrad(hi, uv, dx, dy).rgb;
  else if (hiMix <= 0.001) c = textureGrad(lo, uv, dx, dy).rgb;
  else c = mix(textureGrad(lo, uv, dx, dy).rgb, textureGrad(hi, uv, dx, dy).rgb, hiMix);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return c + c * glint * smoothstep(0.25, 0.9, l) * 6.0;
}

float halo(vec3 d, vec3 s, float k) {
  float c = max(dot(d, s), 0.0);
  return k * (0.03 * pow(c, 5.0) + 0.1 * pow(c, 64.0) + 0.6 * pow(c, 3000.0));
}

vec3 toSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

const float GHOST_T[5] = float[5](0.4, 0.75, 1.2, 1.5, 1.95);
const float GHOST_R[5] = float[5](0.03, 0.08, 0.045, 0.15, 0.065);
const vec3 GHOST_C[5] = vec3[5](vec3(1.0, 0.65, 0.35), vec3(0.35, 0.6, 1.0), vec3(0.6, 1.0, 0.55), vec3(0.55, 0.45, 1.0), vec3(1.0, 0.85, 0.55));

void main() {
  vec3 d = normalize(uRight * (vNdc.x * uTan.x) + uUp * (vNdc.y * uTan.y) + uFwd);

  vec3 col = vec3(0.0);
  float gA = 0.0, gB = 0.0;
  if (uMix < 0.999) col = pano(uLoA, uHiA, uHiMixA, proxy(uOrgA, rotY(d, uYawA), uProxyA), uWaterA, uWaterStrA, gA);
  if (uMix > 0.001) {
    vec3 b = pano(uLoB, uHiB, uHiMixB, proxy(uOrgB, rotY(d, uYawB), uProxyB), uWaterB, uWaterStrB, gB);
    col = uMix >= 0.999 ? b : mix(col, b, uMix);
  }

  // Light scattered around the sun, in the eye and the lens.
  col += uSunColor * (halo(d, uSunA, uSunKA) * (1.0 - uMix) + halo(d, uSunB, uSunKB) * uMix);
  if (uFlare > 0.001) {
    vec2 axis = -uSunNdc;
    vec3 f = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      vec2 q = (vNdc - (uSunNdc + axis * GHOST_T[i])) * vec2(uAspect, 1.0);
      float r = GHOST_R[i];
      f += GHOST_C[i] * smoothstep(r, r * 0.55, length(q)) * (0.6 + 0.4 * smoothstep(r * 0.5, r, length(q)));
    }
    col += f * 0.035 * uFlare;
  }

  if (uMeteor > 0.001) {
    vec3 n = normalize(cross(uMeteorTail, uMeteorHead));
    float off = dot(d, n);
    vec3 dp = normalize(d - n * off);
    float ta = acos(clamp(dot(dp, uMeteorTail), -1.0, 1.0));
    float tb = acos(clamp(dot(dp, uMeteorHead), -1.0, 1.0));
    float tab = acos(clamp(dot(uMeteorTail, uMeteorHead), -1.0, 1.0));
    float along = clamp(1.0 - tb / max(tab, 1e-4), 0.0, 1.0);
    float on = 1.0 - smoothstep(tab, tab + 0.002, ta + tb);
    float w = 0.0007 + 0.0005 * along;
    col += vec3(0.85, 0.92, 1.0) * exp(-off * off / (w * w)) * along * along * on * uMeteor * 1.6;
  }

  col *= uExposure;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSaturation) * (1.0 - uDim);
  // A soft shoulder above the photo's own highlights, for the glare added on top.
  col = mix(col, 0.8 + 0.2 * (1.0 - exp(-(col - 0.8) / 0.2)), step(0.8, col));
  float v = length(vNdc * vec2(1.0, 0.82));
  col *= mix(1.0, smoothstep(1.75, 0.45, v), uVignette);

  vec3 s = toSrgb(col);
  float g = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 517.0) - 0.5;
  s += g * (uGrain * (0.35 + 0.65 * (1.0 - abs(l * 2.0 - 1.0))) + 1.0 / 255.0);
  fragColor = vec4(mix(s, uFade.rgb, uFade.a), 1.0);
}
`

export const PARTICLE_VERT = /* glsl */ `#version 300 es
layout(location = 0) in vec4 aPos;    // xyz: metres from the camera; w: size in metres
layout(location = 1) in vec4 aColor;  // premultiplied
layout(location = 2) in vec2 aShape;  // x: shape; y: angle or wing phase
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uFwd;
uniform vec2 uTan;
uniform float uFocal;   // device pixels
out vec4 vColor;
out vec2 vShape;
void main() {
  vec3 p = aPos.xyz;
  float z = dot(p, uFwd);
  if (z < 0.08) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  gl_Position = vec4(dot(p, uRight) / (z * uTan.x), dot(p, uUp) / (z * uTan.y), 0.0, 1.0);
  float px = aPos.w / z * uFocal;
  gl_PointSize = clamp(px, 1.5, 96.0);
  vColor = aColor * clamp(px / 1.5, 0.0, 1.0);
  vShape = aShape;
}
`

export const PARTICLE_FRAG = /* glsl */ `#version 300 es
precision mediump float;
in vec4 vColor;
in vec2 vShape;
out vec4 fragColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float a;
  if (vShape.x < 0.5) {
    a = 1.0 - smoothstep(0.0, 1.0, length(q));
    a *= a;
  } else if (vShape.x < 1.5) {
    // A streak: rain seen moving.
    float c = cos(vShape.y), s = sin(vShape.y);
    vec2 r = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
    a = (1.0 - smoothstep(0.0, 0.1, abs(r.x))) * (1.0 - smoothstep(0.5, 1.0, abs(r.y)));
  } else if (vShape.x < 2.5) {
    // A seed head: a bright core and faint threads.
    float r = length(q);
    a = (1.0 - smoothstep(0.0, 0.28, r)) + 0.3 * (1.0 - smoothstep(0.3, 1.0, r)) * (0.5 + 0.5 * cos(atan(q.y, q.x) * 9.0));
  } else {
    // A bird, wings beating.
    float flap = sin(vShape.y) * 0.55;
    float x = abs(q.x);
    float wing = -q.y - (flap * x - 0.45 * x * x);
    a = (1.0 - smoothstep(0.05, 0.12, abs(wing))) * (1.0 - smoothstep(0.85, 0.95, x));
    a = max(a, 1.0 - smoothstep(0.08, 0.16, length(q * vec2(1.0, 1.6))));
  }
  fragColor = vColor * a;
}
`
