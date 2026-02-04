# Contributing to Bookmark Organizer Extension

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites

- Google Chrome (or Chromium-based browser)
- Git
- A text editor or IDE

No Node.js or build tools are required—this is a vanilla JavaScript project.

### Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/jggonz/bookmark-organizer-extension.git
   cd bookmark-organizer-extension
   ```

2. Load the extension in Chrome:
   - Open `chrome://extensions`
   - Enable **Developer Mode** (toggle in top-right corner)
   - Click **Load unpacked**
   - Select the project directory

3. The extension is now active. Open a new tab to see it in action.

4. After making changes, click the reload icon on the extension card in `chrome://extensions` to apply updates.

## Project Structure

```
bookmark-organizer-extension/
├── manifest.json          # Chrome extension config (Manifest V3)
├── newtab.html/css/js     # Main New Tab UI
├── options.html/css/js    # Settings page
├── lib/                   # Core modules
│   ├── bookmarks.js       # Chrome Bookmarks API wrapper
│   ├── openai.js          # OpenAI integration
│   ├── storage.js         # Chrome storage wrapper
│   ├── privacy.js         # URL redaction logic
│   └── diff.js            # Diff/preview builder
├── scripts/               # Build & release scripts
└── assets/                # Extension icons
```

## Code Style

This project uses vanilla JavaScript (ES6 modules). Follow these guidelines:

- Use ES6+ features (const/let, arrow functions, template literals, async/await)
- Use meaningful variable and function names
- Keep functions focused and reasonably sized
- Add comments only where the logic isn't self-evident
- Avoid leaving `console.log` statements in production code (the validation script checks for these)

## Testing

### Manual Testing Checklist

Before submitting a PR, verify:

- [ ] Extension loads without errors in `chrome://extensions`
- [ ] New Tab page displays correctly
- [ ] Bookmarks load and display properly
- [ ] Search/filter functionality works
- [ ] Settings page opens and saves correctly
- [ ] No errors in the browser console

### Validation Script

Run the validation script before submitting:

```bash
./scripts/validate.sh
```

This checks:
- JSON file validity
- Manifest V3 compliance
- Required fields present
- Version format
- Icon files exist
- Console.log warnings

## Submitting Pull Requests

1. **Fork the repository** and create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guidelines.

3. **Test thoroughly** using the manual testing checklist.

4. **Run validation**:
   ```bash
   ./scripts/validate.sh
   ```

5. **Commit with a clear message**:
   ```bash
   git commit -m "Add feature: brief description"
   ```

6. **Push and open a PR**:
   ```bash
   git push origin feature/your-feature-name
   ```
   Then open a Pull Request on GitHub with:
   - A clear title describing the change
   - Description of what was changed and why
   - Screenshots if UI changes are involved

## Questions?

Open an issue if you have questions or need help getting started.
