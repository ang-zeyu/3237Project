import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {View} from 'react-native';
import React from 'react';
import {Song} from './MusicChooser';

export default function MoodIcons(props: {song: Song}) {
  return (
    <View style={{flex: 1, flexDirection: 'row'}}>
      {props.song.moods?.map(mood => {
        switch (mood) {
          case 'Aggressive':
            return (
              <Icon
                key="aggressive"
                name="emoticon-angry"
                size={14}
                color="#e69138"
              />
            );
          case 'Athletic':
            return <Icon key="athletic" name="run" size={14} color="#e69138" />;
          case 'Atmospheric':
            return (
              <Icon key="atmospheric" name="earth" size={14} color="#e69138" />
            );
          case 'Elegant':
            return (
              <Icon key="elegant" name="piano" size={14} color="#e69138" />
            );
          case 'Warm':
            return (
              <Icon
                key="warm"
                name="white-balance-sunny"
                size={14}
                color="#e69138"
              />
            );
          case 'Depressive':
            return (
              <Icon
                key="depressive"
                name="emoticon-sad"
                size={14}
                color="#e69138"
              />
            );
          case 'Celebratory':
            return (
              <Icon
                key="celebratory"
                name="party-popper"
                size={14}
                color="#e69138"
              />
            );
          case 'Passionate':
            return (
              <Icon key="passionate" name="heart" size={14} color="#e69138" />
            );
          default:
            return <Icon key="unknown" name="help" size={14} color="#e69138" />;
        }
      })}
    </View>
  );
}
