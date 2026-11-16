/** Small WebGL2 helpers: compiling programs, uniforms, a full-screen triangle and textures. */

export type Program = {
  program: WebGLProgram
  uniform: (name: string) => WebGLUniformLocation | null
  attrib: (name: string) => number
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader didn't compile: ${log}`)
  }
  return shader
}

export function createProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string): Program {
  const program = gl.createProgram()!
  const vs = compile(gl, gl.VERTEX_SHADER, vertex)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment)
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error(`Program didn't link: ${gl.getProgramInfoLog(program)}`)
  }
  const uniforms = new Map<string, WebGLUniformLocation | null>()
  const attribs = new Map<string, number>()
  return {
    program,
    uniform(name) {
      if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name))
      return uniforms.get(name)!
    },
    attrib(name) {
      if (!attribs.has(name)) attribs.set(name, gl.getAttribLocation(program, name))
      return attribs.get(name)!
    },
  }
}

/** Texture for a panorama: sRGB (so filtering and blending happen in linear light), mipmapped, wrapping sideways. */
export function createPanoramaTexture(gl: WebGL2RenderingContext, image: TexImageSource & { width: number; height: number }, anisotropy: number) {
  const texture = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, texture)
  const levels = Math.floor(Math.log2(Math.max(image.width, image.height))) + 1
  gl.texStorage2D(gl.TEXTURE_2D, levels, gl.SRGB8_ALPHA8, image.width, image.height)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, image)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  if (anisotropy > 1) gl.texParameterf(gl.TEXTURE_2D, 0x84fe /* TEXTURE_MAX_ANISOTROPY_EXT */, anisotropy)
  return texture
}

/** A 1×1 placeholder so every sampler always has something bound. */
export function createBlankTexture(gl: WebGL2RenderingContext, rgba: [number, number, number, number] = [12, 14, 18, 255]) {
  const texture = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return texture
}

export function maxAnisotropy(gl: WebGL2RenderingContext) {
  const ext = gl.getExtension('EXT_texture_filter_anisotropic')
  return ext ? Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number) : 1
}
