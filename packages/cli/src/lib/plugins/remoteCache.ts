import fs from 'node:fs';
import path from 'node:path';
import type { PluginApi, PluginOutput } from '@rnef/config';
import type { FingerprintSources, RemoteBuildCache } from '@rnef/tools';
import {
  formatArtifactName,
  getLocalArtifactPath,
  getLocalBinaryPath,
  handleDownloadResponse,
  logger,
  RnefError,
  spawn,
} from '@rnef/tools';
import AdmZip from 'adm-zip';
import * as tar from 'tar';

type Flags = {
  platform?: 'ios' | 'android';
  traits?: string[];
  name?: string;
  json?: boolean;
  all?: boolean;
  allButLatest?: boolean;
  binaryPath?: string;
};

async function remoteCache({
  action,
  args,
  remoteCacheProvider,
  projectRoot,
  fingerprintOptions,
}: {
  action: string;
  args: Flags;
  remoteCacheProvider: null | (() => RemoteBuildCache);
  projectRoot: string;
  fingerprintOptions: FingerprintSources;
}) {
  const isJsonOutput = args.json;
  if (!remoteCacheProvider) {
    return null;
  }
  const remoteBuildCache = remoteCacheProvider();

  validateArgs(args, action);

  const artifactName =
    args.name ??
    (await formatArtifactName({
      platform: args.platform,
      traits: args.traits,
      root: projectRoot,
      fingerprintOptions,
      raw: isJsonOutput,
    }));

  switch (action) {
    case 'list': {
      const artifacts = await remoteBuildCache.list({
        artifactName,
        limit: args.all ? undefined : 1,
      });
      if (artifacts.length > 0 && !args.all) {
        const artifact = artifacts[0];
        if (isJsonOutput) {
          console.log(JSON.stringify(artifact, null, 2));
        } else {
          logger.log(`- name: ${artifact.name}
- url: ${artifact.url}`);
        }
      } else if (artifacts.length > 0 && args.all) {
        if (isJsonOutput) {
          console.log(JSON.stringify(artifacts, null, 2));
        } else {
          artifacts.forEach((artifact) => {
            logger.log(`- name: ${artifact.name}
- url: ${artifact.url}`);
          });
        }
      }
      break;
    }
    case 'list-all': {
      const artifactName = undefined;
      const artifacts = await remoteBuildCache.list({ artifactName });
      const platform = args.platform;
      const traits = args.traits;
      const output =
        platform && traits
          ? artifacts.filter((artifact) =>
              artifact.name.startsWith(`rnef-${platform}-${traits.join('-')}`)
            )
          : artifacts;
      if (isJsonOutput) {
        console.log(JSON.stringify(output, null, 2));
      } else {
        output.forEach((artifact) => {
          logger.log(`- name: ${artifact.name}
- url: ${artifact.url}`);
        });
      }
      break;
    }
    case 'download': {
      const localArtifactPath = getLocalArtifactPath(artifactName);
      const response = await remoteBuildCache.download({ artifactName });
      await handleDownloadResponse(response, localArtifactPath, artifactName);
      const binaryPath = getLocalBinaryPath(localArtifactPath);
      if (!binaryPath) {
        throw new RnefError(`Failed to save binary for "${artifactName}".`);
      }
      if (isJsonOutput) {
        console.log(
          JSON.stringify({ name: artifactName, path: binaryPath }, null, 2)
        );
      } else {
        logger.log(`- name: ${artifactName}
- path: ${binaryPath}`);
      }
      break;
    }
    case 'upload': {
      const localArtifactPath = getLocalArtifactPath(artifactName);
      const binaryPath =
        args.binaryPath ?? getLocalBinaryPath(localArtifactPath);
      if (!binaryPath) {
        throw new RnefError(`No binary found for "${artifactName}".`);
      }
      const zip = new AdmZip();
      const isBinaryPathDirectory = fs.statSync(binaryPath).isDirectory();
      const isAppDirectory = fs.statSync(binaryPath).isDirectory();
      const absoluteTarballPath =
        args.binaryPath ?? path.join(localArtifactPath, 'app.tar.gz');
      if (isBinaryPathDirectory) {
        // skip zipping, we're uploading a folder for ad-hoc builds
      } else if (isAppDirectory) {
        const appName = path.basename(binaryPath);
        if (!fs.existsSync(absoluteTarballPath)) {
          throw new RnefError(
            `No tarball found for "${artifactName}" in "${localArtifactPath}".`
          );
        }
        await tar.create(
          {
            file: absoluteTarballPath,
            cwd: path.dirname(binaryPath),
            gzip: true,
            filter: (filePath) => filePath.includes(appName),
          },
          [appName]
        );
        zip.addLocalFile(absoluteTarballPath);
      } else {
        zip.addLocalFile(binaryPath);
      }
      const buffer = zip.toBuffer();

      try {
        let uploadedArtifact;

        if (isBinaryPathDirectory && remoteBuildCache.uploadAdhocFolder) {
          // Extract Info.plist from .ipa file for ad-hoc distribution
          const ipaFiles = fs
            .readdirSync(binaryPath)
            .filter((file) => file.endsWith('.ipa'));
          if (ipaFiles.length === 0) {
            throw new RnefError(`No .ipa file found in ${binaryPath}`);
          }

          const ipaFileName = ipaFiles[0];
          const ipaPath = path.join(binaryPath, ipaFileName);
          const appName = path.basename(ipaFileName, '.ipa');

          const zip = new AdmZip(ipaPath);
          const infoPlistPath = `Payload/${appName}.app/Info.plist`;
          const infoPlistEntry = zip.getEntry(infoPlistPath);

          if (!infoPlistEntry) {
            throw new RnefError(
              `Info.plist not found at ${infoPlistPath} in ${ipaFileName}`
            );
          }

          const infoPlistBuffer = infoPlistEntry.getData();
          const tempPlistPath = path.join(binaryPath, 'temp_info.plist');
          fs.writeFileSync(tempPlistPath, infoPlistBuffer);

          let version = 'unknown';
          let bundleIdentifier = 'unknown';
          try {
            await spawn('plutil', [
              '-convert',
              'json',
              '-o',
              tempPlistPath,
              tempPlistPath,
            ]);

            const jsonContent = fs.readFileSync(tempPlistPath, 'utf8');
            const infoPlistJson = JSON.parse(jsonContent) as Record<
              string,
              any
            >;

            version =
              infoPlistJson['CFBundleShortVersionString'] ||
              infoPlistJson['CFBundleVersion'] ||
              'unknown';
            bundleIdentifier = infoPlistJson['CFBundleIdentifier'] || 'unknown';
          } finally {
            if (fs.existsSync(tempPlistPath)) {
              fs.unlinkSync(tempPlistPath);
            }
          }

          // Generate templates for ad-hoc distribution
          // We'll generate the base URL after upload, so use a placeholder for now
          const indexHtml = templateIndexHtml({
            appName,
            bundleIdentifier,
            version,
            manifestPlistUrl: `{{BASE_URL}}/manifest.plist`,
          });
          const manifestPlist = templateManifestPlist({
            appName,
            version,
            baseUrl: '{{BASE_URL}}',
            ipaName: ipaFileName,
            bundleIdentifier,
            platformIdentifier: 'com.apple.platform.iphoneos',
          });

          fs.writeFileSync(path.join(binaryPath, 'index.html'), indexHtml);
          fs.writeFileSync(
            path.join(binaryPath, 'manifest.plist'),
            manifestPlist
          );

          uploadedArtifact = await remoteBuildCache.uploadAdhocFolder({
            artifactName,
            folderPath: binaryPath,
          });
        } else {
          uploadedArtifact = await remoteBuildCache.upload({
            artifactName,
            buffer,
          });
        }

        if (isJsonOutput) {
          console.log(JSON.stringify(uploadedArtifact, null, 2));
        } else {
          logger.log(`- name: ${uploadedArtifact.name}
- url: ${uploadedArtifact.url}`);
        }
      } finally {
        if (isAppDirectory && !isBinaryPathDirectory) {
          fs.unlinkSync(absoluteTarballPath);
        }
      }
      break;
    }
    case 'delete': {
      const deletedArtifacts = await remoteBuildCache.delete({
        artifactName,
        limit: args.all || args.allButLatest ? undefined : 1,
        skipLatest: args.allButLatest,
      });
      if (isJsonOutput) {
        console.log(JSON.stringify(deletedArtifacts, null, 2));
      } else {
        logger.log(
          deletedArtifacts
            .map(
              (artifact) => `- name: ${artifact.name}
- url: ${artifact.url}`
            )
            .join('\n')
        );
      }
      break;
    }
    case 'get-provider-name': {
      console.log(remoteBuildCache.name);
      break;
    }
  }

  return null;
}

// Template functions for ad-hoc iOS distribution
function templateIndexHtml({
  appName,
  version,
  bundleIdentifier,
  manifestPlistUrl,
}: {
  appName: string;
  version: string;
  bundleIdentifier: string;
  manifestPlistUrl: string;
}) {
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
          <li>When prompted, tap "Install" in the popup dialog</li>
          <li>The app will now start installing and will be available on your home screen</li>
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
}

function templateManifestPlist({
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
}) {
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
}

function validateArgs(args: Flags, action: string) {
  if (!action) {
    // @todo make Commander handle this
    throw new RnefError(
      'Action is required. Available actions: list, list-all, download, upload, delete'
    );
  }
  if (action === 'list-all' || action === 'get-provider-name') {
    // return early as we don't need to validate name or platform
    // to list all artifacts or get provider name
    return;
  }
  if (args.name && (args.platform || args.traits)) {
    throw new RnefError(
      'Cannot use "--name" together with "--platform" or "--traits". Use either name or platform with traits'
    );
  }
  if (!args.name) {
    if ((args.platform && !args.traits) || (!args.platform && args.traits)) {
      throw new RnefError(
        'Either "--platform" and "--traits" must be provided together'
      );
    }
    if (!args.platform || !args.traits) {
      throw new RnefError(
        'Either "--name" or "--platform" and "--traits" must be provided'
      );
    }
  }
}

export const remoteCachePlugin =
  () =>
  (api: PluginApi): PluginOutput => {
    api.registerCommand({
      name: 'remote-cache',
      description: 'Manage remote cache',
      action: async (action: string, args: Flags) => {
        await remoteCache({
          action,
          args,
          remoteCacheProvider: (await api.getRemoteCacheProvider()) || null,
          projectRoot: api.getProjectRoot(),
          fingerprintOptions: api.getFingerprintOptions(),
        });
      },
      args: [
        {
          name: '[action]',
          description:
            'Select action, e.g. list, list-all, download, upload, delete, get-provider-name',
        },
      ],
      options: [
        {
          name: '--json',
          description: 'Output in JSON format',
        },
        {
          name: '--name <string>',
          description: 'Full artifact name',
        },
        {
          name: '--all',
          description:
            'List or delete all matching artifacts. Affects "list" and "delete" actions only',
        },
        {
          name: '--all-but-latest',
          description:
            'Delete all but the latest matching artifact. Affects "delete" action only',
        },
        {
          name: '-p, --platform <string>',
          description: 'Select platform, e.g. ios or android',
        },
        {
          name: '-t, --traits <list>',
          description: `Comma-separated traits that construct final artifact name. Traits for Android are: variant; for iOS: destination and configuration. 
Example iOS: --traits simulator,Release
Example Android: --traits debug`,
          parse: (val: string) => val.split(','),
        },
        {
          name: '--binary-path <string>',
          description: 'Path to the binary to upload',
        },
      ],
    });

    return {
      name: 'internal_remote-cache',
      description: 'Manage remote cache',
    };
  };
