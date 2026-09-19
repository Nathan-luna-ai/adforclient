/* ------------------------------------------------------------------
   sfx.js — moteur d'effets sonores pour les publicités HT Construction

   Aucune musique : uniquement des matières synthétisées. Ce qui donne
   la qualité, ce n'est pas la mélodie, c'est la façon dont chaque son
   est construit :

     1. ANTICIPATION  un souffle qui commence AVANT la coupe et culmine
                      dessus. C'est ce qui fait qu'une coupe paraît
                      voulue plutôt qu'accidentelle.
     2. IMPACT        jamais un seul oscillateur : un grave, un corps,
                      un transitoire aigu, superposés.
     3. QUEUE         une vraie réverbération à convolution, avec une
                      réponse impulsionnelle générée ici même. La queue
                      déborde sur le plan suivant et relie les deux.
     4. ESPACE        stéréo. Les souffles traversent l'image d'une
                      oreille à l'autre dans le sens du mouvement.

   Tout est routé : source -> pan -> sortie sèche
                           -> départ réverbe -> convolution -> sortie
   ------------------------------------------------------------------ */
(function (g) {
  var ctx = null, comp = null, master = null, conv = null, noiseBuf = null;
  var live = [], beds = [], muted = false, enabled = true, peakVal = 0;

  function makeIR(dur, decay, damp) {
    var len = Math.floor(ctx.sampleRate * dur);
    var ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = ir.getChannelData(c), run = 0;
      for (var i = 0; i < len; i++) {
        var white = Math.random() * 2 - 1;
        run = run + damp * (white - run);            // assombrit la queue
        d[i] = run * Math.pow(1 - i / len, decay);
      }
    }
    return ir;
  }

  function ensure() {
    if (ctx) return ctx;
    var AC = g.AudioContext || g.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -13; comp.ratio.value = 4.5;
    comp.attack.value = 0.003; comp.release.value = 0.16;

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    comp.connect(master); master.connect(ctx.destination);

    conv = ctx.createConvolver();
    conv.buffer = makeIR(1.9, 3.1, 0.34);
    var revLP = ctx.createBiquadFilter();
    revLP.type = 'lowpass'; revLP.frequency.value = 3400;
    var revG = ctx.createGain(); revG.gain.value = 0.9;
    conv.connect(revLP); revLP.connect(revG); revG.connect(comp);

    var n = Math.floor(ctx.sampleRate * 1.4);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function ok() { return enabled && !muted && ensure(); }
  function reg(node, secs) {
    live.push(node);
    setTimeout(function () {
      var i = live.indexOf(node); if (i > -1) live.splice(i, 1);
    }, secs * 1000 + 150);
  }
  function hitPeak(v) { peakVal = Math.max(peakVal, Math.min(1, v * 1.6)); }

  /* routage commun : pan (fixe ou mobile) + départ réverbe */
  function route(node, o) {
    var t = ctx.currentTime, last = node;
    if (ctx.createStereoPanner && (o.pan !== undefined || o.panTo !== undefined)) {
      var p = ctx.createStereoPanner();
      var from = o.pan === undefined ? 0 : o.pan;
      p.pan.setValueAtTime(from, t);
      if (o.panTo !== undefined) p.pan.linearRampToValueAtTime(o.panTo, t + (o.panDur || 0.4));
      last.connect(p); last = p;
    }
    last.connect(comp);
    if (o.send) {
      var s = ctx.createGain(); s.gain.value = o.send;
      last.connect(s); s.connect(conv);
    }
  }
  function env(g2, peak, att, dec) {
    var t = ctx.currentTime;
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + att);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
  }
  function noise() { var s = ctx.createBufferSource(); s.buffer = noiseBuf; return s; }

  var A = {};

  /* Capacité du navigateur — ne construit AUCUN contexte.
     Important : un AudioContext créé hors d'un geste de l'utilisateur est
     suspendu par le navigateur, et le réveiller est asynchrone. On ne le
     crée donc qu'au premier clic, et on attend qu'il soit vraiment prêt
     avant de lancer la lecture. */
  A.supported = function () { return !!(g.AudioContext || g.webkitAudioContext); };
  A.state = function () { return ctx ? ctx.state : 'idle'; };
  A.ready = function () { return !!ensure(); };

  A.resume = function (cb) {
    if (!ensure()) { if (cb) cb(); return; }
    if (ctx.state === 'suspended') {
      var p = ctx.resume();
      if (p && p.then) { p.then(function () { if (cb) cb(); }, function () { if (cb) cb(); }); }
      else if (cb) cb();
    } else if (cb) cb();
  };

  /* Preuve audible en un clic, indépendante de la ligne de temps. */
  A.test = function () {
    A.resume(function () {
      A.hit({ peak: 0.55, f0: 155, f1: 36, dec: 0.55, send: 0.4 });
      setTimeout(function () { A.mallet({ freq: 392, peak: 0.1, dec: 1.2, pan: 0.25 }); }, 260);
      setTimeout(function () { A.whoosh({ dur: 0.3, peak: 0.09, pan: -0.6, panTo: 0.6 }); }, 520);
    });
  };
  A.enable = function (on) { enabled = !!on; if (!enabled) A.kill(); };
  A.mute = function (m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 0.85;
    if (muted) A.kill();
  };
  A.kill = function () {
    live.forEach(function (n) { try { n.stop(); } catch (e) {} });
    beds.forEach(function (n) { try { n.stop(); } catch (e) {} });
    live = []; beds = [];
  };
  A.peak = function () { var p = peakVal; peakVal *= 0.82; return p; };

  /* ---------------- ANTICIPATION ----------------
     Commence avant la coupe, culmine dessus. Le pan traverse l'image. */
  A.whoosh = function (o) {
    if (!ok()) return;
    o = o || {};
    var dur = o.dur || 0.4, t = ctx.currentTime;
    var s = noise(), bp = ctx.createBiquadFilter(), g2 = ctx.createGain();
    bp.type = 'bandpass'; bp.Q.value = o.q || 1.3;
    bp.frequency.setValueAtTime(o.from || 320, t);
    bp.frequency.exponentialRampToValueAtTime(o.to || 4200, t + dur);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(o.peak || 0.09, t + dur * 0.94);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    s.connect(bp); bp.connect(g2);
    route(g2, { pan: o.pan === undefined ? -0.55 : o.pan,
                panTo: o.panTo === undefined ? 0.55 : o.panTo,
                panDur: dur, send: o.send === undefined ? 0.3 : o.send });
    s.start(); s.stop(t + dur + 0.25); reg(s, dur + 0.25);
  };

  /* Souffle inversé : monte en s'ouvrant, pour la grande bascule. */
  A.reverseSwell = function (o) {
    if (!ok()) return;
    o = o || {};
    var dur = o.dur || 0.9, t = ctx.currentTime;
    var s = noise(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g2 = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.setValueAtTime(180, t);
    hp.frequency.exponentialRampToValueAtTime(1100, t + dur);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(9000, t + dur);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.setTargetAtTime(o.peak || 0.14, t, dur * 0.55);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.07);
    s.connect(hp); hp.connect(lp); lp.connect(g2);
    route(g2, { pan: 0, send: 0.42 });
    s.start(); s.stop(t + dur + 0.3); reg(s, dur + 0.3);
  };

  /* ---------------- IMPACT ----------------
     Trois couches : grave, corps, transitoire. */
  A.hit = function (o) {
    if (!ok()) return;
    o = o || {};
    var t = ctx.currentTime, peak = o.peak || 0.55, dec = o.dec || 0.5;
    hitPeak(peak);

    var sub = ctx.createOscillator(), sg = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(o.f0 || 140, t);
    sub.frequency.exponentialRampToValueAtTime(o.f1 || 38, t + dec * 0.8);
    env(sg, peak, 0.005, dec);
    sub.connect(sg);
    route(sg, { pan: o.pan || 0, send: o.send === undefined ? 0.16 : o.send });
    sub.start(); sub.stop(t + dec + 0.35); reg(sub, dec + 0.35);

    var b = noise(), lp = ctx.createBiquadFilter(), bg = ctx.createGain();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(o.body || 1700, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + dec * 0.55);
    env(bg, peak * 0.38, 0.003, dec * 0.55);
    b.connect(lp); lp.connect(bg);
    route(bg, { pan: o.pan || 0, send: o.send === undefined ? 0.26 : o.send });
    b.start(); b.stop(t + dec + 0.2); reg(b, dec + 0.2);

    if (o.top !== false) {
      var k = noise(), bp = ctx.createBiquadFilter(), kg = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = o.topF || 2600; bp.Q.value = 1.1;
      env(kg, peak * 0.3, 0.001, 0.05);
      k.connect(bp); bp.connect(kg);
      route(kg, { pan: o.pan || 0, send: 0.2 });
      k.start(); k.stop(t + 0.18); reg(k, 0.18);
    }
  };

  /* ---------------- MATIÈRES ---------------- */
  A.hammer = function (o) {
    o = o || {};
    A.hit({ f0: 128, f1: 41, peak: o.peak || 0.55, dec: 0.26,
            body: 2300, topF: 3100, pan: o.pan || 0, send: 0.22 });
  };
  A.wood = function (o) {
    if (!ok()) return;
    o = o || {};
    var t = ctx.currentTime, f = o.freq || 800, peak = o.peak || 0.3;
    hitPeak(peak);
    var osc = ctx.createOscillator(), g2 = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.72, t + 0.06);
    env(g2, peak, 0.003, 0.085);
    osc.connect(g2);
    route(g2, { pan: o.pan || 0, send: o.send === undefined ? 0.26 : o.send });
    osc.start(); osc.stop(t + 0.25); reg(osc, 0.25);

    var s = noise(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = f * 2.6; bp.Q.value = 2.2;
    env(ng, peak * 0.34, 0.001, 0.035);
    s.connect(bp); bp.connect(ng);
    route(ng, { pan: o.pan || 0, send: 0.2 });
    s.start(); s.stop(t + 0.14); reg(s, 0.14);
  };
  A.drill = function (o) {
    if (!ok()) return;
    o = o || {};
    var t = ctx.currentTime, dur = o.dur || 0.24, f = o.freq || 140, peak = o.peak || 0.2;
    hitPeak(peak);
    var osc = ctx.createOscillator(), g2 = ctx.createGain(), lp = ctx.createBiquadFilter();
    osc.type = 'sawtooth'; osc.frequency.value = f;
    lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(2600, t + dur * 0.7);
    var lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.type = 'square'; lfo.frequency.value = 34; lg.gain.value = f * 0.12;
    lfo.connect(lg); lg.connect(osc.frequency);
    env(g2, peak, 0.01, dur);
    osc.connect(lp); lp.connect(g2);
    route(g2, { pan: o.pan || 0, send: 0.3 });
    osc.start(); lfo.start();
    osc.stop(t + dur + 0.15); lfo.stop(t + dur + 0.15);
    reg(osc, dur + 0.15); reg(lfo, dur + 0.15);
  };
  A.scrape = function (o) {
    if (!ok()) return;
    o = o || {};
    var t = ctx.currentTime, peak = o.peak || 0.2;
    hitPeak(peak);
    var s = noise(), bp = ctx.createBiquadFilter(), g2 = ctx.createGain();
    bp.type = 'bandpass'; bp.Q.value = 3.2;
    bp.frequency.setValueAtTime(3200, t);
    bp.frequency.exponentialRampToValueAtTime(420, t + 0.5);
    env(g2, peak, 0.02, 0.5);
    s.connect(bp); bp.connect(g2);
    route(g2, { pan: o.pan || 0.3, panTo: -0.2, panDur: 0.5, send: 0.34 });
    s.start(); s.stop(t + 0.75); reg(s, 0.75);
  };
  A.mallet = function (o) {
    if (!ok()) return;
    o = o || {};
    var t = ctx.currentTime, f = o.freq || 220, peak = o.peak || 0.09, dec = o.dec || 1;
    hitPeak(peak * 1.4);
    [1, 2.01, 3.02].forEach(function (m, i) {
      var osc = ctx.createOscillator(), g2 = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = f * m;
      env(g2, peak / (i * 2.2 + 1), 0.006, dec / (i * 0.7 + 1));
      osc.connect(g2);
      route(g2, { pan: o.pan || 0, send: o.send === undefined ? 0.42 : o.send });
      osc.start(); osc.stop(t + dec + 0.4); reg(osc, dec + 0.4);
    });
  };
  A.air = function (o) {
    if (!ok()) return;
    o = o || {};
    var t = ctx.currentTime;
    var s = noise(), hp = ctx.createBiquadFilter(), g2 = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 4200;
    env(g2, o.peak || 0.05, 0.02, o.dec || 0.32);
    s.connect(hp); hp.connect(g2);
    route(g2, { pan: o.pan || 0, send: 0.4 });
    s.start(); s.stop(t + 0.6); reg(s, 0.6);
  };
  A.pad = function (o) {
    if (!ok()) return;
    o = o || {};
    var t = ctx.currentTime, dur = o.dur || 3;
    (o.freqs || [73.42, 110, 146.83]).forEach(function (f, i) {
      var osc = ctx.createOscillator(), g2 = ctx.createGain(), lp = ctx.createBiquadFilter();
      osc.type = 'sine'; osc.frequency.value = f;
      lp.type = 'lowpass'; lp.frequency.value = 800;
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime((o.peak || 0.06) / (i * 0.8 + 1), t + 0.45);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(lp); lp.connect(g2);
      route(g2, { pan: i === 1 ? 0 : (i ? 0.25 : -0.25), send: 0.5 });
      osc.start(); osc.stop(t + dur + 0.2); reg(osc, dur + 0.2);
    });
  };

  /* ---------------- LITS D'AMBIANCE ----------------
     Texture continue, très basse. Comble les creux entre les repères
     pour que l'ensemble sonne comme une pièce montée, pas comme des
     bips isolés. */
  A.rumble = function (o) {
    if (!ok()) return;
    o = o || {};
    var t = ctx.currentTime, dur = o.dur || 10;
    var g2 = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(o.open ? 180 : 300, t);
    lp.frequency.linearRampToValueAtTime(o.open || 760, t + dur);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime((o.peak || 0.05) * 0.6, t + 1.4);
    g2.gain.exponentialRampToValueAtTime(o.peak || 0.085, t + dur * 0.92);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g2); route(g2, { pan: 0, send: 0.2 });
    (o.freqs || [41, 41.7]).forEach(function (f) {
      var osc = ctx.createOscillator();
      osc.type = 'sawtooth'; osc.frequency.value = f;
      osc.connect(lp); osc.start(); osc.stop(t + dur + 0.2);
      beds.push(osc); reg(osc, dur + 0.2);
    });
  };
  A.roomTone = function (o) {
    if (!ok()) return;
    o = o || {};
    var t = ctx.currentTime, dur = o.dur || 12;
    var s = noise(); s.loop = true;
    var bp = ctx.createBiquadFilter(), g2 = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = o.freq || 2400; bp.Q.value = 0.6;
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(o.peak || 0.012, t + 0.8);
    g2.gain.setValueAtTime(o.peak || 0.012, t + dur - 0.6);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g2);
    route(g2, { pan: 0, send: 0.3 });
    s.start(); s.stop(t + dur + 0.2);
    beds.push(s); reg(s, dur + 0.2);
  };
  A.stopBeds = function () {
    beds.forEach(function (n) { try { n.stop(); } catch (e) {} });
    beds = [];
  };

  g.SFX = A;
})(window);
