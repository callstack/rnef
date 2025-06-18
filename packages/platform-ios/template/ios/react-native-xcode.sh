set -e

source "$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh"

export CONFIG_CMD="dummy-workaround-value"
export CLI_PATH="$("$NODE_BINARY" --print "require('path').dirname(require.resolve('@rnef/cli/package.json')) + '/dist/src/bin.js'")"

source "$REACT_NATIVE_PATH/scripts/react-native-xcode.sh"
