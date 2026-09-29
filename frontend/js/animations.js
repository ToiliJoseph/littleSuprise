(() => {
    const targetSelector = [
        ".hero-copy",
        ".hero-art",
        ".section-heading",
        ".memory-card",
        ".person-copy",
        ".portrait-grid img",
        ".dance-card",
        ".reason-item",
        ".letter-card",
        ".contribute-card"
    ].map(selector => `.main-site ${selector}`).join(", ");
    let observer;

    function observe() {
        const targets = document.querySelectorAll(targetSelector);
        if (!("IntersectionObserver" in window)) {
            targets.forEach(target => target.classList.add("is-visible"));
            return;
        }

        if (!observer) {
            observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                });
            }, { threshold: 0.12 });
        }
        targets.forEach((target, index) => {
            if (target.classList.contains("is-visible")) return;
            target.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 90}ms`);
            observer.observe(target);
        });
    }

    window.loveAnimations = { observe };
})();