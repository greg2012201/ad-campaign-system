type TemplateAsset = {
  id: string;
  assetType: "image" | "video" | "html";
  url: string;
  durationMs: number | null;
};

type TemplateData = {
  campaignId: string;
  name: string;
  startAt: number;
  expireAt: number;
  assets: Array<TemplateAsset>;
};

const DEFAULT_DURATION_MS = 10000;

function buildAssetHtml(asset: TemplateAsset) {
  const id = `asset-${asset.id}`;

  switch (asset.assetType) {
    case "image":
      return `<div class="slide" id="${id}"><img src="${asset.url}" alt="" /></div>`;
    case "video":
      return `<div class="slide" id="${id}"><video src="${asset.url}" autoplay muted playsinline></video></div>`;
    case "html":
      return `<div class="slide" id="${id}"><iframe src="${asset.url}" frameborder="0" sandbox="allow-scripts allow-same-origin"></iframe></div>`;
  }
}

export function generateTemplate({ campaignId, name, startAt, expireAt, assets }: TemplateData) {
  const assetSlides = assets.map(buildAssetHtml).join("\n    ");

  const durations = assets.map((a) => a.durationMs ?? DEFAULT_DURATION_MS);
  const durationsJson = JSON.stringify(durations);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
  <style>
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #000;
      font-family: sans-serif;
    }

    .slide {
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      opacity: 0;
      transition: opacity 0.6s ease-in-out;
      z-index: 0;
    }

    .slide.active {
      opacity: 1;
      z-index: 1;
    }

    .slide img,
    .slide video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .slide iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }

    #campaign-label {
      position: fixed;
      bottom: 8px;
      left: 12px;
      color: rgba(255, 255, 255, 0.35);
      font-size: 12px;
      z-index: 9999;
      pointer-events: none;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    }

    #expired-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #000;
      z-index: 99999;
    }
  </style>
</head>
<body data-campaign-id="${campaignId}" data-start-at="${startAt}" data-expire-at="${expireAt}">
  <div id="slideshow">
    ${assetSlides}
  </div>
  <div id="campaign-label">${name}</div>
  <div id="expired-overlay"></div>
  <script>
    (function () {
      var expireAt = ${expireAt};
      var durations = ${durationsJson};
      var slides = document.querySelectorAll(".slide");
      var expiredOverlay = document.getElementById("expired-overlay");
      var currentIndex = 0;
      var timer = null;

      function checkExpiry() {
        if (Date.now() >= expireAt) {
          expiredOverlay.style.display = "block";
          if (timer) clearTimeout(timer);
          return true;
        }
        return false;
      }

      function showSlide(index) {
        if (checkExpiry()) return;
        for (var i = 0; i < slides.length; i++) {
          slides[i].classList.remove("active");
          var video = slides[i].querySelector("video");
          if (video) {
            video.pause();
            video.currentTime = 0;
          }
        }
        slides[index].classList.add("active");
        var activeVideo = slides[index].querySelector("video");
        if (activeVideo) {
          activeVideo.currentTime = 0;
          activeVideo.play();
        }
        var duration = durations[index] || ${DEFAULT_DURATION_MS};
        timer = setTimeout(function () {
          currentIndex = (currentIndex + 1) % slides.length;
          showSlide(currentIndex);
        }, duration);
      }

      if (slides.length > 0 && !checkExpiry()) {
        showSlide(0);
      }

      setInterval(checkExpiry, 5000);
    })();
  </script>
</body>
</html>`;
}
