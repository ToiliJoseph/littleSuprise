(() => {
    const grid = document.getElementById("collectionGrid");
    const count = document.getElementById("collectionCount");
    const empty = document.getElementById("collectionEmpty");
    const error = document.getElementById("collectionError");
    const filters = Array.from(document.querySelectorAll("[data-filter]"));
    const lightbox = document.getElementById("photoLightbox");
    const lightboxImage = document.getElementById("lightboxImage");
    const lightboxCaption = document.getElementById("lightboxCaption");
    const ownerLoginForm = document.getElementById("ownerLoginForm");
    const ownerPassword = document.getElementById("ownerPassword");
    const ownerSession = document.getElementById("ownerSession");
    const ownerLogout = document.getElementById("ownerLogout");
    const ownerMessage = document.getElementById("ownerMessage");
    if (!grid || !count || !empty || !error || !lightbox || !lightboxImage || !lightboxCaption ||
        !ownerLoginForm || !ownerPassword || !ownerSession || !ownerLogout || !ownerMessage) return;

    const labels = {
        memories: "Our moments",
        her: "Mon Amour's gallery",
        him: "Joseph's gallery",
        dances: "Our dances"
    };
    let items = [];
    let activeFilter = "photos";
    let ownerAuthenticated = false;

    function setOwnerAuthenticated(authenticated) {
        ownerAuthenticated = authenticated;
        ownerLoginForm.hidden = authenticated;
        ownerSession.hidden = !authenticated;
        render();
    }

    async function readApiResponse(response) {
        const text = await response.text();
        let result;
        try {
            result = text ? JSON.parse(text) : null;
        } catch {
            throw new Error(`The server returned an unreadable response (HTTP ${response.status}).`);
        }
        if (!response.ok) {
            const responseError = new Error(result?.error || `Request failed (HTTP ${response.status}).`);
            responseError.status = response.status;
            throw responseError;
        }
        return result;
    }

    ownerLoginForm.addEventListener("submit", async event => {
        event.preventDefault();
        const submitButton = ownerLoginForm.querySelector("button[type=submit]");
        if (!(submitButton instanceof HTMLButtonElement)) return;
        submitButton.disabled = true;
        ownerMessage.textContent = "Checking owner password...";
        try {
            await readApiResponse(await fetch("../api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: ownerPassword.value })
            }));
            ownerPassword.value = "";
            ownerMessage.textContent = "Photo removal is unlocked for this browser session.";
            setOwnerAuthenticated(true);
        } catch (loginError) {
            ownerMessage.textContent = loginError.message || "Could not sign in.";
        } finally {
            submitButton.disabled = false;
        }
    });

    ownerLogout.addEventListener("click", async () => {
        ownerLogout.disabled = true;
        try {
            await readApiResponse(await fetch("../api/admin/logout", { method: "POST" }));
            setOwnerAuthenticated(false);
            ownerMessage.textContent = "You have signed out.";
        } catch (logoutError) {
            ownerMessage.textContent = logoutError.message || "Could not sign out.";
        } finally {
            ownerLogout.disabled = false;
        }
    });

    async function removePhoto(item) {
        if (!ownerAuthenticated) return;
        const label = item.name || labels[item.category] || "this photo";
        if (!window.confirm(`Permanently remove ${label} from the gallery?`)) return;
        ownerMessage.textContent = "Removing photo...";
        try {
            await readApiResponse(await fetch("../api/media/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category: item.category, filename: item.filename })
            }));
            items = items.filter(candidate =>
                candidate.category !== item.category || candidate.filename !== item.filename
            );
            if (lightbox.open && lightboxImage.src.endsWith(encodeURIComponent(item.filename))) lightbox.close();
            ownerMessage.textContent = "The photo has been removed.";
            render();
        } catch (deleteError) {
            if (deleteError.status === 401) setOwnerAuthenticated(false);
            ownerMessage.textContent = deleteError.message || "Could not remove this photo.";
        }
    }

    function matchesFilter(item) {
        return activeFilter === "photos"
            ? item.category !== "dances"
            : item.category === activeFilter;
    }

    function render() {
        grid.replaceChildren();
        const visibleItems = items.filter(matchesFilter);
        const noun = activeFilter === "dances"
            ? (visibleItems.length === 1 ? "dance" : "dances")
            : (visibleItems.length === 1 ? "photo" : "photos");
        count.textContent = `${visibleItems.length} ${noun} in this collection`;
        empty.hidden = visibleItems.length > 0;

        visibleItems.forEach((item, index) => {
            const card = document.createElement("article");
            card.className = `collection-card${item.category === "dances" ? " collection-card--dance" : ""}`;
            card.style.animationDelay = `${Math.min(index * 45, 360)}ms`;

            if (item.type.startsWith("video/")) {
                const video = document.createElement("video");
                video.className = "collection-video";
                video.src = item.url;
                video.controls = true;
                video.preload = "metadata";
                video.playsInline = true;
                video.setAttribute("aria-label", item.name || "A dance from our collection");
                card.appendChild(video);
            } else {
                const button = document.createElement("button");
                button.className = "collection-image-button";
                button.type = "button";
                button.setAttribute("aria-label", `View photo: ${item.name || labels[item.category]}`);
                const image = document.createElement("img");
                image.className = "collection-image";
                image.src = item.url;
                image.alt = item.name || labels[item.category];
                image.loading = "lazy";
                button.appendChild(image);
                button.addEventListener("click", () => {
                    lightboxImage.src = item.url;
                    lightboxImage.alt = image.alt;
                    lightboxCaption.textContent = item.name || labels[item.category];
                    lightbox.showModal();
                });
                card.appendChild(button);
            }

            const caption = document.createElement("div");
            caption.className = "collection-card-caption";
            const title = document.createElement("strong");
            title.textContent = item.name || labels[item.category] || "A special memory";
            const category = document.createElement("span");
            category.textContent = labels[item.category] || "Our story";
            caption.append(title, category);
            card.appendChild(caption);
            if (ownerAuthenticated && item.type.startsWith("image/")) {
                const actions = document.createElement("div");
                actions.className = "collection-card-actions";
                const removeButton = document.createElement("button");
                removeButton.className = "collection-remove";
                removeButton.type = "button";
                removeButton.textContent = "Remove photo";
                removeButton.setAttribute("aria-label", `Remove ${item.name || labels[item.category]} photo`);
                removeButton.addEventListener("click", () => removePhoto(item));
                actions.appendChild(removeButton);
                card.appendChild(actions);
            }
            grid.appendChild(card);
        });
        grid.setAttribute("aria-busy", "false");
    }

    filters.forEach(button => button.addEventListener("click", () => {
        activeFilter = button.dataset.filter || "photos";
        filters.forEach(filter => {
            const selected = filter === button;
            filter.classList.toggle("is-active", selected);
            filter.setAttribute("aria-pressed", String(selected));
        });
        render();
    }));

    lightbox.addEventListener("close", () => {
        lightboxImage.removeAttribute("src");
        lightboxCaption.textContent = "";
    });

    Promise.all([
        fetch("../api/media").then(response => {
            if (!response.ok) throw new Error(`Gallery request failed (HTTP ${response.status}).`);
            return response.json();
        }),
        fetch("../api/admin/session").then(response => {
            if (!response.ok) throw new Error(`Owner session request failed (HTTP ${response.status}).`);
            return response.json();
        }).catch(sessionError => {
            console.error("Unable to check the owner session.", sessionError);
            return { authenticated: false };
        })
    ])
        .then(([media, session]) => {
            if (!Array.isArray(media)) throw new Error("The server returned an invalid gallery response.");
            setOwnerAuthenticated(session.authenticated === true);
            items = media.filter(item =>
                item && ["memories", "her", "him", "dances"].includes(item.category) &&
                typeof item.url === "string" && typeof item.type === "string" && typeof item.filename === "string" &&
                (item.category === "dances" ? item.type.startsWith("video/") : item.type.startsWith("image/"))
            );
            render();
        })
        .catch(loadError => {
            console.error("Unable to load the photos and dances collection.", loadError);
            grid.setAttribute("aria-busy", "false");
            count.textContent = "We couldn't load the collection.";
            error.textContent = `${loadError.message || "The collection could not be loaded."} Please refresh to try again.`;
            error.hidden = false;
        });
})();
