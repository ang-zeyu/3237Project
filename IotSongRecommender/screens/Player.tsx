import {Alert, Button, Text, View} from 'react-native';
import React from 'react';
import MusicChooser, {Song} from '../components/MusicChooser';

import Icon from 'react-native-vector-icons/MaterialIcons';
import SectionedMultiSelect from 'react-native-sectioned-multi-select';
import {Colors} from 'react-native/Libraries/NewAppScreen';

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

    selectRef: React.RefObject<any>;
    currentSelectedSong?: Song;
    currentSelectedMoods?: string[];
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      selectRef: React.createRef(),
      songs: [],
    };
  }

  getSongKey(song: Song): string {
    // Add duration to lessen collisions
    return `${song.filename}--${song.duration}`;
  }

  startAutoplay = () => {};

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
        await fetch('http://54.251.141.237:8080/post-player-song-data', {
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
          `http://54.251.141.237:8080/get-player-song-data/${this.props.id}`,
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
          <Button
            title={'Start Autoplay'}
            onPress={this.startAutoplay}
            disabled={!this.state.songs.length}
          />
        </View>

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
