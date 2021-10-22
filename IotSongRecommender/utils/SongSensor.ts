/*
 Single set of data for song prediction (or, training)
 */
import {ble} from './Ble';

import constants from '../constants';
import {configureMotionSensors, stopMotionSensors} from './MotionSensor';
import {createCharacteristicUpdateListener} from './Sensor';
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

  async send() {
    const body = {
      gyroX: this.gyroX,
      gyroY: this.gyroY,
      gyroZ: this.gyroZ,
      accelX: this.accelX,
      accelY: this.accelY,
      accelZ: this.accelZ,
      opticalVals: this.opticalVals,
      tempVals: this.tempVals,
      humidityVals: this.humidityVals,
    };

    console.log(JSON.stringify(body, null, 4));
    /*fetch('TODO API', {
      method: 'POST',
      body: JSON.stringify(body),
    });*/
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

export async function gatherSongData(
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
      setTimeout(async () => {
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
