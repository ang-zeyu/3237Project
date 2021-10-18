import {Pressable, StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {ble} from '../utils/Ble';

export default function ConnectButton(props: {
  id: string | undefined;
  showLoader: (cb?: any) => void;
  hideLoader: (cb?: any) => void;
}) {
  function connect() {
    props.showLoader();
    ble.scan([], 3).then(() => console.log('Scan started'));
    setTimeout(() => props.hideLoader(), 3000);
  }

  return (
    <View>
      <Pressable
        onPress={connect}
        disabled={!!props.id}
        style={({pressed}) => [
          styles.flatButton,
          (pressed && {backgroundColor: '#38ee46'}) || {},
          (props.id && {backgroundColor: '#d5ded7'}) || {},
        ]}
        android_ripple={{color: 'lightblue'}}>
        <Text style={styles.flatButtonText}>{props.id || 'Connect'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
