import {
  configureMotionSensors,
  stopMotionSensors,
  TrainMotionData,
} from './MotionSensor';
import {SongData, gatherSongData} from './SongSensor';
import {
  Button,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import React, {useState} from 'react';
import MusicChooser, {Song} from './MusicChooser';
import {createCharacteristicUpdateListener} from './Sensor';
import {bleEmitter, EVENTS} from './Ble';
import TrackPlayer, {Event} from 'react-native-track-player';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Events from 'events';

export default class Training extends React.Component<
  {
    style: {backgroundColor: any};
    scan: () => void;
    id: string | undefined;
    startService: () => Promise<void>;
    stopService: () => Promise<void>;
    showLoader: (cb?: any) => void;
    hideLoader: (cb?: any) => void;
  },
  {
    musicUris: Song[];
    trainSongData?: SongData;
    trainMotionData?: TrainMotionData;

    motionSensorText: string;
    songSensorText: {
      optical: string;
      humidity: string;
    };
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      musicUris: [],
      trainSongData: undefined,
      trainMotionData: undefined,
      motionSensorText: '',
      songSensorText: {
        optical: '',
        humidity: '',
      },
    };
  }

  processMotionData = (
    gyroX: number,
    gyroY: number,
    gyroZ: number,
    accelX: number,
    accelY: number,
    accelZ: number,
  ) => {
    this.setState({
      motionSensorText: `Gyrometer: ${gyroX} ${gyroY} ${gyroZ}\nAccelerometer:${accelX} ${accelY} ${accelZ}`,
    });

    const container = this.state.trainMotionData || this.state.trainSongData;
    if (container) {
      container.gyroX.push(gyroX);
      container.gyroY.push(gyroY);
      container.gyroZ.push(gyroZ);
      container.accelX.push(accelX);
      container.accelY.push(accelY);
      container.accelZ.push(accelZ);

      if (
        this.state.trainMotionData &&
        this.state.trainMotionData.gyroX.length >= 100
      ) {
        this.state.trainMotionData.sendIntermediate();
      }
    }
  };

  startMotionTraining = async () => {
    const callback = async () => {
      try {
        await configureMotionSensors(this.props.id as string);

        createCharacteristicUpdateListener(
          this.processMotionData,
          () => {},
          () => {},
        );

        this.props.hideLoader();
      } catch (e) {
        this.props.hideLoader();
        this.setState({trainMotionData: undefined});
      }
    };

    await this.props.startService();
    this.props.showLoader();
    this.setState({trainMotionData: new TrainMotionData()}, callback);
  };

  stopMotionTraining = async () => {
    const trainMotionData = this.state.trainMotionData;
    if (!trainMotionData) {
      return;
    }

    await this.props.stopService();
    bleEmitter.removeAllListeners(EVENTS.CHAR_UPDATE);

    const callback = async () => {
      await stopMotionSensors(this.props.id as string);

      await trainMotionData.send();

      this.props.hideLoader();
    };

    this.props.showLoader();
    this.setState({trainMotionData: undefined}, callback);
  };

  processHumidityData = (temp: number, humidity: number) => {
    this.setState({
      songSensorText: {
        optical: this.state.songSensorText.optical,
        humidity: `Temperature: ${temp}\nHumidity: ${humidity}`,
      },
    });

    if (this.state.trainSongData) {
      this.state.trainSongData.tempVals.push(temp);
      this.state.trainSongData.humidityVals.push(humidity);
    }
  };

  processOpticalData = (opticalVal: number) => {
    this.setState({
      songSensorText: {
        optical: `Optical: ${opticalVal}`,
        humidity: this.state.songSensorText.humidity,
      },
    });

    if (this.state.trainSongData) {
      this.state.trainSongData.opticalVals.push(opticalVal);
    }
  };

  testGatherSongData = async () => {
    this.props.showLoader(async () => {
      const countdown = await gatherSongData(this.props.id as string);

      createCharacteristicUpdateListener(
        this.processMotionData,
        this.processOpticalData,
        this.processHumidityData,
      );

      const songData = new SongData();
      this.setState({trainSongData: songData}, async () => {
        await countdown();

        this.setState({trainSongData: undefined});
        this.props.hideLoader();
        bleEmitter.removeAllListeners(EVENTS.CHAR_UPDATE);

        await songData.send();
      });
    });
  };

  randomPickSongAndPlay = async () => {
    // Gather IOT data
    this.props.showLoader(async () => {
      const countdown = await gatherSongData(this.props.id as string);

      createCharacteristicUpdateListener(
        this.processMotionData,
        this.processOpticalData,
        this.processHumidityData,
      );

      const songData = new SongData();
      this.setState({trainSongData: songData}, async () => {
        await countdown();

        this.setState({trainSongData: undefined});
        this.props.hideLoader();
        bleEmitter.removeAllListeners(EVENTS.CHAR_UPDATE);

        // Randomise, see what action user takes...
        const randIdx = Math.floor(Math.random() * this.state.musicUris.length);
        const song = this.state.musicUris[randIdx];

        await TrackPlayer.add(song);
        await TrackPlayer.play();

        TrackPlayer.addEventListener(Event.PlaybackTrackChanged, () => {
          if (!this.state.trainSongData) {
            return;
          }
        });
      });
    });
  };

  handleSkipButton = async () => {
    await TrackPlayer.reset();
    await this.randomPickSongAndPlay();
  };

  startSongTraining = async () => {
    this.props.showLoader(async () => {
      const countdown = await gatherSongData(this.props.id as string);

      createCharacteristicUpdateListener(
        this.processMotionData,
        this.processOpticalData,
        this.processHumidityData,
      );

      const songData = new SongData();
      this.setState({trainSongData: songData}, async () => {
        await countdown();

        this.setState({trainSongData: undefined});
        this.props.hideLoader();
        bleEmitter.removeAllListeners(EVENTS.CHAR_UPDATE);

        await songData.send();
      });
    });
  };

  render() {
    return (
      <SafeAreaView style={this.props.style}>
        <View style={this.props.style}>
          <View>
            <Pressable
              onPress={this.props.scan}
              disabled={!!this.props.id}
              style={({pressed}) => [
                styles.flatButton,
                (pressed && {backgroundColor: '#38ee46'}) || {},
                (this.props.id && {backgroundColor: '#d5ded7'}) || {},
              ]}
              android_ripple={{color: 'lightblue'}}>
              <Text style={styles.flatButtonText}>
                {this.props.id || 'Connect'}
              </Text>
            </Pressable>
          </View>
          <View style={{padding: 10}}>
            {this.state.trainMotionData ? (
              <Button
                title={'Stop Training'}
                color={'green'}
                onPress={this.stopMotionTraining}
              />
            ) : (
              <Button
                title={'Train Motion'}
                onPress={this.startMotionTraining}
                disabled={!this.props.id || !!this.state.trainSongData}
              />
            )}
          </View>
          <View style={{padding: 10}}>
            <Button
              title={'Test Gather Song Data'}
              onPress={this.testGatherSongData}
              disabled={
                !this.props.id ||
                !!this.state.trainMotionData ||
                !!this.state.trainSongData
              }
            />
          </View>
          <View style={{padding: 10}}>
            <Button
              title={'Train Songs'}
              onPress={this.testGatherSongData}
              disabled={!this.state.musicUris.length}
            />
            <View style={styles.musicControlsContainer}>
              <Pressable
                style={({pressed}) => [
                  styles.musicControl,
                  (pressed && {backgroundColor: '#ffd5a9'}) || {},
                ]}
                onPress={this.handleSkipButton}>
                <Ionicons
                  name={'play-forward-outline'}
                  size={28}
                  color={'orange'}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.debugContainer}>
            {this.state.trainSongData || this.state.trainMotionData ? (
              <React.Fragment>
                <Text style={styles.debugTitle}>Motion sensor is active</Text>
                <Text style={styles.debugInfo}>
                  {this.state.motionSensorText}
                </Text>
              </React.Fragment>
            ) : (
              <Text style={styles.debugTitle}>Motion sensor is inactive</Text>
            )}

            {this.state.trainSongData ? (
              <React.Fragment>
                <Text style={styles.debugTitle}>Song sensors are active</Text>
                <Text style={styles.debugInfo}>
                  {this.state.songSensorText.optical}
                </Text>
                <Text style={styles.debugInfo}>
                  {this.state.songSensorText.humidity}
                </Text>
              </React.Fragment>
            ) : (
              <Text style={styles.debugTitle}>Song sensors are inactive</Text>
            )}
          </View>

          {this.props.id && !this.state.trainMotionData && (
            <MusicChooser
              showLoader={this.props.showLoader}
              hideLoader={this.props.hideLoader}
              musicUris={this.state.musicUris}
              setMusicUris={(musicUris: Song[]) => this.setState({musicUris})}
            />
          )}
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  musicControlsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  musicControl: {
    padding: 7,
    margin: 3,
    borderWidth: 1,
    borderColor: '#fd9e5b',
    overflow: 'hidden',
    borderRadius: 20,
  },
  flatButton: {
    height: 50,
    justifyContent: 'center',
    backgroundColor: '#94ec9b',
  },
  flatButtonText: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  debugContainer: {
    backgroundColor: '#fceebf',
    padding: 10,
  },
  debugTitle: {
    fontSize: 18,
    color: 'red',
  },
  debugTitleActive: {
    color: 'green',
  },
  debugInfo: {
    fontSize: 14,
  },
});
