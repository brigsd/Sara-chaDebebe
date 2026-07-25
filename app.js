const API_URL = 'https://script.google.com/macros/s/AKfycbxG_GEQXktLza3TV8-VyIUiAF9pCMVaA15xieX_fW-9kFzN8orwW4New2ghF67zFDc2/exec';
const selectedGiftKey = 'sara-cha-gift-token';
const rsvpKey = 'sara-cha-rsvp-token';
let selectedGift = null;

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (text = '') => String(text).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const savedGift = () => {
  try { return JSON.parse(localStorage.getItem(selectedGiftKey) || 'null'); } catch { return null; }
};

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
    <p class="availability">${mine ? 'Escolhido por você' : unavailable ? 'Já escolhido' : `${gift.disponivel} disponível`}</p>
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
  button.disabled = true;
  button.textContent = 'Confirmando...';
  try {
    const { token, mensagem } = await request('reservar', { itemId: selectedGift.id });
    localStorage.setItem(selectedGiftKey, JSON.stringify({ token, itemId: selectedGift.id }));
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
