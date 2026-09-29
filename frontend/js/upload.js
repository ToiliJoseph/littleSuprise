(() => {
    const uploadForm = document.getElementById("uploadForm");
    const category = document.getElementById("category");
    const filesInput = document.getElementById("filesInput");
    const fileHint = document.getElementById("fileHint");
    const fileSelection = document.getElementById("fileSelection");
    const uploadMessage = document.getElementById("uploadMessage");
    const uploadButton = document.getElementById("uploadButton");
    if (!uploadForm || !category || !filesInput || !uploadButton) return;

    const formats = {
        memories: { accept: "image/jpeg,image/png,image/webp,image/gif", hint: "JPG, PNG, WebP, or GIF · up to 12 MB each; up to 90 photos", maxSize: 12 * 1024 * 1024, maxFiles: 90 },
        her: { accept: "image/jpeg,image/png,image/webp,image/gif", hint: "JPG, PNG, WebP, or GIF · up to 12 MB each; up to 90 photos", maxSize: 12 * 1024 * 1024, maxFiles: 90 },
        him: { accept: "image/jpeg,image/png,image/webp,image/gif", hint: "JPG, PNG, WebP, or GIF · up to 12 MB each; up to 90 photos", maxSize: 12 * 1024 * 1024, maxFiles: 90 },
        dances: { accept: "video/mp4,video/webm", hint: "MP4 or WebM videos · up to 40 MB each", maxSize: 40 * 1024 * 1024, maxFiles: 10 },
        music: {
            accept: "audio/*,.mp3,.m4a,.aac,.ogg,.oga,.opus,.wav,.wave,.flac,.wma,.aif,.aiff,.amr,.mid,.midi,.ac3,.ape,.caf,.weba,.mka,.mpc",
            hint: "MP3, M4A, AAC, OGG/Opus, WAV, FLAC, WMA, AIFF, AMR, MIDI, AC3, APE, CAF, WebM, Matroska, Musepack · up to 20 MB",
            maxSize: 20 * 1024 * 1024,
            maxFiles: 1
        }
    };
    const maxBatchBytes = 50 * 1024 * 1024;
    const maxSelectionBytes = 450 * 1024 * 1024;
    const maxFilesPerRequest = 10;

    category.addEventListener("change", () => {
        const format = formats[category.value];
        filesInput.accept = format.accept;
        filesInput.multiple = category.value !== "music";
        fileHint.textContent = format.hint;
        filesInput.value = "";
        fileSelection.textContent = "No files selected yet";
        uploadMessage.textContent = "";
    });

    filesInput.addEventListener("change", () => {
        const files = Array.from(filesInput.files || []);
        fileSelection.textContent = files.length
            ? files.map(file => file.name).join(", ")
            : "No files selected yet";
        uploadMessage.textContent = "";
    });

    uploadForm.addEventListener("submit", async event => {
        event.preventDefault();
        const files = Array.from(filesInput.files || []);
        if (!files.length) {
            uploadMessage.textContent = "Choose at least one file first.";
            return;
        }
        const format = formats[category.value];
        if (files.length > format.maxFiles) {
            uploadMessage.textContent = `Choose no more than ${format.maxFiles} ${format.maxFiles === 1 ? "file" : "files"} at once.`;
            return;
        }
        if (files.some(file => file.size > format.maxSize)) {
            uploadMessage.textContent = `One or more files are too large. ${format.hint}`;
            return;
        }
        const selectionBytes = files.reduce((total, file) => total + file.size, 0);
        if (selectionBytes > maxSelectionBytes) {
            uploadMessage.textContent = "The selected files together must be smaller than 450 MB per hour.";
            return;
        }

        const batches = [];
        let batch = [];
        let batchBytes = 0;
        for (const file of files) {
            if (batch.length && (batch.length >= maxFilesPerRequest || batchBytes + file.size > maxBatchBytes)) {
                batches.push(batch);
                batch = [];
                batchBytes = 0;
            }
            batch.push(file);
            batchBytes += file.size;
        }
        if (batch.length) batches.push(batch);

        uploadButton.disabled = true;
        let uploaded = 0;
        uploadMessage.textContent = `Adding ${files.length} ${files.length === 1 ? "file" : "files"}...`;
        try {
            for (let index = 0; index < batches.length; index += 1) {
                const encodedFiles = await Promise.all(batches[index].map(async file => {
                    const dataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
                        reader.readAsDataURL(file);
                    });
                    return { name: file.name, type: file.type, data: String(dataUrl).split(",")[1] };
                }));
                const response = await fetch("/api/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ category: category.value, files: encodedFiles })
                });
                const responseText = await response.text();
                let result = null;
                try {
                    result = responseText ? JSON.parse(responseText) : null;
                } catch {
                    const message = response.ok
                        ? "The server response could not confirm this batch. Check the gallery before retrying."
                        : `Upload failed (HTTP ${response.status}); the server returned an unreadable response.`;
                    throw new Error(message);
                }
                if (!response.ok) throw new Error(result?.error || `Upload failed (HTTP ${response.status}).`);
                if (result?.uploaded !== batches[index].length) {
                    throw new Error("The server response could not confirm every file in this batch.");
                }
                uploaded += result.uploaded;
                uploadMessage.textContent = `Added ${uploaded} of ${files.length} files...`;
            }
            uploadForm.reset();
            category.dispatchEvent(new Event("change"));
            uploadMessage.textContent = `${uploaded} ${uploaded === 1 ? "file is" : "files are"} in your story now.`;
        } catch (error) {
            const reason = error.message || "The upload could not be completed.";
            uploadMessage.textContent = uploaded
                ? `Added ${uploaded} of ${files.length} files before stopping: ${reason} Retry only the files that remain.`
                : reason;
        } finally {
            uploadButton.disabled = false;
        }
    });
})();
