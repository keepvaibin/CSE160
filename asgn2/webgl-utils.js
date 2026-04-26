function initShaders(glContext, vshaderSource, fshaderSource) {
  var vertexShader = loadShader(glContext, glContext.VERTEX_SHADER, vshaderSource);
  var fragmentShader = loadShader(glContext, glContext.FRAGMENT_SHADER, fshaderSource);

  if (!vertexShader || !fragmentShader) {
    return false;
  }

  var program = glContext.createProgram();
  if (!program) {
    return false;
  }

  glContext.attachShader(program, vertexShader);
  glContext.attachShader(program, fragmentShader);
  glContext.linkProgram(program);

  var linked = glContext.getProgramParameter(program, glContext.LINK_STATUS);
  if (!linked) {
    var error = glContext.getProgramInfoLog(program);
    console.log('Failed to link program: ' + error);
    glContext.deleteProgram(program);
    glContext.deleteShader(fragmentShader);
    glContext.deleteShader(vertexShader);
    return false;
  }

  glContext.useProgram(program);
  glContext.program = program;
  return true;
}

function loadShader(glContext, type, source) {
  var shader = glContext.createShader(type);
  if (shader === null) {
    console.log('Unable to create shader');
    return null;
  }

  glContext.shaderSource(shader, source);
  glContext.compileShader(shader);

  var compiled = glContext.getShaderParameter(shader, glContext.COMPILE_STATUS);
  if (!compiled) {
    var error = glContext.getShaderInfoLog(shader);
    console.log('Failed to compile shader: ' + error);
    glContext.deleteShader(shader);
    return null;
  }

  return shader;
}
