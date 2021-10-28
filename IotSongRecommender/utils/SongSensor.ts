/*
 Single set of data for song prediction (or, training)
 */

import BackgroundTimer from 'react-native-background-timer';

import {ble} from './Ble';

import constants from '../constants';
import {configureMotionSensors, stopMotionSensors} from './MotionSensor';
import { createCharacteristicUpdateListener } from "./Sensor";
const {OPTICAL_SENSOR, HUMIDITY_SENSOR} = constants;

export class SongData {
  gyroX: number[] = [];
  gyroY: number[] = [];
  gyroZ: number[] = [];
  accelX: number[] = [];
  accelY: number[] = [];
  accelZ: number[] = [];

  // These aren't time series data, but sensor data wildly fluctuates at times
  // Better to take some average / mode
  opticalVals: number[] = [];
  humidityVals: number[] = [];
  tempVals: number[] = [];

  async sendForTraining(moods: string[], isSkipped: boolean, uuid: string) {
    const body = JSON.stringify({
      gyroX: this.gyroX,
      gyroY: this.gyroY,
      gyroZ: this.gyroZ,
      accelX: this.accelX,
      accelY: this.accelY,
      accelZ: this.accelZ,
      opticalVals: this.opticalVals,
      tempVals: this.tempVals,
      humidityVals: this.humidityVals,
      moods,
      isSkipped,
      uuid,
    });
    console.log(body);
    fetch('http://54.251.141.237:8080/add-song-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    }).catch(err => {
      console.log('Error sending song data', err);
    });
  }

  async sendForPrediction(uuid: string): Promise<{
    moods: string[];
  }> {
    const body = JSON.stringify({
      gyroX: this.gyroX,
      gyroY: this.gyroY,
      gyroZ: this.gyroZ,
      accelX: this.accelX,
      accelY: this.accelY,
      accelZ: this.accelZ,
      opticalVals: this.opticalVals,
      tempVals: this.tempVals,
      humidityVals: this.humidityVals,
      uuid,
    });
    console.log(body);
    return fetch('http://54.251.141.237:8080/predict-song', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    }).then(res => res.json());
  }
}

let numUsages = 0;

async function configureSongSensors(sensorId: string) {
  if (!sensorId) {
    return;
  }

  numUsages += 1;
  if (numUsages > 1) {
    return;
  }

  // Set listeners
  await ble.write(
    sensorId,
    OPTICAL_SENSOR.SERVICE_UUID,
    OPTICAL_SENSOR.CTRL_UUID,
    [1],
  );
  await ble.write(
    sensorId,
    HUMIDITY_SENSOR.SERVICE_UUID,
    HUMIDITY_SENSOR.CTRL_UUID,
    [1],
  );

  await ble.startNotification(
    sensorId,
    OPTICAL_SENSOR.SERVICE_UUID,
    OPTICAL_SENSOR.DATA_UUID,
  );
  await ble.startNotification(
    sensorId,
    HUMIDITY_SENSOR.SERVICE_UUID,
    HUMIDITY_SENSOR.DATA_UUID,
  );

  console.log('Wrote gatt to enable optical, humidity sensor notifications');
}

async function stopSongSensors(sensorId: string) {
  if (!sensorId) {
    return;
  }

  numUsages -= 1;
  if (numUsages > 0) {
    return;
  }

  await ble.stopNotification(
    sensorId,
    OPTICAL_SENSOR.SERVICE_UUID,
    OPTICAL_SENSOR.DATA_UUID,
  );
  await ble.stopNotification(
    sensorId,
    HUMIDITY_SENSOR.SERVICE_UUID,
    HUMIDITY_SENSOR.DATA_UUID,
  );
}

async function stopSongDataGathering(sensorId: string) {
  await stopMotionSensors(sensorId);
  await stopSongSensors(sensorId);
  console.log('Song sensors stopped!');
}

const SONG_DATA_DURATION = 3000; // ms

async function songDataCountdownStarter(
  sensorId: string,
): Promise<() => Promise<void>> {
  if (!sensorId) {
    throw new Error('Not connected!');
  }

  await configureMotionSensors(sensorId);
  await configureSongSensors(sensorId);

  // Returns a function that initiates the data collection countdown
  return () => {
    return new Promise<void>((resolve, reject) => {
      BackgroundTimer.setTimeout(async () => {
        try {
          await stopSongDataGathering(sensorId);
        } catch (e) {
          console.error(e);
          resolve();
        }

        resolve();
      }, SONG_DATA_DURATION);
    });
  };
}

export async function gatherSongData(
  sensorId: string,
  beforeCountdownStart: (songData: SongData) => Promise<void>,
): Promise<void> {
  console.log('Gathering song data...');
  const countdown = await songDataCountdownStarter(sensorId);

  const songData = new SongData();
  const songCharacteristicsUnsub = createCharacteristicUpdateListener(
    (gyroX, gyroY, gyroZ, accelX, accelY, accelZ) => {
      songData.gyroX.push(gyroX);
      songData.gyroY.push(gyroY);
      songData.gyroZ.push(gyroZ);
      songData.accelX.push(accelX);
      songData.accelY.push(accelY);
      songData.accelZ.push(accelZ);
    },
    opticalVal => {
      songData.opticalVals.push(opticalVal);
    },
    (temp, humidity) => {
      songData.tempVals.push(temp);
      songData.humidityVals.push(humidity);
    },
  );

  await beforeCountdownStart(songData);

  await countdown();
  songCharacteristicsUnsub();
  console.log('Gathered song data...');
}
