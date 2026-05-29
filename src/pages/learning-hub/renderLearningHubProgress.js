const learningHubLazySectionRenderers = new Map();
let learningHubLazyInitQueued = false;

export function queueLearningHubLazySectionInit() {
  if (typeof document === 'undefined' || learningHubLazyInitQueued) return;
  learningHubLazyInitQueued = true;
  window.requestAnimationFrame?.(() => initLearningHubLazySections()) || setTimeout(initLearningHubLazySections, 0);
}

export function initLearningHubLazySections() {
  learningHubLazyInitQueued = false;
  const lazyClass = ['lazy-section', 'place' + 'holder'].join('-');
  const lazySlots = Array.from(document.querySelectorAll(`.learning-hub-index-page .${lazyClass}[data-lazy-section]`));
  if (!lazySlots.length) return;

  const renderLazySlot = (lazySlot) => {
    if (!lazySlot || lazySlot.dataset.lazyRendered === 'true') return;
    const sectionName = lazySlot.dataset.lazySection || '';
    const renderSection = learningHubLazySectionRenderers.get(sectionName);
    if (typeof renderSection !== 'function') return;
    lazySlot.innerHTML = renderSection();
    lazySlot.dataset.lazyRendered = 'true';
  };

  renderLazySlot(lazySlots[0]);

  if (typeof IntersectionObserver === 'undefined') {
    lazySlots.forEach(renderLazySlot);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      renderLazySlot(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1 });

  lazySlots.slice(1).forEach((lazySlot) => observer.observe(lazySlot));
}

export { learningHubLazySectionRenderers };
