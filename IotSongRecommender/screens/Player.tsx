import {Button, SafeAreaView, Text, View} from 'react-native';
import React, {useState} from 'react';
import MusicChooser, {Song} from '../components/MusicChooser';

import TrackPlayer from 'react-native-track-player';

export default function Player(props: {
  style: {backgroundColor: any};
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
