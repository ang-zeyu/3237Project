import {
  configureMotionSensors,
  stopMotionSensors,
  TrainMotionData,
} from '../utils/MotionSensor';
import {SongData, gatherSongData} from '../utils/SongSensor';
import {
  Button,
  EmitterSubscription,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import React from 'react';
import MusicChooser, {Song} from '../components/MusicChooser';
import {createCharacteristicUpdateListener} from '../utils/Sensor';
import {bleEmitter, EVENTS} from '../utils/Ble';
import TrackPlayer, {
  Event as TrackPlayerEvent,
} from 'react-native-track-player';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ModalDropdown from 'react-native-modal-dropdown';

export default class Training extends React.Component<
  {
    style: {backgroundColor: any};
    id: string | undefined;
    startService: () => Promise<void>;
    stopService: () => Promise<void>;
    showLoader: (cb?: any) => void;
    hideLoader: (cb?: any) => void;
  },
  {
    trainingSongs: Song[];
    trainingCurrPlaylist: Song[];
    trainSongPlayerEventSub?: EmitterSubscription;
    trainSongData?: SongData;

    trainMotionCharUnsub?: () => void;
    trainMotionData?: TrainMotionData;

    /*motionSensorText: string;
    songSensorText: {
      optical: string;
      humidity: string;
    };*/
    activity: string;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      trainingSongs: [],
      trainingCurrPlaylist: [],
      trainSongData: undefined,
      trainMotionData: undefined,
      /*motionSensorText: '',
      songSensorText: {
        optical: '',
        humidity: '',
      },*/
      activity: 'Walking',
    };
  }

  activity_list = ['Walking', 'Running', 'Lying Down', 'Working'];

  componentWillUnmount() {
    this.state.trainSongPlayerEventSub?.remove();
    if (this.state.trainMotionCharUnsub) {
      this.state.trainMotionCharUnsub();
    }
  }

  processMotionData = (
    gyroX: number,
    gyroY: number,
    gyroZ: number,
    accelX: number,
    accelY: number,
    accelZ: number,
  ) => {
    /*this.setState({
      motionSensorText: `Gyrometer: ${gyroX} ${gyroY} ${gyroZ}\nAccelerometer:${accelX} ${accelY} ${accelZ}`,
    });*/

    if (this.state.trainMotionData) {
      this.state.trainMotionData.gyroX.push(gyroX);
      this.state.trainMotionData.gyroY.push(gyroY);
      this.state.trainMotionData.gyroZ.push(gyroZ);
      this.state.trainMotionData.accelX.push(accelX);
      this.state.trainMotionData.accelY.push(accelY);
      this.state.trainMotionData.accelZ.push(accelZ);
    }

    if (this.state.trainSongData) {
      this.state.trainSongData.gyroX.push(gyroX);
      this.state.trainSongData.gyroY.push(gyroY);
      this.state.trainSongData.gyroZ.push(gyroZ);
      this.state.trainSongData.accelX.push(accelX);
      this.state.trainSongData.accelY.push(accelY);
      this.state.trainSongData.accelZ.push(accelZ);
    }
  };

  startMotionTraining = async () => {
    const callback = async () => {
      try {
        await configureMotionSensors(this.props.id as string);

        const trainMotionCharSub = createCharacteristicUpdateListener(
          this.processMotionData,
          () => {},
          () => {},
        );

        this.props.hideLoader();
        this.setState({trainMotionCharUnsub: trainMotionCharSub});
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
    const {trainMotionData, trainMotionCharUnsub} = this.state;
    if (!trainMotionData) {
      return;
    }

    await this.props.stopService(); // stop foreground service
    if (trainMotionCharUnsub) {
      trainMotionCharUnsub();
    }

    this.props.showLoader();
    this.setState(
      {
        trainMotionData: undefined,
        trainMotionCharUnsub: undefined,
      },
      async () => {
        await stopMotionSensors(this.props.id as string);

        await trainMotionData.send(this.state.activity);

        this.props.hideLoader();
      },
    );
  };

  processHumidityData = (temp: number, humidity: number) => {
    /*this.setState({
      songSensorText: {
        optical: this.state.songSensorText.optical,
        humidity: `Temperature: ${temp}\nHumidity: ${humidity}`,
      },
    });*/

    if (this.state.trainSongData) {
      this.state.trainSongData.tempVals.push(temp);
      this.state.trainSongData.humidityVals.push(humidity);
    }
  };

  processOpticalData = (opticalVal: number) => {
    /*this.setState({
      songSensorText: {
        optical: `Optical: ${opticalVal}`,
        humidity: this.state.songSensorText.humidity,
      },
    });*/

    if (this.state.trainSongData) {
      this.state.trainSongData.opticalVals.push(opticalVal);
    }
  };

  testGatherSongData = async () => {
    await this.gatherSongBurst();
    this.setState({trainSongData: undefined});
  };

  gatherSongBurst: () => Promise<void> = () => {
    return new Promise(resolve => {
      this.props.showLoader(async () => {
        console.log('Gathering song data...');
        const countdown = await gatherSongData(this.props.id as string);

        const trainSongCharUnsub = createCharacteristicUpdateListener(
          this.processMotionData,
          this.processOpticalData,
          this.processHumidityData,
        );

        const trainSongData = new SongData();
        this.setState({trainSongData}, async () => {
          await countdown();

          this.props.hideLoader();
          trainSongCharUnsub();
          console.log('Gathered song data...');

          resolve();
        });
      });
    });
  };

  startSongTraining = async () => {
    // -------------------------------------------------------------------------
    await TrackPlayer.reset();
    console.log('track player reset');
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // Shuffle to generate a playlist, see what action user takes...
    const trainingCurrPlaylist: Song[] = [...this.state.trainingSongs];
    for (let i = trainingCurrPlaylist.length; i > 0; i--) {
      const randIdx = Math.floor(Math.random() * i);

      // Swap, in doing so the current song will not be randomly selected again
      const selectedSong = trainingCurrPlaylist[randIdx];
      trainingCurrPlaylist[randIdx] = trainingCurrPlaylist[i - 1];
      trainingCurrPlaylist[i - 1] = selectedSong;
    }

    await TrackPlayer.add(trainingCurrPlaylist);
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    const trainSongPlayerEventSub = TrackPlayer.addEventListener(
      TrackPlayerEvent.PlaybackTrackChanged,
      async (data: {track?: number; position: number; nextTrack?: number}) => {
        console.log('Track changed! Event data:\n', data);

        // Handle previous (completed -- or not) track
        if (data.track !== undefined && data.track !== null) {
          const prevSongPlayed = this.state.trainingCurrPlaylist[data.track];
          const proportionPlayed = data.position / prevSongPlayed.duration;
          console.log(prevSongPlayed);
          console.log(proportionPlayed);

          if (!this.state.trainSongData) {
            throw new Error('No trainSongData defined');
          }

          const MINIMUM_PROPORTION = 0.5;
          if (proportionPlayed >= MINIMUM_PROPORTION) {
            console.log('Sending prev played song data...');
            await this.state.trainSongData.send(); // TODO send up the mood also
          } else {
            console.log('Sending prev skipped song data...');
            await this.state.trainSongData.send(); // TODO send up the mood also
          }
        }

        // For the next track
        if (data.nextTrack !== undefined && data.nextTrack !== null) {
          console.log('Collecting next song data...');
          await this.gatherSongBurst();
        }
      },
    );
    // -------------------------------------------------------------------------

    this.setState({trainingCurrPlaylist, trainSongPlayerEventSub});

    await TrackPlayer.play();
  };

  handleSkipButton = async () => {
    await TrackPlayer.skipToNext();
  };

  stopSongTraining = async () => {
    this.state.trainSongPlayerEventSub?.remove();
    await TrackPlayer.reset();

    this.props.hideLoader(async () => {
      this.setState({
        trainSongData: undefined,
        trainingCurrPlaylist: [],
        trainSongPlayerEventSub: undefined,
      });
    });
  };

  selectPhysicalActivity = (index: string, option: string) => {
    this.setState({activity: option});
  };

  render() {
    return (
      <SafeAreaView style={this.props.style}>
        <View style={this.props.style}>
          {/* Start or Stop training motion button */}
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

          {/* Select physical activity dropdown */}
          <View style={{padding: 10}}>
            <ModalDropdown
              options={this.activity_list}
              onSelect={this.selectPhysicalActivity}
              dropdownStyle={{width: '80%'}}
            />
          </View>

          {/* Debug button for testing gathering a short burst of data */}
          {/*<View style={{padding: 10}}>
            <Button
              title={'Test Gather Song Data'}
              onPress={this.testGatherSongData}
              disabled={
                !this.props.id ||
                !!this.state.trainMotionData ||
                !!this.state.trainSongData
              }
            />
          </View>*/}

          {/* Start song training button. Only available after songs are loaded from below choose folder button */}
          <View style={{padding: 10}}>
            {!this.state.trainingCurrPlaylist.length ? (
              <Button
                title={'Train Songs'}
                onPress={this.startSongTraining}
                disabled={!this.state.trainingSongs.length}
              />
            ) : (
              <Button
                title={'Stop Training Songs'}
                onPress={this.stopSongTraining}
              />
            )}

            {/* Skip song button. Only available after song training is started. */}
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

          {/* Debug information on sensors */}
          {/*<View style={styles.debugContainer}>
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
          </View>*/}

          {/* Choose folder button */}
          {this.props.id && (
            <MusicChooser
              showLoader={this.props.showLoader}
              hideLoader={this.props.hideLoader}
              musicUris={this.state.trainingSongs}
              setMusicUris={(musicUris: Song[]) =>
                this.setState({trainingSongs: musicUris})
              }
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
