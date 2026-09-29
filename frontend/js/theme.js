(() => {
    const root = document.documentElement;
    const buttons = document.querySelectorAll("[data-theme-toggle]");
    let theme = "light";

    try {
        const savedTheme = window.localStorage.getItem("mon-amour-theme-v4");
        if (savedTheme === "light" || savedTheme === "dark") theme = savedTheme;
    } catch (error) {
        console.info("Theme preference will not persist in this browser.", error);
    }

    function applyTheme() {
        root.dataset.theme = theme;
        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor) themeColor.content = theme === "dark" ? "#211b34" : "#fff6e9";
        buttons.forEach(button => {
            const lightMode = theme === "light";
            button.setAttribute("aria-label", `Switch to ${lightMode ? "dark" : "light"} theme`);
            button.setAttribute("aria-pressed", String(lightMode));
            const icon = button.querySelector(".theme-icon");
            const label = button.querySelector(".theme-label");
            if (icon) icon.textContent = lightMode ? "☾" : "☼";
            if (label) label.textContent = lightMode ? "Dark" : "Light";
        });
    }

    buttons.forEach(button => button.addEventListener("click", () => {
        theme = theme === "dark" ? "light" : "dark";
        applyTheme();
        try {
            window.localStorage.setItem("mon-amour-theme-v4", theme);
        } catch (error) {
            console.info("Theme preference could not be saved.", error);
        }
    }));

    applyTheme();
})();
