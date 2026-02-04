#!/bin/bash
# Package the Bookmark Organizer extension for Chrome Web Store upload

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Read version from manifest.json
VERSION=$(grep -o '"version": *"[^"]*"' manifest.json | cut -d'"' -f4)

if [ -z "$VERSION" ]; then
    echo "Error: Could not read version from manifest.json"
    exit 1
fi

DIST_DIR="$PROJECT_DIR/dist"
ZIP_NAME="bookmark-organizer-v${VERSION}.zip"
ZIP_PATH="$DIST_DIR/$ZIP_NAME"

# Create dist directory
mkdir -p "$DIST_DIR"

# Remove old zip if it exists
if [ -f "$ZIP_PATH" ]; then
    rm "$ZIP_PATH"
fi

echo "Packaging Bookmark Organizer v${VERSION}..."

# Create zip with production files only
zip -r "$ZIP_PATH" \
    manifest.json \
    newtab.html newtab.js newtab.css \
    options.html options.js options.css \
    lib/ \
    assets/ \
    -x "*.DS_Store" \
    -x "*.git*"

echo ""
echo "Package created: $ZIP_PATH"
echo ""

# Show package contents
echo "Package contents:"
unzip -l "$ZIP_PATH"

# Show package size
SIZE=$(du -h "$ZIP_PATH" | cut -f1)
echo ""
echo "Package size: $SIZE"
