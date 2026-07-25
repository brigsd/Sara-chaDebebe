const API_URL = 'https://script.google.com/macros/s/AKfycbxG_GEQXktLza3TV8-VyIUiAF9pCMVaA15xieX_fW-9kFzN8orwW4New2ghF67zFDc2/exec';
const selectedGiftKey = 'sara-cha-gift-token';
const rsvpKey = 'sara-cha-rsvp-token';
let selectedGift = null;

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (text = '') => String(text).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const savedGift = () => {
  try { return JSON.parse(localStorage.getItem(selectedGiftKey) || 'null'); } catch { return null; }
};

function celebrateGift() {
  const layer = $('#celebration');
  const width = window.innerWidth;
  const height = window.innerHeight;
  const symbols = ['♥', '♡', '✦', '✧', '★'];
  for (let index = 0; index < 18; index += 1) {
    const angle = (Math.PI * 2 * index / 18) + (Math.random() - .5) * .28;
    const dx = Math.cos(angle) || .01;
    const dy = Math.sin(angle) || .01;
    const distance = Math.min((width / 2 - 12) / Math.abs(dx), (height / 2 - 12) / Math.abs(dy));
    const particle = document.createElement('span');
    const x = dx * distance;
    const y = dy * distance;
    particle.className = 'celebration-particle';
    particle.textContent = symbols[index % symbols.length];
    particle.style.color = index % 2 ? '#e97d98' : '#f6b263';
    particle.style.animationDelay = `${(Math.random() * .5).toFixed(2)}s`;
    particle.style.setProperty('--x', `${x}px`);
    particle.style.setProperty('--y', `${y}px`);
    particle.style.setProperty('--bounce-x', `${x * .86}px`);
    particle.style.setProperty('--bounce-y', `${y * .86}px`);
    particle.style.setProperty('--end-x', `${x * .92}px`);
    particle.style.setProperty('--end-y', `${y * .92}px`);
    particle.style.setProperty('--spin', `${(Math.random() * 340 - 170).toFixed(0)}deg`);
    layer.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove());
  }
}

async function request(action, data = {}) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...data }),
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.mensagem || 'Não foi possível concluir a solicitação.');
  return result;
}

function formatDate(iso) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(iso));
}

function calendarUrl(event) {
  const start = new Date(event.dataIso);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const stamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.titulo)}&dates=${stamp(start)}/${stamp(end)}&location=${encodeURIComponent(event.endereco)}`;
}

async function loadEvent() {
  const { evento } = await request('configuracao');
  $('#event-date').textContent = formatDate(evento.dataIso);
  $('#event-address').textContent = evento.endereco;
  $('#event-note').textContent = evento.observacoes;
  $('#google-calendar').href = calendarUrl(evento);
  $('#copy-address').addEventListener('click', async () => {
    await navigator.clipboard.writeText(evento.endereco);
    $('#copy-address').textContent = 'Endereço copiado!';
    setTimeout(() => { $('#copy-address').textContent = 'Copiar endereço'; }, 1800);
  });
}

function giftCard(gift) {
  const mine = savedGift()?.itemId === gift.id;
  const unavailable = gift.disponivel < 1;
  const button = mine
    ? '<button class="button button-soft" type="button" data-cancel-gift>Desfazer minha escolha</button>'
    : `<button class="button ${unavailable ? 'button-soft' : 'button-primary'}" type="button" data-gift="${escapeHtml(gift.id)}" ${unavailable ? 'disabled' : ''}>${unavailable ? 'Já escolhido' : 'Vou presentear'}</button>`;
  return `<article class="gift-card ${unavailable && !mine ? 'is-reserved' : ''} ${mine ? 'is-mine' : ''}">
    <img class="gift-image" src="${escapeHtml(gift.imagem)}" alt="" loading="lazy" />
    <div class="gift-body"><h3>${escapeHtml(gift.item)}</h3><p>${escapeHtml(gift.descricao)}</p>
    <p class="availability">${mine ? 'Escolhido por você' : unavailable ? 'Já escolhido' : `${gift.disponivel} ${gift.disponivel === 1 ? 'disponível' : 'disponíveis'}`}</p>
    ${button}</div>
  </article>`;
}

async function loadGifts() {
  try {
    const { presentes } = await request('listarPresentes');
    const visiveis = presentes.filter((gift) => gift.item.trim().toLowerCase() !== 'vale-presente');
    $('#gift-grid').innerHTML = visiveis.map(giftCard).join('');
    document.querySelectorAll('[data-gift]').forEach((button) => button.addEventListener('click', () => {
      selectedGift = visiveis.find((gift) => gift.id === button.dataset.gift);
      $('#dialog-title').textContent = selectedGift.item;
      $('#gift-quantity').value = 1;
      $('#gift-quantity').max = selectedGift.disponivel;
      $('#gift-quantity-help').textContent = `${selectedGift.disponivel} unidade${selectedGift.disponivel > 1 ? 's disponíveis' : ' disponível'}.`;
      $('#gift-message').textContent = '';
      $('#gift-dialog').showModal();
    }));
    document.querySelectorAll('[data-cancel-gift]').forEach((button) => button.addEventListener('click', cancelReservation));
  } catch (error) {
    $('#gift-grid').innerHTML = '<p>Não foi possível carregar os presentes agora. Tente novamente em alguns instantes.</p>';
  }
}

$('#confirm-gift').addEventListener('click', async () => {
  if (!selectedGift) return;
  const button = $('#confirm-gift');
  const quantidade = Math.max(1, Math.floor(Number($('#gift-quantity').value) || 1));
  if (quantidade > selectedGift.disponivel) {
    $('#gift-message').textContent = 'Escolha uma quantidade disponível.';
    return;
  }
  button.disabled = true;
  button.textContent = 'Confirmando...';
  try {
    const { token, mensagem } = await request('reservar', { itemId: selectedGift.id, quantidade });
    localStorage.setItem(selectedGiftKey, JSON.stringify({ token, itemId: selectedGift.id, quantidade }));
    celebrateGift();
    $('#gift-message').textContent = mensagem;
    setTimeout(() => { $('#gift-dialog').close(); loadGifts(); }, 1000);
  } catch (error) {
    $('#gift-message').textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Confirmar escolha';
  }
});

async function cancelReservation() {
  const saved = savedGift();
  if (!saved) return;
  const button = document.querySelector('[data-cancel-gift]');
  if (!button) return;
  button.disabled = true;
  button.textContent = 'Desfazendo...';
  try {
    await request('cancelarReserva', { token: saved.token });
    localStorage.removeItem(selectedGiftKey);
    await loadGifts();
  } catch (error) {
    if (/não encontrada|já cancelada/i.test(error.message)) {
      localStorage.removeItem(selectedGiftKey);
      await loadGifts();
    } else {
      alert(error.message);
    }
  } finally {
    button.disabled = false;
    button.textContent = 'Desfazer minha escolha';
  }
}

document.querySelectorAll('input[name="resposta"]').forEach((input) => input.addEventListener('change', () => {
  $('#party-size-label').hidden = document.querySelector('input[name="resposta"]:checked').value !== 'sim';
}));

$('#rsvp-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const resposta = form.get('resposta');
  const quantidade = resposta === 'sim' ? form.get('quantidade') : 0;
  const message = $('#rsvp-message');
  message.textContent = 'Enviando...';
  try {
    const saved = localStorage.getItem(rsvpKey);
    const { token, mensagem } = await request('confirmarPresenca', { resposta, quantidade, token: saved || undefined });
    localStorage.setItem(rsvpKey, token);
    message.textContent = mensagem;
  } catch (error) { message.textContent = error.message; }
});

Promise.all([loadEvent(), loadGifts()]).catch(() => {});

let lastScrollY = window.scrollY;
let teddyStopTimer;
let teddyAnimationFrame;
const teddyFrames = [
  ['0%', '0%'],
  ['50%', '0%'],
  ['100%', '0%'],
  ['0%', '100%'],
  ['50%', '100%'],
  ['100%', '100%']
];

function setTeddyFrame(teddy, frame) {
  const [x, y] = teddyFrames[frame];
  teddy.style.backgroundPosition = `${x} ${y}`;
}

function updateTeddy() {
  const teddy = $('#scroll-teddy');
  if (!teddy) return;
  const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const progress = Math.min(1, Math.max(0, window.scrollY / scrollable));
  const travel = Math.max(0, window.innerHeight - teddy.offsetHeight - 36);
  const targetY = 18 + progress * travel;
  const direction = window.scrollY >= lastScrollY ? 1 : -1;
  lastScrollY = window.scrollY;
  teddy.style.transform = `translateY(${targetY}px) scaleX(${direction})`;
  setTeddyFrame(teddy, Math.floor(Math.abs(window.scrollY) / 28) % teddyFrames.length);
  clearTimeout(teddyStopTimer);
  teddyStopTimer = setTimeout(() => {
    setTeddyFrame(teddy, 1);
  }, 180);
  teddyAnimationFrame = undefined;
}

function queueTeddyUpdate() {
  if (teddyAnimationFrame) return;
  teddyAnimationFrame = requestAnimationFrame(updateTeddy);
}

window.addEventListener('scroll', queueTeddyUpdate, { passive:true });
window.addEventListener('resize', queueTeddyUpdate);
updateTeddy();
