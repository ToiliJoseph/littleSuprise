(() => {
    const galleryKinds = {
        her: "her",
        him: "him",
        dances: "dances"
    };

    async function loadGalleries() {
        try {
            const response = await fetch("/api/media");
            if (!response.ok) throw new Error(`Gallery request failed (${response.status})`);
            const media = await response.json();

            for (const [key, category] of Object.entries(galleryKinds)) {
                const container = document.querySelector(`[data-gallery="${key}"]`);
                if (!container) continue;
                const items = media.filter(item => item.category === category);
                if (key === "her" || key === "him") {
                    const placeholders = Array.from(container.querySelectorAll(":scope > img"));
                    const photos = items.filter(item => item.type.startsWith("image/")).slice(0, placeholders.length);
                    if (!photos.length) continue;

                    placeholders.forEach((image, index) => {
                        const photo = photos[index];
                        if (!photo) {
                            image.remove();
                            return;
                        }
                        image.src = photo.url;
                        image.alt = key === "her" ? "A photo of Mon Amour" : "A photo of Joseph";
                    });
                    continue;
                }
                for (const item of items) {
                    const card = document.createElement("article");
                    card.className = "gallery-item";
                    const source = document.createElement(item.type.startsWith("video/") ? "video" : "img");
                    source.src = item.url;
                    if (source instanceof HTMLVideoElement) {
                        source.controls = true;
                        source.preload = "metadata";
                        source.playsInline = true;
                    } else {
                        source.alt = item.name || "A special memory";
                        source.loading = "lazy";
                    }
                    card.appendChild(source);
                    if (item.name) {
                        const caption = document.createElement("span");
                        caption.className = "gallery-caption";
                        caption.textContent = item.name;
                        card.appendChild(caption);
                    }
                    container.appendChild(card);
                }
            }
            window.loveAnimations?.observe();
        } catch (error) {
            console.error("Unable to load uploaded galleries.", error);
        }
    }

    window.loveGalleries = { load: loadGalleries };
})();