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
import SongTitleToMoodJSON from '../utils/SongToMood.json';

const typedJson: {[songTitle: string]: string[]} = SongTitleToMoodJSON;

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
      activity: 'Working',
    };
  }

  activity_list = ['Walking', 'Running', 'Lying Down', 'Working'];

  componentWillUnmount() {
    this.state.trainSongPlayerEventSub?.remove();
    if (this.state.trainMotionCharUnsub) {
      this.state.trainMotionCharUnsub();
    }
  }

  startMotionTraining = async () => {
    const trainMotionData = new TrainMotionData();

    const callback = async () => {
      try {
        await configureMotionSensors(this.props.id as string);

        const trainMotionCharSub = createCharacteristicUpdateListener(
          (gyroX, gyroY, gyroZ, accelX, accelY, accelZ) => {
            trainMotionData.gyroX.push(gyroX);
            trainMotionData.gyroY.push(gyroY);
            trainMotionData.gyroZ.push(gyroZ);
            trainMotionData.accelX.push(accelX);
            trainMotionData.accelY.push(accelY);
            trainMotionData.accelZ.push(accelZ);
          },
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
    this.setState({trainMotionData}, callback);
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

        await trainMotionData.send(
          this.state.activity,
          this.props.id as string,
        );

        this.props.hideLoader();
      },
    );
  };

  gatherSongBurst: () => Promise<void> = () => {
    return new Promise(resolve => {
      this.props.showLoader(async () => {
        await gatherSongData(this.props.id as string, trainSongData => {
          return new Promise(resolve =>
            this.setState({trainSongData}, resolve),
          );
        });
        this.props.hideLoader(resolve);
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
            console.log('No trainSongData defined');
          } else {
            const MINIMUM_PROPORTION = 0.5;
            if (proportionPlayed >= MINIMUM_PROPORTION) {
              console.log('Sending prev played song data...');
              const moods = typedJson[prevSongPlayed.filename] || [];
              await this.state.trainSongData.sendForTraining(
                moods,
                false,
                this.props.id as string,
              );
            } else {
              console.log('Sending prev skipped song data...');
              const moods = typedJson[prevSongPlayed.filename] || [];
              await this.state.trainSongData.sendForTraining(
                moods,
                true,
                this.props.id as string,
              );
            }
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

  handleFfwdButton = async () => {
    await TrackPlayer.pause();
    const currPos = await TrackPlayer.getPosition();
    const currTrack = await TrackPlayer.getCurrentTrack();
    const currSong = await TrackPlayer.getTrack(currTrack);
    await TrackPlayer.seekTo(Math.max((currSong.duration || 0) - 3, currPos));
    await TrackPlayer.play();
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
      <SafeAreaView style={[this.props.style, {flex: 1}]}>
        <View style={[this.props.style, {flex: 1}]}>
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
                disabled={!this.props.id}
              />
            )}
          </View>

          {/* Select physical activity dropdown */}
          <View style={styles.activityChooseView}>
            <ModalDropdown
              options={this.activity_list}
              defaultValue={'Working'}
              onSelect={this.selectPhysicalActivity}
              textStyle={{fontSize: 16}}
            />
          </View>

          {/* Start song training button. Only available after songs are loaded from below choose folder button */}
          <View style={{padding: 10}}>
            {!this.state.trainingCurrPlaylist.length ? (
              <Button
                title={'Train Songs'}
                onPress={this.startSongTraining}
                disabled={!this.props.id || !this.state.trainingSongs.length}
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
                onPress={this.handleSkipButton}
                disabled={!this.props.id}>
                <Ionicons
                  name={'play-forward-outline'}
                  size={28}
                  color={'orange'}
                />
              </Pressable>
              <Pressable
                style={({pressed}) => [
                  styles.musicControl,
                  {borderColor: '#69f51d'},
                  (pressed && {backgroundColor: '#01bd1c'}) || {},
                ]}
                onPress={this.handleFfwdButton}
                disabled={!this.props.id}>
                <Ionicons
                  name={'checkmark-done-outline'}
                  size={28}
                  color={'green'}
                />
              </Pressable>
            </View>
          </View>

          {/* Choose folder button */}
          <MusicChooser
            showLoader={this.props.showLoader}
            hideLoader={this.props.hideLoader}
            musicUris={this.state.trainingSongs}
            setMusicUris={(musicUris: Song[]) => {
              return new Promise(resolve => {
                for (const song of musicUris) {
                  if (!(song.filename in typedJson)) {
                    console.log('missing', song.filename);
                  }
                }
                this.setState({trainingSongs: musicUris}, resolve);
              });
            }}
          />
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  musicControlsContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  musicControl: {
    padding: 7,
    margin: 3,
    marginTop: 10,
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
  activityChooseView: {
    padding: 10,
    borderStyle: 'solid',
    borderWidth: 1,
    backgroundColor: 'orange',
  },
});
