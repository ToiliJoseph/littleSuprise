# Mon Amour

A small romantic website for Jamila: an animated “Do you love me?” opening, a love-message reveal, and a collection of shared memories, individual photo galleries, dance videos, reasons, a letter, and background music.

## Run it locally

Requires Node.js 18 or newer. There are no package dependencies to install.

From the project folder in PowerShell:

```powershell
node backend\server.js
```

Then open [http://127.0.0.1:3000](http://127.0.0.1:3000). Keep the server running while using the site. The upload page is [http://127.0.0.1:3000/pages/upload.html](http://127.0.0.1:3000/pages/upload.html), and the full [photos and dances gallery](http://127.0.0.1:3000/pages/gallery.html) collects every uploaded photo and dance video with category filters.

The site opens in a warm, colorful theme. Use the Light/Dark control in the navigation to switch between the warm sky and twilight palettes; your preference is saved in that browser. Animated sunshine (not on the opening question), drifting clouds, visible falling raindrops, bright floating hearts and butterflies, section reveals, and hover effects bring the pages to life. Visitors who enable reduced motion in their device settings see gentler versions of the moving effects.

## Add your keepsakes

The upload page is open to anyone with its link. Choose a section:

- **Our moments**, **Mon Amour's gallery**, and **Joseph's gallery** accept photos.
- **Our dances** accepts MP4 and WebM videos.
- **Our song** accepts common audio formats including MP3, M4A, AAC, OGG/Opus, WAV, FLAC, WMA, AIFF, AMR, MIDI, AC3, APE, CAF, WebM audio, Matroska audio, and Musepack.

Photo sections accept up to 90 selected photos in one upload operation. The browser sends them in smaller batches; each file remains limited to 12 MB, each request to 50 MB, and each network address to 450 MB and 90 files per hour. Video and audio limits remain unchanged.

Uploaded files are stored under `frontend/uploads/` and appear in the corresponding public gallery and the full photos-and-dances page. In that gallery, sign in with the owner password to permanently remove uploaded photos; each deletion asks for confirmation. The private password verifier lives in `backend/.admin-config.json`, outside the public frontend directory. Keep it private and include it when backing up the site; if it is missing, the site and uploads still work, but owner photo removal stays unavailable until the verifier is configured. Back up the uploads folder as well to keep your media. The site uses sample photos from Unsplash until you add your own; an internet connection is needed to load those samples and the web fonts.

The music player uses the latest uploaded song and its play/pause control is available on the story, upload, and photos-and-dances pages. When navigating between those pages, playback automatically resumes from its last position if the browser permits autoplay; some browsers require another tap after navigation. Actual playback support depends on the visitor's browser and device codecs.

## Personalize the story

Edit `frontend/index.html` to change the names, letter, reasons, and story text. The server binds to `127.0.0.1` by default. For deployment beyond your own computer, use HTTPS and consider adding moderation or storage limits because uploads are public.
