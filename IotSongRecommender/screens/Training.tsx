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
    trainingEventSub?: EmitterSubscription;
    trainSongData?: SongData;
    trainMotionData?: TrainMotionData;

    motionSensorText: string;
    songSensorText: {
      optical: string;
      humidity: string;
    };
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
      motionSensorText: '',
      songSensorText: {
        optical: '',
        humidity: '',
      },
      activity: 'Walking',
    };
  }

  activity_list = ['Walking', 'Running', 'Lying Down', 'Working'];

  componentWillUnmount() {
    this.state.trainingEventSub?.remove();
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

      await trainMotionData.send(this.state.activity);

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

  gatherSongBurst: (doReset?: boolean) => Promise<SongData> = (
    doReset = true,
  ) => {
    return new Promise(resolve => {
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

          if (doReset) {
            this.setState({trainSongData: undefined});
          }
          this.props.hideLoader();
          bleEmitter.removeAllListeners(EVENTS.CHAR_UPDATE);

          resolve(songData);
        });
      });
    });
  };

  // Really rough sketch / tbd, pending consult
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
    const trainingEventSub = TrackPlayer.addEventListener(
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
          await this.gatherSongBurst(false);
        }
      },
    );
    // -------------------------------------------------------------------------

    this.setState({trainingCurrPlaylist, trainingEventSub});

    await TrackPlayer.play();
  };

  handleSkipButton = async () => {
    await TrackPlayer.skipToNext();
  };

  stopSongTraining = async () => {
    this.state.trainingEventSub?.remove();
    await TrackPlayer.reset();

    this.props.hideLoader(async () => {
      this.setState({
        trainSongData: undefined,
        trainingCurrPlaylist: [],
        trainingEventSub: undefined,
      });
      bleEmitter.removeAllListeners(EVENTS.CHAR_UPDATE);
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

          {/* Debug button for testing gathering a short burst of data */}
          <View style={{padding: 10}}>
            <ModalDropdown
              options={this.activity_list}
              onSelect={this.selectPhysicalActivity}
              dropdownStyle={{width: '80%'}}
            />
          </View>
          <View style={{padding: 10}}>
            <Button
              title={'Test Gather Song Data'}
              onPress={this.gatherSongBurst}
              disabled={
                !this.props.id ||
                !!this.state.trainMotionData ||
                !!this.state.trainSongData
              }
            />
          </View>

          {/* TODO Start song training button. Only available after songs are loaded from below choose folder button */}
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
            {/* TODO Skip song button. Only available after song training is started. */}
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

          {/* Choose folder button */}
          {this.props.id && !this.state.trainMotionData && (
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
