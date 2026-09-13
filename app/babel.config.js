module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last. Reanimated 4 moved its Babel plugin into react-native-worklets;
    // leaving the old react-native-reanimated/plugin here silently breaks worklets.
    plugins: ['react-native-worklets/plugin'],
  };
};
