# Bookmark Organizer (Chrome Extension)

A Chrome extension that replaces your New Tab page with a powerful bookmark browser and AI-powered organizer. Tired of messy bookmarks? This extension helps you search, filter, and automatically organize your bookmarks into logical categories using OpenAI.

## Features

- **New Tab Replacement**: Fast bookmark browser with folder tree, search, tags, and filters
- **AI-Powered Organization**: Automatically suggests folder moves, tags, and title cleanups
- **Smart Categorization**: Classifies bookmarks and folders into category folders (customizable)
- **Selective Organizing**: Organize all bookmarks or target a specific folder
- **Preview Before Apply**: Review all AI suggestions before making changes
- **Backup Export**: Automatically exports a backup before applying changes
- **Privacy-First**: URL redaction enabled by default (sends only domain + redacted path)

## Installation (Chrome Developer Mode)

Since this extension isn't on the Chrome Web Store, you'll need to load it manually:

1. **Download the extension**
   - Clone or download this repository to your computer

2. **Open Chrome Extensions**
   - Open Chrome and navigate to `chrome://extensions`
   - Or go to Menu (⋮) → Extensions → Manage Extensions

3. **Enable Developer Mode**
   - Toggle the **Developer mode** switch in the top-right corner

4. **Load the Extension**
   - Click **Load unpacked**
   - Select the `bookmark-organizer-extension` folder
   - The extension should now appear in your extensions list

5. **Verify Installation**
   - Open a new tab — you should see the Bookmark Organizer interface

## Configuring Your OpenAI API Key

The AI organization features require an OpenAI API key. Here's how to set it up:

1. **Get an API Key**
   - Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Sign in or create an account
   - Click **Create new secret key** and copy the key (starts with `sk-`)

2. **Open Extension Settings**
   - Click the gear icon (⚙️) in the Bookmark Organizer new tab page
   - Or right-click the extension icon → **Options**

3. **Enter Your API Key**
   - Paste your API key into the **OpenAI API Key** field
   - Click **Save**

4. **Start Organizing**
   - Return to the new tab page
   - Click **AI Organize** to analyze and categorize your bookmarks
   - Review the suggestions and apply the ones you want

**Note**: Your API key is stored locally in your browser and is only sent to OpenAI's API. It is never logged or shared elsewhere. You can clear it anytime using the **Clear key** button in Settings.

## Permissions
- `bookmarks`: read the tree, move bookmarks, and rename when enabled.
- `storage`: store settings, tags, and backup metadata locally.

## Privacy Notes
- Default behavior sends only **title + domain + redacted path + folder path** (folder items include title + path).
- You can allow full URL sending in Settings (off by default).
- A preflight preview shows exactly what will be sent before the first request in each session.

## Security
- API key is stored in `chrome.storage.local`, not sync.
- The key is never logged or sent anywhere except OpenAI.
- Use the **Clear key** button if you want to remove the key immediately.

## Manual Test Checklist
- Fresh install: open new tab and see bookmark list + folder tree.
- Settings: save key/model, clear key.
- Settings: set category root folder name.
- Settings: set category root parent (top-level folder name).
- AI Organize without key: shows prompt to add key.
- AI Organize with key: shows privacy preview; run and see proposal.
- Folder scope: select a folder or use the AI button next to a folder entry.
- Preview: toggle suggestions and apply selected changes.
- Export backup: JSON file downloads and stored in local storage.
- Large set: verify chunking with >200 bookmarks (progress messages).

## Known Limitations
- Duplicate detection is advisory only (no deletions).
- Folder collapse state resets on reload.
- Structured output validation is schema-based but not fully JSON-Schema compliant.

## Development Notes
- No build step. Vanilla HTML/CSS/JS.
- OpenAI Responses endpoint used directly from the extension.

## Release Workflow

### Scripts

- **`scripts/validate.sh`** - Pre-release validation (JSON validity, Manifest V3, required fields, version format, icons, description length, console.log warnings)
- **`scripts/bump-version.sh`** - Version management
- **`scripts/package.sh`** - Creates zip for Chrome Web Store upload

### Releasing a New Version

```bash
# 1. Bump version (major|minor|patch)
./scripts/bump-version.sh patch

# 2. Validate the extension
./scripts/validate.sh

# 3. Create the package
./scripts/package.sh

# 4. Test: Load dist/ contents as unpacked extension in Chrome
#    chrome://extensions > Developer mode > Load unpacked

# 5. Upload dist/bookmark-organizer-v*.zip to Chrome Web Store
```

### Chrome Web Store Requirements

**Already satisfied:**
- Manifest V3
- Icons: 16x16, 48x48, 128x128
- Description under 132 characters
- Minimal permissions (bookmarks, storage)

**For store submission (manual):**
- Screenshots (1280x800 or 640x400) - 1-5 required
- Optional: Promotional tiles (440x280, 920x680, 1400x560)
- Privacy policy (if collecting data)
- Detailed store description
