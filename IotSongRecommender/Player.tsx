import {TrainMotionData} from './MotionSensor';
import {SongData} from './SongSensor';
import {Button, SafeAreaView, StyleSheet, Text, View} from 'react-native';
import React, {useState} from 'react';
import MusicChooser, {Song} from './MusicChooser';
import {
  useTrackPlayerEvents,
  Event,
  STATE_PLAYING,
} from 'react-native-track-player';
import TrackPlayer from 'react-native-track-player';

export default function Player(props: {
  style: {backgroundColor: any};
  scan: () => void;
  id: string | undefined;
  isTraining: boolean;
  showLoader: (cb?: any) => void;
  hideLoader: (cb?: any) => void;
}) {
  const [musicUris, setMusicUris]: [Song[], any] = useState([]);

  function startAutoplay() {
    // TODO
    // 1. call gatherSongData()
    //   1.1 The result from the gather songData call need to be sent to the other API
    // 2. Add the track to playqueue and play it
    // 3. When song ends (event handlers need to be attached)
    //,
    // Also, possibly need to differentiate event handlers in TrackPlayer singleton
  }

  if (!props.id) {
    //return <Text>The sensor needs to be enabled first!</Text>;
  } else if (props.isTraining) {
    return <Text>Training in progress!</Text>;
  }

  // Just for testing
  const songClickHandler = async (item: Song) => {
    for (let i = 0; i < 100; i++) {
      await TrackPlayer.add(item);
    }
    await TrackPlayer.play();
  };

  return (
    <SafeAreaView style={props.style}>
      <View style={props.style}>
        <View style={{padding: 10}}>
          <Button
            title={'Start Autoplay'}
            onPress={startAutoplay}
            disabled={!musicUris.length}
          />
        </View>

        <MusicChooser
          showLoader={props.showLoader}
          hideLoader={props.hideLoader}
          onClick={songClickHandler}
          musicUris={musicUris}
          setMusicUris={setMusicUris}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    fontSize: 12,
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
