(() => {
    const hearts = document.querySelector(".floating-hearts");
    const butterflies = document.querySelector(".butterfly-field");
    if (!hearts || !butterflies) return;

    const heartSymbols = ["♡", "♥", "♥", "✧", "✦", "🌸"];
    const butterflySymbols = ["🦋", "🦋", "🦋", "🦋", "✿"];
    let butterflyTurn = false;

    function addFloatingDetail() {
        if (document.hidden) return;
        butterflyTurn = !butterflyTurn;
        const isButterfly = butterflyTurn && Math.random() > 0.25;
        const element = document.createElement("span");
        element.className = isButterfly ? "floating-butterfly" : "floating-heart";
        element.setAttribute("aria-hidden", "true");
        element.textContent = isButterfly
            ? butterflySymbols[Math.floor(Math.random() * butterflySymbols.length)]
            : heartSymbols[Math.floor(Math.random() * heartSymbols.length)];
        const card = document.querySelector("#introScreen .intro-card");
        if (document.body.classList.contains("intro-active") && card) {
            const bounds = card.getBoundingClientRect();
            const leftSpace = Math.max(0, bounds.left - 50);
            const rightStart = Math.min(window.innerWidth, bounds.right + 42);
            const rightSpace = Math.max(0, window.innerWidth - rightStart - 35);
            if (leftSpace <= 46 && rightSpace <= 46) {
                element.style.left = `${4 + Math.random() * 92}%`;
            } else {
                const useLeft = leftSpace > 46 && (rightSpace <= 46 || Math.random() < .5);
                const minX = useLeft ? 12 : rightStart;
                const maxX = useLeft ? leftSpace : window.innerWidth - 35;
                element.style.left = `${minX + Math.random() * Math.max(0, maxX - minX)}px`;
            }
        } else {
            element.style.left = `${Math.random() * 100}%`;
        }
        element.style.top = `${Math.random() * 108 - 5}vh`;
        element.style.bottom = "auto";
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const duration = prefersReducedMotion
            ? (isButterfly ? 18 + Math.random() * 6 : 16 + Math.random() * 5)
            : (isButterfly ? 13 + Math.random() * 9 : 11 + Math.random() * 8);
        element.style.setProperty("animation-duration", `${duration}s`, prefersReducedMotion ? "important" : "");
        element.style.setProperty("--flight-drift", `${Math.round(Math.random() * 170 - 85)}px`);
        element.style.fontSize = `${isButterfly ? 34 + Math.random() * 17 : 25 + Math.random() * 17}px`;
        element.style.setProperty("--float-opacity", `${.78 + Math.random() * .22}`);
        (isButterfly ? butterflies : hearts).appendChild(element);
        window.setTimeout(() => element.remove(), duration * 1000);
    }

    for (let index = 0; index < 8; index += 1) {
        window.setTimeout(addFloatingDetail, index * 250);
    }
    window.setInterval(addFloatingDetail, 900);
})();
