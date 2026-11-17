// Store build boot: a plain script (no modules, no three.js) that runs before the game loads. The packaged app must go
// straight into VR and show head-tracked graphics within 4 s (VRC.Quest.Performance.3), but three.js and the game take
// longer than that to download on a first launch. So this asks for the VR session at once and draws a small "loading"
// card fixed in the room with raw WebGL; game.js takes the same session over when it is ready (window.__boot.take()).
// In an ordinary browser tab the request needs a tap, so the page shows ENTER VR, which calls __boot.start().
// ?classic=1 keeps the old 2D start screen (development, the headless tests).
(function () {
  var Q = new URLSearchParams(location.search), store = !Q.get('classic');
  var B = window.__boot = { store: store, session: null, taken: false, failed: '', listeners: [] };
  if (store) document.documentElement.classList.add('store');
  if (!store || !navigator.xr) return;

  var gl = null, layer = null, ref = null, prog = null, tex = null, buf = null, card = null, anchor = null, t0 = 0, dots = -1;
  var FEAT = { optionalFeatures: ['local-floor', 'bounded-floor'] };

  function drawCard(n) {   // the text on the card, redrawn as the dots move
    var c = card || (card = document.createElement('canvas')); c.width = 1024; c.height = 512; var g = c.getContext('2d');
    g.fillStyle = '#0c1118'; g.fillRect(0, 0, 1024, 512); g.strokeStyle = '#3a6ea5'; g.lineWidth = 8; g.strokeRect(8, 8, 1008, 496);
    g.fillStyle = '#e8eef5'; g.textAlign = 'center'; g.font = 'bold 96px sans-serif'; g.fillText("YOU CAN'T HIDE", 512, 200);
    g.fillStyle = '#7dffa0'; g.font = 'bold 44px sans-serif'; g.fillText('LOADING' + '...'.slice(0, n), 512, 310);
    g.fillStyle = '#8fb4dc'; g.font = '30px sans-serif'; g.fillText(B.failed || 'First launch downloads the game once (about 40 MB).', 512, 400);
    return c;
  }
  function viewMatrix(t) {   // inverse of a rigid transform (rotation + translation); XRRigidTransform.inverse when there is one
    if (t.inverse) return t.inverse.matrix; var m = t.matrix, r = new Float32Array(16);
    r[0] = m[0]; r[1] = m[4]; r[2] = m[8]; r[4] = m[1]; r[5] = m[5]; r[6] = m[9]; r[8] = m[2]; r[9] = m[6]; r[10] = m[10]; r[15] = 1;
    r[12] = -(r[0] * m[12] + r[4] * m[13] + r[8] * m[14]); r[13] = -(r[1] * m[12] + r[5] * m[13] + r[9] * m[14]); r[14] = -(r[2] * m[12] + r[6] * m[13] + r[10] * m[14]);
    return r;
  }
  function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  function setupGL() {
    var cv = document.createElement('canvas');
    gl = cv.getContext('webgl2', { xrCompatible: true, antialias: false }) || cv.getContext('webgl', { xrCompatible: true, antialias: false });
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, 'attribute vec2 p;uniform mat4 P,V,M;varying vec2 uv;void main(){uv=vec2(p.x+.5,.5-p.y);gl_Position=P*V*M*vec4(p.x*1.6,p.y*.8,0.,1.);}'));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, 'precision mediump float;uniform sampler2D T;varying vec2 uv;void main(){gl_FragColor=texture2D(T,uv);}'));
    gl.linkProgram(prog);
    buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5, -.5, .5, -.5, -.5, .5, .5, .5]), gl.STATIC_DRAW);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  function frame(t, f) {
    var s = B.session; if (!s || B.taken) return; s.requestAnimationFrame(frame);
    var pose = ref && f.getViewerPose(ref); if (!pose) return;
    if (!anchor) {   // place the card 2 m ahead of where the player first looks, level, at eye height: it then stays put
      var o = pose.transform.position, q = pose.transform.orientation, fx = -2 * (q.x * q.z + q.w * q.y), fz = -(1 - 2 * (q.x * q.x + q.y * q.y)), l = Math.hypot(fx, fz) || 1;
      fx /= l; fz /= l; var yaw = Math.atan2(-fx, -fz), c = Math.cos(yaw), sn = Math.sin(yaw);
      anchor = new Float32Array([c, 0, -sn, 0, 0, 1, 0, 0, sn, 0, c, 0, o.x + fx * 2, o.y, o.z + fz * 2, 1]); t0 = t;
    }
    var n = Math.floor((t - t0) / 400) % 4; if (n !== dots) { dots = n; gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, drawCard(n)); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer); gl.clearColor(0.03, 0.05, 0.09, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog); gl.bindBuffer(gl.ARRAY_BUFFER, buf); var pl = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'M'), false, anchor);
    for (var i = 0; i < pose.views.length; i++) {
      var v = pose.views[i], vp = layer.getViewport(v); gl.viewport(vp.x, vp.y, vp.width, vp.height);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'P'), false, v.projectionMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'V'), false, viewMatrix(v.transform));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
  function onSession(s) {
    B.session = s; setupGL();
    s.addEventListener('end', function () { B.session = null; if (!B.taken) B.emit('end'); });
    return gl.makeXRCompatible ? gl.makeXRCompatible() : Promise.resolve();
  }
  B.emit = function (what) { for (var i = 0; i < B.listeners.length; i++) try { B.listeners[i](what); } catch (e) { } };
  B.on = function (fn) { B.listeners.push(fn); if (B.session) fn('session'); };
  B.start = function () {   // call from a tap when the automatic request was refused
    if (B.session || B.pending) return B.pending;
    return B.pending = navigator.xr.requestSession('immersive-vr', FEAT).then(function (s) {
      return onSession(s).then(function () {
        layer = new XRWebGLLayer(s, gl); s.updateRenderState({ baseLayer: layer });
        return s.requestReferenceSpace('local-floor').catch(function () { return s.requestReferenceSpace('local'); });
      }).then(function (r) { ref = r; s.requestAnimationFrame(frame); B.pending = null; B.emit('session'); return s; });
    }).catch(function (e) { B.pending = null; B.failed = String(e && e.message || e); B.emit('refused'); throw e; });
  };
  // game.js: stop drawing the card and hand the session over to three.js
  B.take = function () { B.taken = true; return B.session; };
  // the packaged app counts the icon tap as the user's action, so this succeeds there; a browser tab refuses it
  B.auto = B.start().catch(function () { });
})();
