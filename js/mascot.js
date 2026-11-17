import { MOOD_TEXT, moodImageFor } from './logic.js';

// el = the .hero element. Only swaps the picture when it actually changes, so animations don't restart.
export function renderMascot(el, mood, images, subtitle) {
  el.querySelector('.hero-date').textContent = subtitle;
  el.querySelector('.hero-text').textContent = MOOD_TEXT[mood];
  const pic = el.querySelector('.pic');
  const img = moodImageFor(mood, images);
  const key = img ? `${mood}|${img.url}` : mood;
  if (pic.dataset.key === key) return;
  pic.dataset.key = key;
  pic.replaceChildren();
  pic.className = `pic mood-${img ? img.mood : mood}`;
  if (!img) return; // text-only header
  const animated = img.type === 'video/mp4' || img.type === 'image/gif';
  if (!animated) pic.classList.add('anim');
  let media;
  if (img.type === 'video/mp4') {
    media = Object.assign(document.createElement('video'), { src: img.url, autoplay: true, loop: true, muted: true, playsInline: true });
  } else {
    media = Object.assign(document.createElement('img'), { src: img.url, alt: '' });
    media.onerror = () => { pic.replaceChildren(); pic.dataset.key = ''; }; // never show a broken image
  }
  pic.append(media);
  if (mood === 'allclear') for (let i = 0; i < 3; i++) pic.append(Object.assign(document.createElement('span'), { className: 'heart', textContent: '♡' }));
}
