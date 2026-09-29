(() => {
    const audio = document.getElementById("backgroundMusic");
    if (!audio) return;

    const buttons = Array.from(document.querySelectorAll("#musicToggle"));
    const labelFor = currentButton => currentButton.querySelector(".music-label");
    const resumeKey = "mon-amour-music-resume-v1";
    let available = false;
    let savedResume = null;

    try {
        const savedState = window.sessionStorage.getItem(resumeKey);
        savedResume = savedState ? JSON.parse(savedState) : null;
    } catch (error) {
        console.info("Music playback position will not persist for this visit.", error);
    }

    function renderPlaying(playing) {
        buttons.forEach(currentButton => {
            currentButton.classList.toggle("is-playing", playing);
            currentButton.setAttribute("aria-pressed", String(playing));
            currentButton.setAttribute("aria-label", playing ? "Pause our music" : "Play our music");
            const label = labelFor(currentButton);
            if (label) label.textContent = playing ? "Pause song" : "Our song";
        });
    }

    function savePlaybackState() {
        if (!available) return;
        try {
            window.sessionStorage.setItem(resumeKey, JSON.stringify({
                src: new URL(audio.currentSrc || audio.src, window.location.href).pathname,
                currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
                wasPlaying: !audio.paused && !audio.ended
            }));
        } catch (error) {
            console.info("Music playback position could not be saved.", error);
        }
    }

    async function findSong() {
        try {
            const response = await fetch("/api/media");
            if (!response.ok) throw new Error(`Music request failed (${response.status})`);
            const media = await response.json();
            const track = media.find(item => item.category === "music");
            if (track) {
                audio.src = track.url;
                available = true;
                if (savedResume?.src === new URL(track.url, window.location.href).pathname && savedResume.wasPlaying) {
                    audio.addEventListener("loadedmetadata", () => {
                        if (Number.isFinite(savedResume.currentTime) && audio.duration > 0) {
                            audio.currentTime = savedResume.currentTime % audio.duration;
                        }
                        audio.play().catch(error => {
                            console.info("Music playback needs a tap to continue on this page.", error);
                            renderPlaying(false);
                        });
                    }, { once: true });
                    audio.load();
                }
            }
        } catch (error) {
            console.error("Unable to load the uploaded song.", error);
        }
    }

    buttons.forEach(currentButton => currentButton.addEventListener("click", async () => {
        if (!available) {
            window.alert("Add a song on the upload page first, then come back to play it.");
            return;
        }
        if (audio.paused) {
            try {
                await audio.play();
            } catch (error) {
                console.error("The song could not be played.", error);
                window.alert("The song could not be played. Please try again.");
            }
        } else {
            audio.pause();
        }
        savePlaybackState();
    }));

    audio.addEventListener("play", () => renderPlaying(true));
    audio.addEventListener("pause", () => {
        renderPlaying(false);
        savePlaybackState();
    });
    audio.addEventListener("timeupdate", savePlaybackState);
    window.addEventListener("pagehide", savePlaybackState);
    window.loveMusic = {
        startFromUserGesture() {
            if (!available) return;
            audio.play().then(savePlaybackState).catch(error => console.info("Music needs a tap to start.", error));
        }
    };

    findSong();
})();