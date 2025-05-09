# @rnef/platform-apple-helpers

## 0.7.7

### Patch Changes

- @rnef/tools@0.7.7

## 0.7.6

### Patch Changes

- 232e0a6: fix: allow framework as wrapper extension
  - @rnef/tools@0.7.6

## 0.7.5

### Patch Changes

- @rnef/tools@0.7.5

## 0.7.4

### Patch Changes

- 44ebc93: fix: run codegen script in sourceDir
  - @rnef/tools@0.7.4

## 0.7.3

### Patch Changes

- f11fd91: fix: always use udid from matched device
- 0be7484: feat: refactor and expose remote cache provider
- b410121: feat: structured build settings information
- ab730d9: chore: improve error messages around installing pods; run codegen
- Updated dependencies [0be7484]
  - @rnef/tools@0.7.3

## 0.7.2

### Patch Changes

- @rnef/tools@0.7.2

## 0.7.1

### Patch Changes

- @rnef/tools@0.7.1

## 0.7.0

### Minor Changes

- ea7abde: feat: upgrade templates to 0.79

### Patch Changes

- @rnef/tools@0.7.0

## 0.6.2

### Patch Changes

- 3ec7e00: refactor: unify spawn verbose output
- de24926: feat: launch sim and build app in parallel
- Updated dependencies [3ec7e00]
  - @rnef/tools@0.6.2

## 0.6.1

### Patch Changes

- 4a3ca21: fix: pass user config to commands and config from rnccli
  - @rnef/tools@0.6.1

## 0.6.0

### Patch Changes

- cd34f4f: chore: add more error messages to pod install
- 92bb57e: refactor: move project config validation to command registration
- Updated dependencies [cd34f4f]
  - @rnef/tools@0.6.0

## 0.5.3

### Patch Changes

- 22233c5: feat: export config type; support typed config; point to mjs
  - @rnef/tools@0.5.3

## 0.5.2

### Patch Changes

- df957f8: fix: pod install with missing 'm' regex flag
  - @rnef/tools@0.5.2

## 0.5.1

### Patch Changes

- @rnef/tools@0.5.1

## 0.5.0

### Minor Changes

- 49e7bc0: feat(ios): brownfield plugin

### Patch Changes

- b0977c8: fix: wrap booting simulator in try catch and add special case for when it says it's booted already
  - @rnef/tools@0.5.0

## 0.4.1

### Patch Changes

- b3cbcab: chore: public release setup
- Updated dependencies [b3cbcab]
  - @rnef/tools@0.4.1

## 0.4.0

### Minor Changes

- ae36943: feat: pass USE_THIRD_PARTY_JSC env variable to pod install

  This change allows passing the USE_THIRD_PARTY_JSC environment variable to the pod install command, enabling configuration of third-party JSC usage in iOS builds.

### Patch Changes

- 5ddc7a7: Adjust the error message if empty stderr from xcodebuild
- cacd767: feat: ios progress bar
- a141247: chore: don't require full build output
- f11cc97: feat: pick Debug configuration when only Debug and Release are available
- 03512fc: Add reading Gemfile file contents to ensure cocoapods are installed
- 6aa1320: Fallback to `pod install` when installing with `bundle exec pod install` fails
- 51a7c7f: Add support for customizing `extraSources` & `ignorePaths`
- feafc80: Add select prompt for destination in interactive environment
- 8e1e2ef: refactor(ios): building, installing and launching apps
- Updated dependencies [51a7c7f]
  - @rnef/tools@0.4.0
