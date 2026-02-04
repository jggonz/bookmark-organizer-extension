# Security Policy

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

**Do NOT open a public issue for security vulnerabilities.**

### How to Report

1. **Email**: Contact the maintainers directly (see GitHub profile for contact info)
2. **GitHub Security Advisories**: Use the "Report a vulnerability" button in the Security tab of this repository

### What to Include

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Resolution**: Depends on severity and complexity

## Scope

This security policy covers:

- The browser extension code in this repository
- Chrome APIs usage and data handling
- OpenAI API integration and credential storage

## Security Considerations

This extension:

- Stores your OpenAI API key locally using Chrome's `chrome.storage` API
- Accesses your bookmarks via the Chrome Bookmarks API
- Sends bookmark titles (not URLs by default) to OpenAI for organization suggestions
- Does not collect or transmit data to any servers other than OpenAI when you initiate organization

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | Yes                |
| Older   | Best effort        |

We recommend always using the latest version from the Chrome Web Store.

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who report valid vulnerabilities (unless they prefer to remain anonymous).
