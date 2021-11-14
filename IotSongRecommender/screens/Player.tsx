import {
  Alert,
  Button,
  EmitterSubscription,
  Pressable,
  Text,
  View,
} from 'react-native';
import React from 'react';
import MusicChooser, {Song} from '../components/MusicChooser';

import TrackPlayer from 'react-native-track-player';
import Icon from 'react-native-vector-icons/MaterialIcons';
import SectionedMultiSelect from 'react-native-sectioned-multi-select';
import {Colors} from 'react-native/Libraries/NewAppScreen';
import {gatherSongData, SongData} from '../utils/SongSensor';
import {Event as TrackPlayerEvent} from 'react-native-track-player/lib/interfaces';
import MoodIcons from '../components/MoodIcons';

import constants from '../constants';

const MOODS = [
  {
    name: 'Moods',
    id: 0,
    children: [
      {name: 'Aggressive'},
      {name: 'Athletic'},
      {name: 'Atmospheric'},
      {name: 'Elegant'},
      {name: 'Warm'},
      {name: 'Depressive'},
      {name: 'Celebratory'},
      {name: 'Passionate'},
    ],
  },
];

export default class Player extends React.Component<
  {
    id: string | undefined;
    isTraining: boolean;
    showLoader: (cb?: any) => void;
    hideLoader: (cb?: any) => void;
  },
  {
    songs: Song[];
    songAutoplayQueueEndSub?: EmitterSubscription;
    currOrLastAutoplaySong?: Song;

    // Labelling
    selectRef: React.RefObject<any>;
    currentSelectedSong?: Song;
    currentSelectedMoods?: string[];

    //display
    currentActivity: string,
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      selectRef: React.createRef(),
      songs: [],
      currentActivity: 'Walking',
    };
  }

  recommendNextSong: () => Promise<void> = () => {
    return new Promise(resolve => {
      this.props.showLoader(async () => {
        let predictionSongData: SongData | undefined;
        await gatherSongData(this.props.id as string, async songData => {
          predictionSongData = songData;
        });

        if (!predictionSongData) {
          console.error('No predictionSongData, aborting recommendation');
          return;
        }

        try {
          // Gather predictable songs and their moods
          const songsAndMoods = this.state.songs
            .filter(song => song.moods?.length)
            .map(song => ({
              songTitleAndDuration: this.getSongKey(song),
              moods: song.moods as string[],
            }));

          const result = await predictionSongData.sendForPrediction(
            this.props.id as string,
            songsAndMoods,
          );

          // Find the returned predicted song
          if (result.activity) {
            this.setState({ currentActivity: result.activity })
          }

          let resultDuration: undefined | number = parseInt(
            result.duration,
            10,
          );
          resultDuration = isNaN(resultDuration) ? undefined : resultDuration;
          const candidateSong = this.state.songs.find(song => {
            return (
              song.filename === result.title &&
              resultDuration &&
              resultDuration === song.duration
            );
          });

          if (candidateSong) {
            await TrackPlayer.add(candidateSong);
            await TrackPlayer.play();
            this.setState({currOrLastAutoplaySong: candidateSong});
          } else {
            Alert.alert('No labelled songs found');
          }
        } catch (ex) {
          Alert.alert(
            'Error sending song data for prediction',
            'Is the API down maybe?',
          );
          console.log(ex);
        }

        this.props.hideLoader(resolve);
      });
    });
  };

  startSongAutoplay = async () => {
    // -------------------------------------------------------------------------
    await TrackPlayer.reset();
    console.log('Track player reset, startSongAutoplay');
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    const songAutoplayQueueEndSub = TrackPlayer.addEventListener(
      TrackPlayerEvent.PlaybackQueueEnded,
      async (data: {track?: number; position: number}) => {
        console.log('Playback Queue Ended! Event data:\n', data);

        await this.recommendNextSong();
      },
    );
    // -------------------------------------------------------------------------

    this.setState({songAutoplayQueueEndSub});
    await TrackPlayer.play();
  };

  stopSongAutoplay = () => {
    this.props.showLoader(async () => {
      this.state.songAutoplayQueueEndSub?.remove();
      await TrackPlayer.reset();

      this.setState(
        {songAutoplayQueueEndSub: undefined},
        this.props.hideLoader,
      );
    });
  };

  getSongKey(song: Song): string {
    // Add duration to lessen collisions
    return `${song.filename}--${song.duration}`;
  }

  songClickHandler = (song: Song) => {
    this.setState(
      {
        currentSelectedSong: song,
        currentSelectedMoods: song.moods,
      },
      () => {
        this.state.selectRef && this.state.selectRef.current._toggleSelector();
      },
    );
  };

  onSelectChange = (currentSelectedMoods: unknown[]) => {
    this.setState({
      currentSelectedMoods: currentSelectedMoods as string[],
    });
  };

  onSelectCancel = () => {
    this.setState({
      currentSelectedSong: undefined,
      currentSelectedMoods: [],
    });
  };

  onSelectConfirm = () => {
    this.props.showLoader(async () => {
      if (!this.state.currentSelectedSong) {
        this.props.hideLoader();
        return;
      }

      const moods = this.state.currentSelectedMoods;
      const body = {
        title: this.getSongKey(this.state.currentSelectedSong as Song),
        moods,
        uuid: this.props.id,
      };

      try {
        await fetch(`${constants.EC2_BASE_URL}/post-player-song-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        this.state.currentSelectedSong.moods = this.state.currentSelectedMoods;
      } catch (ex) {
        Alert.alert('API failed', 'Failed to label song with moods');
      } finally {
        this.setState({
          currentSelectedSong: undefined,
          currentSelectedMoods: [],
        });
        this.props.hideLoader();
      }
    });
  };

  onSongFolderChosen = async (folderSongs: Song[]) => {
    let userSongMoodsMap: {[titleAndDuration: string]: string[]} =
      Object.create(null);
    try {
      const userSongMoods: {
        title: string;
        moods: string[];
      }[] = await (
        await fetch(
          `${constants.EC2_BASE_URL}/get-player-song-data/${this.props.id}`,
        )
      ).json();

      for (const userSongMood of userSongMoods) {
        userSongMoodsMap[userSongMood.title] = userSongMood.moods;
      }
    } catch (ex) {
      Alert.alert('Unable to retrieve song moods');
      return;
    }

    for (const folderSong of folderSongs) {
      folderSong.moods = userSongMoodsMap[this.getSongKey(folderSong)] || [];
    }

    this.setState({songs: folderSongs});

    console.log('Picked and retrieve player song moods');
  };

  render() {
    if (!this.props.id) {
      return <Text>The sensor needs to be enabled first!</Text>;
    } else if (this.props.isTraining) {
      return <Text>Training in progress!</Text>;
    }

    return (
      <View style={{backgroundColor: Colors.lighter, flex: 1}}>
        <SectionedMultiSelect
          ref={this.state.selectRef}
          items={MOODS}
          IconRenderer={Icon}
          uniqueKey="name"
          subKey="children"
          hideSelect={true}
          hideSearch={true}
          selectText="Choose song moods..."
          showChips={false}
          showDropDowns={false}
          showCancelButton={true}
          readOnlyHeadings={true}
          selectedItems={this.state.currentSelectedMoods}
          onSelectedItemsChange={this.onSelectChange}
          onConfirm={this.onSelectConfirm}
          onCancel={this.onSelectCancel}
        />
        <View style={{padding: 10}}>
          {this.state.songAutoplayQueueEndSub ? (
            <Button title={'Stop Autoplay'} onPress={this.stopSongAutoplay} />
          ) : (
            <Button
              title={'Start Autoplay'}
              onPress={this.startSongAutoplay}
              disabled={!this.state.songs.length}
            />
          )}
        </View>

        <View style={{ padding:10 }}>
          {this.state.currentActivity ? (
            <Text>Current activity is {this.state.currentActivity} </Text>
          ) : (
            <Text>No activity detected!</Text>
          )}
        </View>

        {this.state.currOrLastAutoplaySong ? (
          <View style={{padding: 10, flexDirection: 'row'}}>
            <View style={{flex: 1}}>
              <Text>{this.state.currOrLastAutoplaySong.title}</Text>
              <Text>{this.state.currOrLastAutoplaySong.artist}</Text>
            </View>
            <MoodIcons song={this.state.currOrLastAutoplaySong} />
          </View>
        ) : null}

        <MusicChooser
          showMoods={true}
          showLoader={this.props.showLoader}
          hideLoader={this.props.hideLoader}
          onClick={this.songClickHandler}
          musicUris={this.state.songs}
          setMusicUris={this.onSongFolderChosen}
        />
      </View>
    );
  }
}
