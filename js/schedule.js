const dayTabs = [...document.querySelectorAll('[data-day]')];
const dayPanels = [...document.querySelectorAll('[data-panel]')];
const dayTabsList = document.querySelector('.schedule-tabs');
const dayTabsDocumentTop = dayTabsList
  ? dayTabsList.getBoundingClientRect().top + window.scrollY
  : 0;

const selectDay = (day, focus = false, align = false) => {
  document.body.dataset.activeDay = day;
  dayTabs.forEach((tab) => {
    const active = tab.dataset.day === day;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });
  dayPanels.forEach((panel) => {
    const active = panel.dataset.panel === day;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });
  if (align && window.matchMedia('(max-width: 560px)').matches) {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: Math.max(0, dayTabsDocumentTop - 6), behavior: 'smooth' });
    });
  }
};

dayTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectDay(tab.dataset.day, false, true));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const next = dayTabs[(index + direction + dayTabs.length) % dayTabs.length];
    selectDay(next.dataset.day, true, true);
  });
});

const requestedDay = new URLSearchParams(window.location.search).get('day');
if (dayTabs.some((tab) => tab.dataset.day === requestedDay)) selectDay(requestedDay);

const menuButton = document.querySelector('.schedule-header__menu');
const menu = document.querySelector('.schedule-header__nav');
menuButton?.addEventListener('click', () => {
  const open = menu.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  if (open) window.requestAnimationFrame(() => menu.querySelector('a')?.focus());
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !menu?.classList.contains('is-open')) return;
  menu.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Открыть меню');
  menuButton.focus();
});
menu?.addEventListener('click', (event) => {
  if (!event.target.closest('a')) return;
  menu.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Открыть меню');
});

const ticketModal = document.querySelector('.ticket-modal');
const ticketForm = document.querySelector('.ticket-form');

if (ticketModal && ticketForm) {
  const closeButton = ticketModal.querySelector('.ticket-modal__close');
  const successMessage = ticketModal.querySelector('.ticket-modal__success');
  const errorMessage = ticketForm.querySelector('.ticket-form__error');
  const submitButton = ticketForm.querySelector('.ticket-form__submit');
  const submitLabel = submitButton.querySelector('span');
  let ticketTrigger = null;
  let formOpenedAt = 0;
  let lastSubmissionAt = 0;

  const openTicketModal = (trigger) => {
    ticketTrigger = trigger;
    ticketForm.hidden = false;
    successMessage.hidden = true;
    errorMessage.hidden = true;
    errorMessage.textContent = '';
    formOpenedAt = Date.now();
    ticketModal.showModal();
    window.requestAnimationFrame(() => ticketForm.querySelector('input[name="name"]')?.focus());
  };

  document.querySelectorAll('[data-ticket-open]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      openTicketModal(button);
    });
  });

  if (new URLSearchParams(window.location.search).get('ticket') === '1') {
    openTicketModal(null);
  }

  closeButton.addEventListener('click', () => ticketModal.close());
  ticketModal.addEventListener('click', (event) => {
    if (event.target === ticketModal) ticketModal.close();
  });
  ticketModal.addEventListener('close', () => ticketTrigger?.focus());

  ticketForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const requiredFields = [...ticketForm.querySelectorAll('input[name="name"], input[name="contact"]')];
    let firstInvalid = null;

    requiredFields.forEach((field) => {
      const invalid = !field.value.trim() || !field.checkValidity();
      field.toggleAttribute('aria-invalid', invalid);
      const message = field.closest('.ticket-form__field')?.querySelector('.ticket-form__field-error');
      if (message) message.hidden = !invalid;
      if (invalid && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) return firstInvalid.focus();

    const consent = ticketForm.querySelector('input[name="privacyAccepted"]');
    if (!consent?.checked) {
      errorMessage.textContent = 'Подтвердите согласие на обработку персональных данных.';
      errorMessage.hidden = false;
      return consent?.focus();
    }

    const formData = new FormData(ticketForm);
    if (formData.get('website')) return;
    if (Date.now() - formOpenedAt < 1500 || Date.now() - lastSubmissionAt < 15000) {
      errorMessage.textContent = 'Подождите несколько секунд и попробуйте снова.';
      errorMessage.hidden = false;
      return;
    }

    submitButton.disabled = true;
    submitLabel.textContent = 'Отправляем…';
    errorMessage.hidden = true;
    lastSubmissionAt = Date.now();

    try {
      const response = await fetch(ticketForm.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(formData.get('name')).trim(),
          contact: String(formData.get('contact')).trim(),
          ticket: formData.get('ticket'),
          website: formData.get('website'),
          privacyAccepted: formData.get('privacyAccepted') === 'yes',
          openedAt: formOpenedAt,
          submissionId: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          page: `${window.location.origin}${window.location.pathname}`
        })
      });
      if (!response.ok) throw new Error('Request failed');
      ticketForm.reset();
      ticketForm.hidden = true;
      successMessage.hidden = false;
      successMessage.focus();
    } catch {
      errorMessage.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз или свяжитесь с нами в социальных сетях.';
      errorMessage.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitLabel.textContent = 'Отправить';
    }
  });

  ticketForm.addEventListener('input', (event) => {
    const field = event.target.closest('input[name="name"], input[name="contact"]');
    if (!field || !field.value.trim()) return;
    field.removeAttribute('aria-invalid');
    const message = field.closest('.ticket-form__field')?.querySelector('.ticket-form__field-error');
    if (message) message.hidden = true;
  });
}
