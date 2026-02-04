#!/bin/bash
# Bump the extension version in manifest.json
# Usage: ./scripts/bump-version.sh [major|minor|patch]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Default to patch if no argument provided
BUMP_TYPE="${1:-patch}"

if [[ ! "$BUMP_TYPE" =~ ^(major|minor|patch)$ ]]; then
    echo "Usage: $0 [major|minor|patch]"
    echo "  major: x.0.0 (breaking changes)"
    echo "  minor: 0.x.0 (new features)"
    echo "  patch: 0.0.x (bug fixes)"
    exit 1
fi

# Read current version from manifest.json
CURRENT_VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")

if [ -z "$CURRENT_VERSION" ]; then
    echo "Error: Could not read version from manifest.json"
    exit 1
fi

# Parse version components
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Increment appropriate component
case "$BUMP_TYPE" in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

# Update manifest.json
python3 -c "
import json

with open('manifest.json', 'r') as f:
    manifest = json.load(f)

manifest['version'] = '$NEW_VERSION'

with open('manifest.json', 'w') as f:
    json.dump(manifest, f, indent=2)
    f.write('\n')
"

echo "Version bumped: $CURRENT_VERSION -> $NEW_VERSION"
