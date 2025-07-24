export const templateManifestPlistPlugin = ({
  baseUrl,
  ipaName,
  bundleIdentifier,
  version,
  appName,
  platformIdentifier,
}: {
  baseUrl: string;
  ipaName: string;
  bundleIdentifier: string;
  version: string;
  appName: string;
  platformIdentifier: string;
}) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>items</key>
    <array>
        <dict>
            <key>assets</key>
            <array>
                <dict>
                    <key>kind</key>
                    <string>software-package</string>
                    <key>url</key>
                    <string>${baseUrl}/${ipaName}</string>
                </dict>
            </array>
            <key>metadata</key>
            <dict>
                <key>bundle-identifier</key>
                <string>${bundleIdentifier}</string>
                <key>bundle-version</key>
                <string>${version}</string>
                <key>kind</key>
                <string>software</string>
                <key>platform-identifier</key>
                <string>${
                  platformIdentifier ?? 'com.apple.platform.iphoneos'
                }</string>
                <key>title</key>
                <string>${appName}</string>
            </dict>
        </dict>
      </array>
    </dict>
  </plist>`;
};
