const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.nav');
const siteHeader = document.querySelector('.hero__header');

// Instagram/Threads WebViews sometimes reuse the last scroll offset for a URL
// even when it is opened as a new in-app browser page.
const isMetaInAppBrowser = /Instagram|Threads|Barcelona|FBAN|FBAV|;\s*wv\)/i.test(navigator.userAgent)
  || /(^|\.)threads\.net$/i.test(document.referrer ? new URL(document.referrer).hostname : '');
const forceCompactWebView = new URLSearchParams(window.location.search).has('threads');

if (isMetaInAppBrowser || forceCompactWebView) {
  document.documentElement.classList.add('in-app-webview');
}

if ((isMetaInAppBrowser || forceCompactWebView) && !window.location.hash) {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const resetInitialScroll = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  resetInitialScroll();
  window.addEventListener('pageshow', resetInitialScroll, { once: true });
  window.addEventListener('load', () => window.requestAnimationFrame(resetInitialScroll), { once: true });
}

if (siteHeader) {
  const updateHeader = () => siteHeader.classList.toggle('is-scrolled', window.scrollY > 48);
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();
}

const ticketModal = document.querySelector('.ticket-modal');
const ticketForm = document.querySelector('.ticket-form');

if (ticketModal && ticketForm) {
  const closeButton = ticketModal.querySelector('.ticket-modal__close');
  const successMessage = ticketModal.querySelector('.ticket-modal__success');
  const errorMessage = ticketForm.querySelector('.ticket-form__error');
  const submitButton = ticketForm.querySelector('.ticket-form__submit');
  const submitLabel = submitButton.querySelector('span');

  let ticketTrigger = null;

  const openTicketModal = (ticketType, trigger) => {
    ticketTrigger = trigger || document.activeElement;
    ticketForm.hidden = false;
    successMessage.hidden = true;
    errorMessage.hidden = true;
    errorMessage.textContent = '';
    ticketForm.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
    ticketForm.querySelectorAll('.ticket-form__field-error').forEach((message) => { message.hidden = true; });

    if (ticketType) {
      const option = ticketForm.querySelector(`input[name="ticket"][value="${ticketType === 'day' ? '1 день' : 'Полный билет'}"]`);
      if (option) option.checked = true;
    }

    ticketModal.showModal();
    window.requestAnimationFrame(() => ticketForm.querySelector('input[name="name"]')?.focus());
  };

  document.querySelectorAll('[data-ticket-open]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      openTicketModal(button.dataset.ticketType, button);
    });
  });

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
      const invalid = !field.value.trim();
      field.toggleAttribute('aria-invalid', invalid);
      const message = field.closest('.ticket-form__field')?.querySelector('.ticket-form__field-error');
      if (message) message.hidden = !invalid;
      if (invalid && !firstInvalid) firstInvalid = field;
    });

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const endpoint = ticketForm.dataset.telegramEndpoint;
    const formData = new FormData(ticketForm);

    if (formData.get('website')) return;
    if (!endpoint) {
      errorMessage.textContent = 'Форма готова, но отправка станет доступна после подключения Telegram.';
      errorMessage.hidden = false;
      errorMessage.focus?.();
      return;
    }

    submitButton.disabled = true;
    submitButton.classList.add('is-loading');
    submitLabel.textContent = 'Отправляем…';
    errorMessage.hidden = true;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          contact: formData.get('contact'),
          ticket: formData.get('ticket'),
          page: window.location.href
        })
      });

      if (!response.ok) throw new Error('Request failed');
      ticketForm.reset();
      ticketForm.hidden = true;
      successMessage.hidden = false;
      successMessage.focus();
    } catch (error) {
      errorMessage.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз или свяжитесь с нами в социальных сетях.';
      errorMessage.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.classList.remove('is-loading');
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

if (menuButton && navigation) {
  let menuTrigger = null;
  const closeMenu = () => {
    menuButton.classList.remove('is-active');
    navigation.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Открыть меню');
    if (menuTrigger) menuButton.focus();
    menuTrigger = null;
  };

  menuButton.addEventListener('click', () => {
    const willOpen = !navigation.classList.contains('is-open');
    if (willOpen) menuTrigger = document.activeElement;
    menuButton.classList.toggle('is-active', willOpen);
    navigation.classList.toggle('is-open', willOpen);
    document.body.classList.toggle('menu-open', willOpen);
    menuButton.setAttribute('aria-expanded', String(willOpen));
    menuButton.setAttribute('aria-label', willOpen ? 'Закрыть меню' : 'Открыть меню');
    if (willOpen) window.requestAnimationFrame(() => navigation.querySelector('a')?.focus());
  });

  const scrollToSection = (target) => {
    const headerHeight = siteHeader?.getBoundingClientRect().height || 0;
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    const topClearance = headerHeight + (mobile ? 24 : 30);
    const availableHeight = window.innerHeight - topClearance;
    const sectionHeight = target.getBoundingClientRect().height;
    const sectionTop = target.getBoundingClientRect().top + window.scrollY;
    const centeredOffset = Math.max(0, (availableHeight - sectionHeight) / 2);
    const desktopSectionOffset = !mobile && target.id === 'about' ? -40 : !mobile && target.id === 'gallery' ? 64 : 0;
    const mobileSectionOffset = mobile && target.id === 'about' ? 12 : mobile && target.id === 'faq' ? 48 : 0;
    const destination = Math.max(0, sectionTop - topClearance - centeredOffset + desktopSectionOffset + mobileSectionOffset);

    window.scrollTo({ top: destination, behavior: 'smooth' });
  };

  navigation.addEventListener('click', (event) => {
    const link = event.target.closest('.nav__link');
    const ticket = event.target.closest('.nav__ticket');

    if (link) {
      event.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      closeMenu();
      if (target) {
        history.pushState(null, '', link.getAttribute('href'));
        window.requestAnimationFrame(() => scrollToSection(target));
      }
      return;
    }

    if (ticket) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
    if (event.key !== 'Tab' || !navigation.classList.contains('is-open')) return;
    const focusable = [...navigation.querySelectorAll('a'), menuButton];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}

const galleryTrack = document.querySelector('.gallery__track');

if (galleryTrack) {
  const fragment = document.createDocumentFragment();
  for (let index = 5; index <= 42; index += 1) {
    const button = document.createElement('button');
    const image = document.createElement('img');
    button.className = 'gallery__slide';
    button.type = 'button';
    button.dataset.galleryIndex = String(index - 1);
    image.src = `img/carousel-${String(index).padStart(2, '0')}.webp`;
    image.alt = `Фотография фестиваля Узор ${index}`;
    image.loading = 'lazy';
    image.decoding = 'async';
    button.append(image);
    fragment.append(button);
  }
  galleryTrack.append(fragment);
}

const galleryOriginalSlides = galleryTrack ? [...galleryTrack.querySelectorAll('.gallery__slide')] : [];

if (galleryTrack && galleryOriginalSlides.length) {
  const cloneCount = 4;
  const beforeClones = galleryOriginalSlides.slice(-cloneCount).map((slide) => {
    const clone = slide.cloneNode(true);
    clone.dataset.galleryClone = 'true';
    clone.setAttribute('aria-hidden', 'true');
    clone.tabIndex = -1;
    clone.querySelector('img').alt = '';
    return clone;
  });
  const afterClones = galleryOriginalSlides.slice(0, cloneCount).map((slide) => {
    const clone = slide.cloneNode(true);
    clone.dataset.galleryClone = 'true';
    clone.setAttribute('aria-hidden', 'true');
    clone.tabIndex = -1;
    clone.querySelector('img').alt = '';
    return clone;
  });
  galleryTrack.prepend(...beforeClones);
  galleryTrack.append(...afterClones);
}

const galleryImages = [...document.querySelectorAll('.gallery__slide:not([data-gallery-clone]) img')];
const galleryButtons = document.querySelectorAll('[data-gallery-index]');
const galleryOpenButton = document.querySelector('[data-gallery-open]');
const lightbox = document.querySelector('.lightbox');

if (galleryImages.length && lightbox) {
  const lightboxImage = lightbox.querySelector('.lightbox__image');
  const lightboxStatus = lightbox.querySelector('.lightbox__status');
  const lightboxClose = lightbox.querySelector('.lightbox__close');
  let currentImage = 0;
  let lightboxTrigger = null;

  const showImage = (index) => {
    currentImage = (index + galleryImages.length) % galleryImages.length;
    lightboxImage.src = galleryImages[currentImage].src;
    lightboxImage.alt = galleryImages[currentImage].alt;
    lightboxStatus.textContent = `Фотография ${currentImage + 1} из ${galleryImages.length}`;
  };
  const openLightbox = (index = 0, trigger = null) => {
    lightboxTrigger = trigger || document.activeElement;
    showImage(index);
    lightbox.hidden = false;
    document.body.classList.add('menu-open');
    window.requestAnimationFrame(() => lightboxClose.focus());
  };
  const closeLightbox = () => {
    lightbox.hidden = true;
    document.body.classList.remove('menu-open');
    lightboxTrigger?.focus();
  };

  galleryButtons.forEach((button) => button.addEventListener('click', () => openLightbox(Number(button.dataset.galleryIndex), button)));
  galleryOpenButton?.addEventListener('click', () => openLightbox(0, galleryOpenButton));
  lightbox.querySelector('.lightbox__close').addEventListener('click', closeLightbox);
  lightbox.querySelector('.lightbox__nav--prev').addEventListener('click', () => showImage(currentImage - 1));
  lightbox.querySelector('.lightbox__nav--next').addEventListener('click', () => showImage(currentImage + 1));
  lightbox.addEventListener('click', (event) => { if (event.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (event) => {
    if (lightbox.hidden) return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') showImage(currentImage - 1);
    if (event.key === 'ArrowRight') showImage(currentImage + 1);
    if (event.key === 'Tab') {
      const focusable = [...lightbox.querySelectorAll('button:not([disabled])')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
}

const videoMedia = document.querySelector('.festival-video__media');
if (videoMedia) {
  const video = videoMedia.querySelector('video');
  const playButton = videoMedia.querySelector('.festival-video__play');
  playButton.addEventListener('click', async () => {
    try {
      video.controls = true;
      videoMedia.classList.add('is-playing');
      await video.play();
    } catch (error) {
      videoMedia.classList.remove('is-playing');
      video.controls = false;
    }
  });
  video.addEventListener('pause', () => { if (!video.ended) videoMedia.classList.remove('is-playing'); });
  video.addEventListener('ended', () => videoMedia.classList.remove('is-playing'));
}

document.querySelectorAll('.faq-item__question').forEach((button, index) => {
  const answer = button.closest('.faq-item').querySelector('.faq-item__answer');
  const questionId = `faq-question-${index + 1}`;
  const answerId = `faq-answer-${index + 1}`;
  button.id = questionId;
  button.setAttribute('aria-controls', answerId);
  answer.id = answerId;
  answer.setAttribute('role', 'region');
  answer.setAttribute('aria-labelledby', questionId);
  button.addEventListener('click', () => {
    const item = button.closest('.faq-item');
    const willOpen = !item.classList.contains('is-open');
    document.querySelectorAll('.faq-item.is-open').forEach((openItem) => {
      openItem.classList.remove('is-open');
      openItem.querySelector('.faq-item__question').setAttribute('aria-expanded', 'false');
    });
    item.classList.toggle('is-open', willOpen);
    button.setAttribute('aria-expanded', String(willOpen));
  });
});

const galleryViewport = document.querySelector('.gallery__viewport');
const galleryPrev = document.querySelector('.gallery__arrow--prev');
const galleryNext = document.querySelector('.gallery__arrow--next');

if (galleryViewport && galleryPrev && galleryNext) {
  const getGalleryMetrics = () => {
    const originals = [...galleryViewport.querySelectorAll('.gallery__slide:not([data-gallery-clone])')];
    const step = originals.length > 1 ? originals[1].offsetLeft - originals[0].offsetLeft : galleryViewport.clientWidth;
    return { start: originals[0]?.offsetLeft || 0, cycle: step * originals.length, step };
  };

  const resetGalleryPosition = () => {
    const { start } = getGalleryMetrics();
    galleryViewport.scrollLeft = start;
  };

  const moveGallery = (direction) => {
    const { step } = getGalleryMetrics();
    galleryViewport.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  let galleryScrollTimer;
  const jumpGalleryWithoutAnimation = (distance) => {
    galleryViewport.style.scrollBehavior = 'auto';
    galleryViewport.scrollLeft += distance;
    window.requestAnimationFrame(() => {
      galleryViewport.style.scrollBehavior = '';
    });
  };

  galleryViewport.addEventListener('scroll', () => {
    window.clearTimeout(galleryScrollTimer);
    galleryScrollTimer = window.setTimeout(() => {
      const { start, cycle, step } = getGalleryMetrics();
      if (galleryViewport.scrollLeft < start - step * 0.5) jumpGalleryWithoutAnimation(cycle);
      if (galleryViewport.scrollLeft >= start + cycle - step * 0.5) jumpGalleryWithoutAnimation(-cycle);
    }, 120);
  }, { passive: true });

  galleryPrev.addEventListener('click', () => moveGallery(-1));
  galleryNext.addEventListener('click', () => moveGallery(1));
  galleryViewport.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); moveGallery(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); moveGallery(1); }
  });
  window.addEventListener('resize', resetGalleryPosition);
  window.requestAnimationFrame(resetGalleryPosition);
}

const reviewsTrack = document.querySelector('.reviews__track');
const reviewsViewport = document.querySelector('.reviews__viewport');
const reviewsPrev = document.querySelector('.reviews__arrow--prev');
const reviewsNext = document.querySelector('.reviews__arrow--next');

if (reviewsTrack && reviewsViewport && reviewsPrev && reviewsNext) {
  const originalReviews = [...reviewsTrack.querySelectorAll('.review-card')];
  const cloneCount = Math.min(3, originalReviews.length);

  const before = originalReviews.slice(-cloneCount).map((card) => {
    const clone = card.cloneNode(true);
    clone.dataset.reviewClone = 'true';
    clone.setAttribute('aria-hidden', 'true');
    return clone;
  });
  const after = originalReviews.slice(0, cloneCount).map((card) => {
    const clone = card.cloneNode(true);
    clone.dataset.reviewClone = 'true';
    clone.setAttribute('aria-hidden', 'true');
    return clone;
  });
  reviewsTrack.prepend(...before);
  reviewsTrack.append(...after);

  const getReviewMetrics = () => {
    const originals = [...reviewsTrack.querySelectorAll('.review-card:not([data-review-clone])')];
    const step = originals.length > 1 ? originals[1].offsetLeft - originals[0].offsetLeft : reviewsViewport.clientWidth;
    return { start: originals[0]?.offsetLeft || 0, cycle: step * originals.length, step };
  };

  const resetReviews = () => {
    reviewsViewport.scrollLeft = getReviewMetrics().start;
  };

  const moveReviews = (direction) => {
    reviewsViewport.scrollBy({ left: direction * getReviewMetrics().step, behavior: 'smooth' });
  };

  let reviewsScrollTimer;
  const jumpReviewsWithoutAnimation = (distance) => {
    reviewsViewport.style.scrollBehavior = 'auto';
    reviewsViewport.scrollLeft += distance;
    window.requestAnimationFrame(() => { reviewsViewport.style.scrollBehavior = ''; });
  };
  reviewsViewport.addEventListener('scroll', () => {
    window.clearTimeout(reviewsScrollTimer);
    reviewsScrollTimer = window.setTimeout(() => {
      const { start, cycle, step } = getReviewMetrics();
      if (reviewsViewport.scrollLeft < start - step * 0.5) jumpReviewsWithoutAnimation(cycle);
      if (reviewsViewport.scrollLeft >= start + cycle - step * 0.5) jumpReviewsWithoutAnimation(-cycle);
    }, 90);
  }, { passive: true });

  reviewsPrev.addEventListener('click', () => moveReviews(-1));
  reviewsNext.addEventListener('click', () => moveReviews(1));
  reviewsViewport.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); moveReviews(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); moveReviews(1); }
  });
  window.addEventListener('resize', resetReviews);
  window.requestAnimationFrame(resetReviews);
}
