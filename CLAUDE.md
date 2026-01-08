# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

diffReal is a CLI tool that analyzes web page images to classify them as **realistic photos** (score > 0.5) or **AI-generated images** (score <= 0.5) using a ViT-based deep learning model.

## Commands

### Development
```bash
# Run from source
cd cli
node index.js [url]
node index.js --size 100 https://example.com

# Interactive mode
node index.js
```

### Building & Distribution
```bash
# Build tgz package (from cli directory)
cd cli
npm pack

# Move to dist and increment version in package.json
mv diffreal-cli-x.x.x.tgz ../dist/
```

### Installation
```bash
# Global install from tgz
npm install -g ./dist/diffreal-cli-x.x.x.tgz

# Or from source
cd cli && npm install -g .
```

## Architecture

### Core Components

- **`cli/index.js`** - Main CLI entry point with two modes:
  - Single URL mode: `diffreal <url>`
  - Interactive mode: `diffreal` (REPL-style)
  - Uses Puppeteer with stealth plugin for web scraping
  - Handles lazy-loaded images via page scrolling
  - Fetches images using page context (cookies/session) for auth-protected sites

- **`cli/classifier.js`** - Image classification wrapper around transformers.js
  - Model: `onnx-community/Deep-Fake-Detector-v2-Model-ONNX`
  - Handles both data URLs (base64) and regular URLs
  - Returns score 0-1 where >0.5 = realistic, <=0.5 = AI-generated

### Key Configuration (in index.js)
```javascript
CONFIG = {
  minImageSize: 300,  // Minimum image dimension (px)
  userDataDir: ~/.diffreal/browser-data,  // Session persistence
  headless: true
}
```

### Browser Session
Sessions are persisted to `~/.diffreal/browser-data` allowing login state to be maintained across runs. Use `login` command in interactive mode to authenticate to protected sites.

## Version Management

When making changes that affect functionality:
1. Update version in `cli/package.json` (e.g., 1.0.0 → 1.0.1)
2. Rebuild: `cd cli && npm pack`
3. Move to dist: `mv diffreal-cli-*.tgz ../dist/`
