import * as path from 'node:path';
import { resolveAbsolutePath } from '@rnef/tools';

export type TemplateInfo = NpmTemplateInfo | LocalTemplateInfo;

export type NpmTemplateInfo = {
  type: 'npm';
  name: string;
  version: string;
  packageName: string;
  /** Directory inside package that contains the template */
  directory: string | undefined;
  importName?: string;
};

export type LocalTemplateInfo = {
  type: 'local';
  name: string;
  localPath: string;
  packageName: string;
  directory: string | undefined;
  importName?: string;
};

export const TEMPLATES: TemplateInfo[] = [
  {
    type: 'npm',
    name: 'default',
    packageName: '@rnef/template-default',
    version: 'latest',
    directory: '.',
  },
];

export const PLUGINS: TemplateInfo[] = [
  {
    type: 'npm',
    name: 'brownfield-ios',
    packageName: '@rnef/plugin-brownfield-ios',
    version: 'latest',
    directory: 'template',
    importName: 'pluginBrownfieldIos',
  }
];

export const BUNDLERS: TemplateInfo[] = [
  {
    type: 'npm',
    name: 'metro',
    packageName: '@rnef/plugin-metro',
    version: 'latest',
    directory: 'template',
    importName: 'pluginMetro',
  },
  {
    type: 'npm',
    name: 'repack',
    packageName: '@rnef/plugin-repack',
    version: 'latest',
    directory: 'template',
    importName: 'pluginRepack',
  },
];

export const PLATFORMS: TemplateInfo[] = [
  {
    type: 'npm',
    name: 'ios',
    packageName: '@rnef/platform-ios',
    version: 'latest',
    directory: 'template',
    importName: 'platformIOS',
  },
  {
    type: 'npm',
    name: 'android',
    packageName: '@rnef/platform-android',
    version: 'latest',
    directory: 'template',
    importName: 'platformAndroid',
  },
];

export function resolveTemplate(
  templates: TemplateInfo[],
  name: string
): TemplateInfo {
  // Check if the template is a template from the list
  const templateFromList = templates.find((t) => t.name === name);
  if (templateFromList) {
    return templateFromList;
  }

  // Check filesystem paths: both folders and .tgz
  if (
    name.startsWith('./') ||
    name.startsWith('../') ||
    name.startsWith('/') ||
    name.startsWith('file:///')
  ) {
    if (name.startsWith('file://')) {
      name = name.slice(7);
    }

    const basename = path.basename(name);
    const ext = path.extname(basename);

    return {
      type: 'local',
      name: basename.slice(0, basename.length - ext.length),
      localPath: resolveAbsolutePath(name),
      directory: '.',
      packageName: basename.slice(0, basename.length - ext.length),
    };
  }

  // @todo: handle cases when template is github repo url

  // Otherwise, assume it's a npm package
  return {
    type: 'npm',
    name: getNpmLibraryName(name),
    packageName: getNpmLibraryName(name),
    directory: '.',
    version: getNpmLibraryVersion(name) ?? 'latest',
  };
}

// handles `package@x.y.z` and `@scoped/package@x.y.z` package naming schemes
function getNpmLibraryVersion(name: string) {
  const splitName = name.split('@');
  if (splitName.length === 3 && splitName[0] === '') {
    return splitName[2];
  } else if (splitName.length === 2 && splitName[0] !== '') {
    return splitName[1];
  }
  return null;
}

// handles `package@x.y.z` and `@scoped/package@x.y.z` package naming schemes
function getNpmLibraryName(name: string) {
  const splitName = name.split('@');
  if (splitName.length === 3 && splitName[0] === '') {
    return `@${splitName[1]}`;
  } else if (splitName.length === 2 && splitName[0] !== '') {
    return splitName[0];
  }
  return name;
}
