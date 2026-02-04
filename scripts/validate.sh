#!/bin/bash
# Validate the extension before packaging

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

ERRORS=0
WARNINGS=0

echo "Validating Bookmark Organizer extension..."
echo ""

# Check 1: Valid JSON in manifest.json
echo -n "Checking manifest.json is valid JSON... "
if python3 -c "import json; json.load(open('manifest.json'))" 2>/dev/null; then
    echo "OK"
else
    echo "FAILED"
    echo "  Error: manifest.json is not valid JSON"
    ERRORS=$((ERRORS + 1))
fi

# Read manifest for subsequent checks
MANIFEST=$(cat manifest.json)

# Check 2: Manifest V3
echo -n "Checking Manifest V3 format... "
MANIFEST_VERSION=$(echo "$MANIFEST" | python3 -c "import json,sys; print(json.load(sys.stdin).get('manifest_version', ''))")
if [ "$MANIFEST_VERSION" = "3" ]; then
    echo "OK"
else
    echo "FAILED"
    echo "  Error: manifest_version must be 3, found: $MANIFEST_VERSION"
    ERRORS=$((ERRORS + 1))
fi

# Check 3: Required fields
echo -n "Checking required fields (name, version, description)... "
NAME=$(echo "$MANIFEST" | python3 -c "import json,sys; print(json.load(sys.stdin).get('name', ''))")
VERSION=$(echo "$MANIFEST" | python3 -c "import json,sys; print(json.load(sys.stdin).get('version', ''))")
DESCRIPTION=$(echo "$MANIFEST" | python3 -c "import json,sys; print(json.load(sys.stdin).get('description', ''))")

MISSING=""
[ -z "$NAME" ] && MISSING="$MISSING name"
[ -z "$VERSION" ] && MISSING="$MISSING version"
[ -z "$DESCRIPTION" ] && MISSING="$MISSING description"

if [ -z "$MISSING" ]; then
    echo "OK"
else
    echo "FAILED"
    echo "  Error: Missing required fields:$MISSING"
    ERRORS=$((ERRORS + 1))
fi

# Check 4: Version format (x.y.z)
echo -n "Checking version format (x.y.z)... "
if echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "OK (v$VERSION)"
else
    echo "FAILED"
    echo "  Error: Version must be in x.y.z format, found: $VERSION"
    ERRORS=$((ERRORS + 1))
fi

# Check 5: All icons exist
echo -n "Checking icons exist (16, 48, 128)... "
ICONS_MISSING=""
for size in 16 48 128; do
    ICON_PATH=$(echo "$MANIFEST" | python3 -c "import json,sys; print(json.load(sys.stdin).get('icons', {}).get('$size', ''))")
    if [ -z "$ICON_PATH" ]; then
        ICONS_MISSING="$ICONS_MISSING $size(not defined)"
    elif [ ! -f "$ICON_PATH" ]; then
        ICONS_MISSING="$ICONS_MISSING $size($ICON_PATH)"
    fi
done

if [ -z "$ICONS_MISSING" ]; then
    echo "OK"
else
    echo "FAILED"
    echo "  Error: Missing icons:$ICONS_MISSING"
    ERRORS=$((ERRORS + 1))
fi

# Check 6: Referenced HTML/JS files exist
echo -n "Checking referenced files exist... "
FILES_MISSING=""

# Check newtab override
NEWTAB=$(echo "$MANIFEST" | python3 -c "import json,sys; print(json.load(sys.stdin).get('chrome_url_overrides', {}).get('newtab', ''))")
if [ -n "$NEWTAB" ] && [ ! -f "$NEWTAB" ]; then
    FILES_MISSING="$FILES_MISSING $NEWTAB"
fi

# Check options page
OPTIONS=$(echo "$MANIFEST" | python3 -c "import json,sys; print(json.load(sys.stdin).get('options_page', ''))")
if [ -n "$OPTIONS" ] && [ ! -f "$OPTIONS" ]; then
    FILES_MISSING="$FILES_MISSING $OPTIONS"
fi

if [ -z "$FILES_MISSING" ]; then
    echo "OK"
else
    echo "FAILED"
    echo "  Error: Missing files:$FILES_MISSING"
    ERRORS=$((ERRORS + 1))
fi

# Check 7: Description under 132 characters
echo -n "Checking description length (max 132 chars)... "
DESC_LEN=${#DESCRIPTION}
if [ "$DESC_LEN" -le 132 ]; then
    echo "OK ($DESC_LEN chars)"
else
    echo "FAILED"
    echo "  Error: Description is $DESC_LEN characters (max 132)"
    ERRORS=$((ERRORS + 1))
fi

# Check 8: Warning for console.log statements
echo -n "Checking for console.log statements... "
CONSOLE_LOGS=$(grep -r "console\.log" --include="*.js" . 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
if [ "$CONSOLE_LOGS" -eq 0 ]; then
    echo "OK (none found)"
else
    echo "WARNING"
    echo "  Warning: Found $CONSOLE_LOGS console.log statement(s)"
    grep -rn "console\.log" --include="*.js" . 2>/dev/null | grep -v node_modules | sed 's/^/    /'
    WARNINGS=$((WARNINGS + 1))
fi

# Summary
echo ""
echo "================================"
if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo "Validation PASSED"
    else
        echo "Validation PASSED with $WARNINGS warning(s)"
    fi
    exit 0
else
    echo "Validation FAILED with $ERRORS error(s) and $WARNINGS warning(s)"
    exit 1
fi
