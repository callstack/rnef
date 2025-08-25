import { platformAndroid } from '@rnef/platform-android';
import { platformIOS } from '@rnef/platform-ios';
import { pluginMetro } from '@rnef/plugin-metro';

export default {
  plugins: [
    
  ],
  bundler: pluginMetro(),
  platforms: {
    android: platformAndroid(),
    ios: platformIOS(),
  },
  remoteCacheProvider: null,
};
