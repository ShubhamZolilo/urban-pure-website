/* Urban Pure. The caustic light field.
   ------------------------------------------------------------------------
   Water caustics are soft by nature, so this renders at postage-stamp
   resolution into an ImageData buffer and lets the browser upscale it across
   the viewport. That keeps the whole effect at a few thousand pixels a frame.

   It is decorative and entirely optional. If anything here refuses to run,
   reduced motion, a weak device, no 2D context, the canvas simply stays at
   opacity 0 and the CSS gradient underneath carries the page.
   ------------------------------------------------------------------------ */

(function (global) {
  'use strict';

  var canvas = document.getElementById('caustics');
  var api = { setLight: function () {} };
  global.UPCaustics = api;

  if (!canvas) { return; }

  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var weak = (navigator.hardwareConcurrency || 8) <= 2 ||
             (navigator.deviceMemory || 8) <= 2;

  if (still || weak) { return; }

  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) { return; }

  var W = 0, H = 0, img = null, buf = null;
  var US = 11, VS = 7;   /* field units across and down; see size() */
  var depth = 0, warmth = 0;
  var running = false, faded = false;
  var last = 0, clock = 0;

  var FRAME = 1000 / 30;   /* the field drifts slowly; 30fps is indulgent */
  var MAX_STEP = 60;       /* never integrate a whole backgrounded tab at once */

  /* Aqua underwater, warm once the page breaks the surface. */
  var COOL = [86, 200, 196];
  var WARM = [255, 214, 158];

  function size() {
    var vw = global.innerWidth || 1;
    var vh = global.innerHeight || 1;

    W = 200;
    H = Math.max(60, Math.min(340, Math.round(W * (vh / vw))));

    /* Tie the field to physical size, not to the canvas. Counting a fixed number
       of cells across would pack the same pattern into a 390px phone as into a
       1440px desktop, and the caustics would read twice as dense on mobile.
       Deriving VS from the aspect keeps the cells square either way. */
    US = Math.max(5, Math.min(14, 11 * (vw / 1440)));
    VS = US * (vh / vw);

    canvas.width = W;
    canvas.height = H;
    img = ctx.createImageData(W, H);
    buf = img.data;
  }

  function draw(t) {
    /* The field belongs to the hero. It thins out as the page descends, and
       retreats again as the page breaks the surface, so by the shop you are out
       of the water, so there is no caustic light left to cast. */
    var fade = (1 - depth * 0.88) * (1 - warmth * 0.85);
    if (fade <= 0.02) { return; }

    var r = Math.round(COOL[0] + (WARM[0] - COOL[0]) * warmth);
    var g = Math.round(COOL[1] + (WARM[1] - COOL[1]) * warmth);
    var b = Math.round(COOL[2] + (WARM[2] - COOL[2]) * warmth);

    var i = 0;

    for (var y = 0; y < H; y++) {
      var v = (y / H) * VS;

      /* Light enters from above, so the field thins out as it goes down. */
      var falloff = 1 - (y / H) * 0.75;

      var sv1 = Math.sin(v * 2.13 - t * 0.44);
      var sv2 = v * 1.31;
      var sv3 = v * 1.87;

      for (var x = 0; x < W; x++) {
        /* Cell scale. Too low and the filaments thicken into glowing tubes; too
           high and the net closes up into cellular blobs. Around 11 at desktop
           width gives the handful of big irregular cells you see on a pool
           floor. */
        var u = (x / W) * US;

        var a = Math.sin(u * 1.7 + t * 0.61) + sv1;
        var c = Math.sin(u * 1.31 + sv2 + t * 0.83) +
                Math.sin(u * 1.87 - sv3 - t * 0.52);

        var s = Math.sin(a * 1.45 + c * 1.1 + t * 0.27);

        /* |s|^20. This is what turns a smooth wave into thin bright filaments
           rather than broad bands. Repeated squaring beats Math.pow, and every
           even power is already positive, so no abs() is needed. */
        var s2 = s * s;
        var s4 = s2 * s2;
        var s8 = s4 * s4;
        var k = s8 * s8 * s4;

        buf[i]     = r;
        buf[i + 1] = g;
        buf[i + 2] = b;
        buf[i + 3] = (k * falloff * fade * 62) | 0;

        i += 4;
      }
    }

    ctx.putImageData(img, 0, 0);

    if (!faded) { faded = true; canvas.style.opacity = '1'; }
  }

  function loop(now) {
    if (!running) { return; }
    requestAnimationFrame(loop);

    var dt = now - last;
    if (dt < FRAME) { return; }

    last = now;
    clock += Math.min(dt, MAX_STEP) / 1000;
    draw(clock);
  }

  function start() {
    if (running || document.hidden) { return; }
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
  }

  api.setLight = function (nextDepth, nextWarmth) {
    depth = nextDepth;
    warmth = nextWarmth;
  };

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stop(); } else { start(); }
  });

  var resizeTimer;
  global.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(size, 200);
  });

  size();
  start();

}(window));
