/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import TrackPlayer from 'react-native-track-player';
import {setup} from './utils/Ble';

AppRegistry.registerComponent(appName, () => App);
TrackPlayer.registerPlaybackService(() => require('./service'));
TrackPlayer.setupPlayer({}).then(async r => {
  console.log('Player setup-ed!!');
  console.log('Setting up BLE...');
  await setup();
});
