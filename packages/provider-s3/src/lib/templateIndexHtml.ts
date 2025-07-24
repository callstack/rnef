export const templateIndexHtmlPlugin = ({
  appName,
  version,
  bundleIdentifier,
  manifestPlistUrl,
}: {
  appName: string;
  version: string;
  bundleIdentifier: string;
  manifestPlistUrl: string;
}) => {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Download iOS App</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
          Oxygen, Ubuntu, Cantarell, sans-serif;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        font-size: 16px;
      }

      .container {
        text-align: center;
        max-width: 500px;
        width: 100%;
      }

      .app-icon {
        width: 100px;
        height: 100px;
        margin: 0 auto 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 48px;
        color: white;
      }

      h1 {
        color: #1d1d1f;
        font-size: 28px;
        font-weight: 600;
        margin-bottom: 15px;
        overflow-wrap: break-word;
      }

      .subtitle {
        color: #86868b;
        font-size: 16px;
        line-height: 1.5;
        margin-bottom: 30px;
      }

      .version {
        color: #1d1d1f;
        font-size: 16px;
        line-height: 1.5;
        margin-bottom: 10px;
      }

      .download-button {
        background: #8232ff;
        color: white;
        border: none;
        padding: 16px 32px;
        border-radius: 2px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
        display: inline-block;
        margin-bottom: 20px;
      }

      .download-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 25px rgba(0, 122, 255, 0.3);
      }

      .download-button:active {
        transform: translateY(0);
      }

      .instructions {
        background: #f5f5f7;
        border-radius: 2px;
        padding: 20px;
        margin-top: 20px;
        text-align: left;
      }

      .instructions h3 {
        color: #1d1d1f;
        font-size: 16px;
        margin-bottom: 10px;
      }

      .instructions ol {
        color: #86868b;
        font-size: 14px;
        line-height: 1.6;
        padding-left: 20px;
      }

      .instructions li {
        margin-bottom: 8px;
      }

      .adhoc-info {
        text-align: left;
        margin-top: 20px;
        padding: 1em 2em;
        border-left: 2px solid #8232ff;
      }

      .adhoc-info-title {
        font-weight: 600;
        margin-bottom: 10px;
      }

      .adhoc-info-text {
        color: #1d1d1f;
        margin: 0;
      }

      .footer {
        text-align: center;
        margin-top: 40px;
        font-size: 12px;
        color: #86868b;
      }

      .link {
        color: #8232ff;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="app-icon">📱</div>

      <h1>${appName}</h1>
      <p class="version">${bundleIdentifier} (${version})</p>
      <p class="subtitle">
        Download and install the latest version of our iOS app directly to your
        device.
      </p>

      <a
        href="itms-services://?action=download-manifest&url=${manifestPlistUrl}"
        class="download-button">
        Download App
      </a>

      <div class="instructions">
        <h3>Installation Instructions:</h3>
        <ol>
          <li>Tap the "Download App" button above</li>
          <li>If prompted, tap "Install" in the popup dialog</li>
          <li>Go to Settings > General > VPN & Device Management</li>
          <li>Find your developer certificate and tap "Trust"</li>
          <li>The app will now be available on your home screen</li>
        </ol>
      </div>

      <div class="adhoc-info">
        <p class="adhoc-info-title">Ad-hoc build notice</p>
        <p class="adhoc-info-text">
          This is an ad-hoc build for testing purposes. Make sure you're using a
          device that's registered in the provisioning profile.
        </p>
      </div>
      <div class="footer">
        <p>
          Generated with <a class="link" href="https://rnef.dev">RNEF</a> by
          <a class="link" href="https://callstack.com">Callstack</a>
        </p>
      </div>
    </div>
  </body>
</html>
`;
};
