# diffreal-cli

Web page image analyzer - classifies images as **realistic** or **AI-generated** using deep learning.

Supports Windows, macOS, and Linux.

## Features

- Analyzes all images on a web page (default: 300x300px minimum)
- Local AI inference using transformers.js (no API keys needed)
- Shows the highest scoring image in summary
- Configurable image size threshold
- Maintains browser session for login-protected sites
- Cloudflare bypass with stealth mode

## Installation

### Global Install (recommended)
```bash
npm install -g diffreal-cli
```

### From local tgz file
```bash
npm install -g ./dist/diffreal-cli-1.0.0.tgz
```

### From source
```bash
git clone <repo>
cd diffReal/cli
npm install -g .
```

## Usage

### Command Line
```bash
# Basic usage
diffreal https://example.com

# With custom image size threshold (minimum 100px)
diffreal --size 100 https://example.com

# With custom realistic threshold (0.7+ = REAL)
diffreal -t 0.7 https://example.com

# Combined options
diffreal -s 300 -t 0.7 https://pinterest.com/search/pins/?q=cat

# Show help
diffreal --help
```

### Interactive Mode
```bash
diffreal
```

### Commands (Interactive Mode)

| Command | Description |
|---------|-------------|
| `<URL>` | Analyze images on the page |
| `size <N>` | Set minimum image size (e.g., `size 300`) |
| `threshold <N>` | Set realistic threshold (e.g., `threshold 0.7`) |
| `login` | Open browser for 30s to login (solves Cloudflare/login) |
| `headless` | Toggle headless mode ON/OFF |
| `quit` | Exit |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --size <N>` | Minimum image size in pixels | 300 |
| `-t, --threshold <N>` | Realistic threshold (0-1) | 0.5 |
| `-h, --help` | Show help | - |

## Score Interpretation

- **Score > threshold**: REAL (realistic photo) - shown in green
- **Score <= threshold**: AI (AI-generated image) - shown in orange

## Output Example

```
📷 25개 이미지 발견

[1/25] 분석 중... [████████░░░░░░░░░░░░] 0.397 AI
[2/25] 분석 중... [███████████░░░░░░░░░] 0.569 REAL
...

════════════════════════════════════════════════════════════
📊 분석 결과 요약
════════════════════════════════════════════════════════════
총 이미지: 25개
Realistic: 5개
AI Image: 20개
평균 점수: 0.392
────────────────────────────────────────────────────────────
🏆 최고 점수 이미지:
   점수: 0.892
   URL: https://example.com/image.jpg
════════════════════════════════════════════════════════════
```

## Login-Protected / Cloudflare Sites

For sites requiring login or Cloudflare challenge:

```bash
diffreal
# URL> headless     # Turn off headless mode
# URL> login        # Browser opens - login/solve captcha within 30 seconds
# Session is saved automatically
# URL> https://arca.live/b/aiartreal/158431018
```

### Session Storage Location
- **Windows**: `%USERPROFILE%\.diffreal\browser-data`
- **macOS/Linux**: `~/.diffreal/browser-data`

## Platform Notes

### Windows
- Use **Windows Terminal** or **PowerShell** for best display (emoji/colors)
- Chrome is automatically downloaded by puppeteer on first run
- If you see garbled characters, run: `chcp 65001` before starting

### macOS / Linux
- Works out of the box
- Chrome is automatically downloaded by puppeteer on first run

## Requirements

- Node.js >= 18.0.0
- ~300MB disk space (for Chrome + model)

## Model

Uses [Deep-Fake-Detector-v2-Model-ONNX](https://huggingface.co/onnx-community/Deep-Fake-Detector-v2-Model-ONNX) (ViT-based, 92% accuracy).

First run will download the model (~90MB) which is then cached locally.

## Troubleshooting

### "Cannot find Chrome" on Windows
Puppeteer should auto-download Chrome. If it fails:
```bash
npx puppeteer browsers install chrome
```

### Cloudflare keeps blocking
1. Run `headless` to turn off headless mode
2. Run `login` to open browser
3. Navigate to the site and solve the challenge manually
4. Wait for session to save
5. Enter the URL again

### Too few images found
Try lowering the size threshold:
```bash
diffreal --size 50 https://example.com
```

### Slow first run
First run downloads:
1. Chrome browser (~150MB)
2. AI model (~90MB)

Subsequent runs are much faster.

## License

MIT
