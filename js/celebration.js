/**
 * Victory effects: fireworks bursts + dancing royal cards.
 */
(function (global) {
  'use strict';

  let active = false;

  function removeLayer() {
    document.getElementById('celebration-layer')?.remove();
    active = false;
  }

  function launchFireworks() {
    const canvas = document.createElement('canvas');
    canvas.className = 'celebration-fireworks';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const ctx = canvas.getContext('2d');
    const bursts = [];
    const colors = ['#ffd700', '#ff6b6b', '#ffffff', '#4ecdc4', '#c44dff', '#7dff9a'];

    function addBurst(x, y) {
      const particles = [];
      const count = 36 + Math.floor(Math.random() * 20);
      const color = colors[Math.floor(Math.random() * colors.length)];
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
        const speed = 2 + Math.random() * 4;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.012 + Math.random() * 0.01,
          color,
        });
      }
      bursts.push(particles);
    }

    let frame = 0;
    const schedule = [8, 24, 42, 58, 76, 92, 110];
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (schedule.includes(frame)) {
        addBurst(
          canvas.width * (0.15 + Math.random() * 0.7),
          canvas.height * (0.12 + Math.random() * 0.35)
        );
      }

      bursts.forEach((particles) => {
        particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.04;
          p.life -= p.decay;
          if (p.life <= 0) return;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      ctx.globalAlpha = 1;
      frame++;
      if (frame < 150) requestAnimationFrame(tick);
      else {
        window.removeEventListener('resize', resize);
        canvas.remove();
      }
    };
    requestAnimationFrame(tick);
  }

  function makeDancer(card, side, delay) {
    const wrap = document.createElement('div');
    wrap.className = `celebration-dancer celebration-dancer--${side}`;
    wrap.style.animationDelay = `${delay}ms`;

    const frame = document.createElement('div');
    frame.className = 'celebration-dancer-card';

    if (global.CardAssets && typeof global.CardAssets.createFaceElement === 'function') {
      const art = global.CardAssets.createFaceElement(card);
      frame.appendChild(art);
    } else {
      frame.textContent = card.rank === 13 ? 'K' : 'Q';
    }

    wrap.appendChild(frame);
    return wrap;
  }

  function launchDancers() {
    const layer = document.createElement('div');
    layer.id = 'celebration-layer';
    layer.className = 'celebration-layer';
    layer.setAttribute('aria-hidden', 'true');

    layer.appendChild(
      makeDancer({ suit: 'hearts', rank: 13, faceUp: true }, 'left', 0)
    );
    layer.appendChild(
      makeDancer({ suit: 'diamonds', rank: 12, faceUp: true }, 'right', 180)
    );
    layer.appendChild(
      makeDancer({ suit: 'spades', rank: 13, faceUp: true }, 'left-back', 360)
    );
    layer.appendChild(
      makeDancer({ suit: 'clubs', rank: 12, faceUp: true }, 'right-back', 540)
    );

    document.body.appendChild(layer);
    active = true;
  }

  function celebrate() {
    removeLayer();
    launchFireworks();
    launchDancers();
  }

  function stop() {
    removeLayer();
  }

  global.SolitaireCelebration = {
    celebrate,
    stop,
  };
})(typeof window !== 'undefined' ? window : global);
