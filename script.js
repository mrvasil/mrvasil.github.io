const giftLayer = document.getElementById('gift-layer');
const root = document.documentElement;
const heroCopy = document.querySelector('.hero-copy');
const handleText = document.getElementById('handle-text');
const precisePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const depths = [1.05, 0.65, 0.85, 0.7, 1.15, 0.92];

let gifts = [];
let pointerX = window.innerWidth / 2;
let pointerY = window.innerHeight / 2;
let animationFrame = 0;
let scrambleFrame = 0;

const renderGifts = () => {
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const normalizedX = Math.max(-1, Math.min(1, (pointerX - centerX) / Math.max(centerX, 1)));
  const normalizedY = Math.max(-1, Math.min(1, (pointerY - centerY) / Math.max(centerY, 1)));

  gifts.forEach((gift, index) => {
    const depth = Number(gift.dataset.depth || 1);
    const direction = index % 2 === 0 ? 1 : -1;
    const x = normalizedX * depth * 18 * direction;
    const y = normalizedY * depth * 14 * direction;

    gift.style.setProperty('--pointer-x', `${x.toFixed(2)}px`);
    gift.style.setProperty('--pointer-y', `${y.toFixed(2)}px`);
  });

  animationFrame = 0;
};

const queueRender = () => {
  if (!animationFrame) animationFrame = requestAnimationFrame(renderGifts);
};

const scrambleHandle = () => {
  if (reducedMotion.matches || scrambleFrame) return;

  const value = 'mrvasil';
  const glyphs = '01<>/{}[]#$';
  const startedAt = performance.now();
  const duration = 520;

  const render = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const revealed = Math.floor(progress * (value.length + 1));
    const phase = Math.floor(now / 36);

    handleText.textContent = [...value].map((letter, index) => {
      if (index < revealed) return letter;
      return glyphs[(phase + index * 3) % glyphs.length];
    }).join('');

    if (progress < 1) scrambleFrame = requestAnimationFrame(render);
    else {
      handleText.textContent = value;
      scrambleFrame = 0;
    }
  };

  scrambleFrame = requestAnimationFrame(render);
};

const animateGift = (image, index) => {
  if (reducedMotion.matches) return;

  const direction = index % 2 === 0 ? 1 : -1;
  const duration = 12_000 + index * 780;
  const x = (4 + index % 3) * direction;
  const y = index % 3 === 0 ? -8 : 7;
  const tilt = 1.2 * direction;

  image.animate(
    [
      { transform: 'translate3d(0, 0, 0) rotate(0deg)' },
      { transform: `translate3d(${x}px, ${y}px, 0) rotate(${tilt}deg)`, offset: 0.32 },
      {
        transform: `translate3d(${(-x * 0.55).toFixed(2)}px, ${(-y * 0.35).toFixed(2)}px, 0) rotate(${(-tilt * 0.5).toFixed(2)}deg)`,
        offset: 0.68
      },
      { transform: 'translate3d(0, 0, 0) rotate(0deg)' }
    ],
    {
      duration,
      delay: index * -1900,
      fill: 'both',
      iterations: Infinity,
      easing: 'cubic-bezier(0.45, 0, 0.55, 1)'
    }
  );
};

const mountGifts = (items) => {
  const fragment = document.createDocumentFragment();

  items.slice(0, depths.length).forEach((item, index) => {
    const gift = document.createElement('div');
    const image = document.createElement('img');

    gift.className = `gift gift-slot-${index}`;
    gift.dataset.depth = String(depths[index]);
    gift.dataset.giftType = item.type;

    image.src = item.image;
    image.alt = '';
    image.decoding = 'async';
    image.draggable = false;

    image.addEventListener('load', () => {
      requestAnimationFrame(() => gift.classList.add('is-visible'));
    }, { once: true });

    gift.append(image);
    fragment.append(gift);
    animateGift(image, index);
  });

  giftLayer.replaceChildren(fragment);
  gifts = [...giftLayer.querySelectorAll('.gift')];
  renderGifts();
};

const loadGifts = async () => {
  try {
    const response = await fetch('/api/gifts', {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) return;

    const payload = await response.json();
    if (Array.isArray(payload.gifts)) mountGifts(payload.gifts);
  } catch {
    // The contact page stays usable when Telegram is temporarily unavailable.
  }
};

window.addEventListener('pointermove', (event) => {
  if (!precisePointer.matches || reducedMotion.matches) return;
  pointerX = event.clientX;
  pointerY = event.clientY;
  const normalizedX = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
  const normalizedY = (event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;

  root.style.setProperty('--cursor-x', `${event.clientX}px`);
  root.style.setProperty('--cursor-y', `${event.clientY}px`);
  heroCopy.style.setProperty('--echo-x', `${(-8 + normalizedX * 5).toFixed(2)}px`);
  heroCopy.style.setProperty('--echo-y', `${(-7 + normalizedY * 4).toFixed(2)}px`);
  queueRender();
}, { passive: true });

window.addEventListener('resize', () => {
  pointerX = window.innerWidth / 2;
  pointerY = window.innerHeight / 2;
  root.style.setProperty('--cursor-x', `${pointerX}px`);
  root.style.setProperty('--cursor-y', `${pointerY}px`);
  queueRender();
}, { passive: true });

heroCopy.addEventListener('pointerenter', scrambleHandle);

requestAnimationFrame(() => {
  document.body.classList.add('is-ready');
  loadGifts();
  window.setTimeout(scrambleHandle, 480);
});
