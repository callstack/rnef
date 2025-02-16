import { makeFilePathModifier } from '../provider.js';
import { createModFileProviders } from './cocoaBaseMods.js';

// @todo rewrite template finding and copying logic
const modifyFilePath = makeFilePathModifier('node_modules/../ios/App76');
const defaultProviders = createModFileProviders(modifyFilePath);

export function getIosModFileProviders() {
  return defaultProviders;
}
