const urlInput = document.getElementById("urlInput");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");
const btnText = downloadBtn.querySelector(".btn-text");
const spinner = document.getElementById("spinner");
const statusPanel = document.getElementById("statusPanel");
const statusMessage = document.getElementById("statusMessage");
const platformTag = document.getElementById("platformTag");

urlInput.addEventListener("input", () => {
  const val = urlInput.value.trim().toLowerCase();
  clearBtn.classList.toggle("hidden", val.length === 0);

  if (val.includes("spotify.com")) {
    const isPlaylist = val.includes("playlist") || val.includes("album");
    platformTag.innerHTML = `🟢 Spotify Detected (${isPlaylist ? "Full Playlist/Album - 8x Turbo" : "Single Track"})`;
    platformTag.className = "platform-tag platform-spotify";
  } else if (val.includes("youtube.com") || val.includes("youtu.be")) {
    const isPlaylist = val.includes("list=");
    platformTag.innerHTML = `🔴 YouTube Detected (${isPlaylist ? "Full Playlist - 8x Turbo" : "Single Video"})`;
    platformTag.className = "platform-tag platform-youtube";
  } else {
    platformTag.textContent = "Supported: YouTube & Spotify links";
    platformTag.className = "platform-tag";
  }
});

clearBtn.addEventListener("click", () => {
  urlInput.value = "";
  clearBtn.classList.add("hidden");
  platformTag.textContent = "Supported: YouTube & Spotify links";
  platformTag.className = "platform-tag";
  urlInput.focus();
});

downloadBtn.addEventListener("click", async () => {
  const url = urlInput.value.trim();
  if (!url) {
    alert("Please paste a valid YouTube or Spotify link.");
    return;
  }

  downloadBtn.disabled = true;
  spinner.classList.remove("hidden");
  btnText.textContent = "Turbo Downloading (8x Streams)...";
  statusPanel.classList.remove("hidden");
  statusMessage.className = "status-message";
  statusMessage.textContent = "Running 8 parallel audio download streams... Track progress in the black command window.";

  try {
    const response = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ detail: "Download failed" }));
      throw new Error(errData.detail || "Server error");
    }

    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = "audio_download.mp3";
    if (contentDisposition && contentDisposition.includes("filename=")) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    } else if (url.includes("playlist") || url.includes("album") || url.includes("list=")) {
      filename = "playlist_turbo.zip";
    }

    statusMessage.textContent = "Instant packaging completed! Transferring to browser...";
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    a.remove();

    statusMessage.textContent = `✅ Complete! Downloaded "${filename}".`;
    statusMessage.className = "status-message status-success";
  } catch (error) {
    statusMessage.textContent = `❌ Error: ${error.message}`;
    statusMessage.className = "status-message status-error";
  } finally {
    downloadBtn.disabled = false;
    spinner.classList.add("hidden");
    btnText.textContent = "⚡ Turbo Download Now";
  }
});
