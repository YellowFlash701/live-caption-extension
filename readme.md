# Live Caption Extension

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/live-caption-extension/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Live Caption Extension** adds real-time captions to any audio or video playing in your browser. Whether you're watching a tutorial, a live stream, or a conference call, this extension automatically generates and displays subtitles directly on the page. It supports multiple languages and offers customizable appearance settings.

---

## ✨ Features

- **Real-time captioning** – Generates captions as audio plays.
- **Works on any website** – Captions appear as an overlay on any `<video>` or `<audio>` element, or via microphone input.
- **Multiple language support** – Choose from over 100 languages for both transcription and display.
- **Customizable appearance** – Adjust font size, color, background, and position of the caption box.
- **Offline mode** – Uses on-device speech recognition (when supported) for privacy and low latency.
- **Keyboard shortcuts** – Toggle captions on/off quickly.
- **Export transcripts** – Save the entire session's transcript as a text file.
- **Lightweight** – Minimal performance impact.

---

## 📦 Installation

### From the Chrome Web Store (or Edge Add-ons, Firefox Add-ons)

1. Visit the [Chrome Web Store](https://chrome.google.com/webstore) and search for "Live Caption Extension".
2. Click **Add to Chrome**.
3. The extension icon will appear in your toolbar.

### Manual Installation (Developer Mode)

1. Download the latest release from [GitHub Releases](https://github.com/yourusername/live-caption-extension/releases).
2. Unzip the package.
3. Open `chrome://extensions` (or your browser's extensions page).
4. Enable **Developer mode** (toggle in the top right).
5. Click **Load unpacked** and select the unzipped folder.
6. The extension is now installed.

---

## 🚀 Usage

1. Navigate to any page with audio/video content (e.g., YouTube, Netflix, a podcast player, or a meeting app).
2. Click the **Live Caption** icon in your browser toolbar to open the popup.
3. Click the **Start Captioning** button.
4. Captions will appear as an overlay on the active media element. If no media is found, you can enable microphone input to caption live speech from your surroundings.
5. To stop, click the popup again and select **Stop Captioning**.

### Keyboard Shortcuts

- `Ctrl+Shift+C` (Windows/Linux) / `Cmd+Shift+C` (Mac) – Toggle captions on/off.
- `Ctrl+Shift+T` – Export current transcript.

_(Shortcuts can be customized in the extension settings.)_

---

## ⚙️ Configuration

Click the extension icon and select **Settings** to access:

- **Language** – Choose the source language and the display language.
- **Caption Style** – Font, size, color, background opacity, and position (top/bottom/left/right).
- **Auto-start** – Automatically enable captions when a media element is detected.
- **Microphone Mode** – Toggle to caption ambient audio from your microphone.
- **Save Transcript** – Automatically save transcripts to your downloads folder.

---

## 🛠️ Troubleshooting

| Issue                  | Solution                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Captions not appearing | Ensure the page has an active video/audio element. Refresh the page and try again.                         |
| Captions are delayed   | This can happen on slower devices. Try reducing the caption font size or disabling background effects.     |
| Microphone not working | Check that you have granted microphone permissions to the extension (browser permission prompt).           |
| Unsupported language   | Some languages may not be available for on-device recognition. Check the settings for supported languages. |
| Extension icon missing | Re-add the extension from the browser's extensions page.                                                   |

If problems persist, please [open an issue](https://github.com/yourusername/live-caption-extension/issues) with details about your browser version and the website you're using.

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository.
2. Create a new branch: `git checkout -b feature/your-feature`.
3. Commit your changes: `git commit -m 'Add some feature'`.
4. Push to the branch: `git push origin feature/your-feature`.
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

---

## 💬 Acknowledgements

- Built with [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) and [MediaStream API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_API).
- Icons provided by [FontAwesome](https://fontawesome.com/).

---

**Enjoy seamless captioning everywhere!**  
If you like this extension, please ⭐ star the repository and share it with others.
