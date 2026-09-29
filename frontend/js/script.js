(() => {
    const yesButton = document.getElementById("yesBtn");
    const noButton = document.getElementById("noBtn");
    const intro = document.getElementById("introScreen");
    const reveal = document.getElementById("loveReveal");
    const site = document.getElementById("mainSite");
    let opened = false;

    if (!yesButton || !noButton || !intro || !reveal || !site) return;

    function moveNoButton() {
        if (opened) return;
        if (noButton.parentElement !== document.body) document.body.appendChild(noButton);

        const margin = 16;
        const buttonWidth = noButton.offsetWidth;
        const buttonHeight = noButton.offsetHeight;
        const maxX = Math.max(margin, window.innerWidth - buttonWidth - margin);
        const maxY = Math.max(margin, window.innerHeight - buttonHeight - margin);
        const yesBounds = yesButton.getBoundingClientRect();
        let x = margin;
        let y = margin;

        for (let attempt = 0; attempt < 30; attempt += 1) {
            x = margin + Math.random() * (maxX - margin);
            y = margin + Math.random() * (maxY - margin);
            const overlapsYes = x < yesBounds.right + margin &&
                x + buttonWidth > yesBounds.left - margin &&
                y < yesBounds.bottom + margin &&
                y + buttonHeight > yesBounds.top - margin;
            if (!overlapsYes) break;
        }

        noButton.classList.add("no-button-escape");
        noButton.style.left = `${x}px`;
        noButton.style.top = `${y}px`;
        noButton.style.transform = `rotate(${Math.random() * 16 - 8}deg)`;
    }

    noButton.addEventListener("pointerenter", moveNoButton);
    noButton.addEventListener("focus", moveNoButton);
    noButton.addEventListener("pointerdown", event => {
        event.preventDefault();
        moveNoButton();
    });
    noButton.addEventListener("click", event => {
        event.preventDefault();
        moveNoButton();
    });

    yesButton.addEventListener("click", () => {
        if (opened) return;
        opened = true;
        yesButton.disabled = true;
        noButton.remove();
        document.body.classList.remove("intro-active");
        document.body.classList.add("reveal-active");
        intro.classList.add("hide");
        reveal.classList.add("show");
        reveal.setAttribute("aria-hidden", "false");
        window.loveMusic?.startFromUserGesture();

        window.setTimeout(() => {
            document.body.classList.remove("reveal-active");
            site.classList.add("show");
            site.setAttribute("aria-hidden", "false");
            window.loveGalleries?.load();
            window.loveAnimations?.observe();
        }, 3900);
    });
})();
