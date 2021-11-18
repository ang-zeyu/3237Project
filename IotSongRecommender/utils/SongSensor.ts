/*
 Single set of data for song prediction (or, training)
 */

import BackgroundTimer from 'react-native-background-timer';

import {ble} from './Ble';

import constants from '../constants';
import {configureMotionSensors, stopMotionSensors} from './MotionSensor';
import {createCharacteristicUpdateListener} from './Sensor';
import {Song} from '../components/MusicChooser';
const {OPTICAL_SENSOR, HUMIDITY_SENSOR, MOTION_SENSOR, SONG_BURST_SERVICE} = constants;

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
    fetch(`${constants.EC2_BASE_URL}/add-song-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    }).catch(err => {
      console.log('Error sending song data', err);
    });
  }

  async sendForPrediction(
    uuid: string,
    songsAndMoods: {
      songTitleAndDuration: string;
      moods: string[];
    }[],
  ): Promise<{
    title: string;
    duration: string;
    activity: string;
  }> {
    const body = JSON.stringify({
      // Sensor burst
      gyroX: this.gyroX,
      gyroY: this.gyroY,
      gyroZ: this.gyroZ,
      accelX: this.accelX,
      accelY: this.accelY,
      accelZ: this.accelZ,
      opticalVals: this.opticalVals,
      tempVals: this.tempVals,
      humidityVals: this.humidityVals,
      uuid, // unused
      songsAndMoods,
    });
    console.log(body);
    return fetch(`${constants.PREDICT_LOCALHOST}/predict-song`, {
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

  await ble.write(
    sensorId,
    OPTICAL_SENSOR.SERVICE_UUID,
    OPTICAL_SENSOR.CTRL_UUID,
    [0],
  );
  await ble.write(
    sensorId,
    HUMIDITY_SENSOR.SERVICE_UUID,
    HUMIDITY_SENSOR.CTRL_UUID,
    [0],
  );
}

const SONG_DATA_DURATION = 3000; // ms

async function songDataCountdownStarter(
  sensorId: string,
): Promise<() => Promise<void>> {
  if (!sensorId) {
    throw new Error('Not connected!');
  }

  await configureMotionSensors(sensorId);

  // Returns a function that initiates the data collection countdown
  return () => {
    return new Promise<void>((resolve, reject) => {
      BackgroundTimer.setTimeout(async () => {
        await stopMotionSensors(sensorId);
        await configureSongSensors(sensorId);
        BackgroundTimer.setTimeout(async () => {
          try {
            await stopSongSensors(sensorId);
          } catch (e) {
            console.error(e);
            resolve();
          }

          resolve();
        }, SONG_DATA_DURATION);
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

export async function gatherSongDataNew(sensorId: string): Promise<SongData> {
  // mtu
  const mtu = await ble.requestMTU(sensorId, 512);
  console.log(mtu);

  // Set listeners
  await ble.write(
    sensorId,
    SONG_BURST_SERVICE.SERVICE_UUID,
    SONG_BURST_SERVICE.CTRL_UUID,
    [
      MOTION_SENSOR.ACCEL_XYZ |
        MOTION_SENSOR.ACCEL_RANGE_4G |
        MOTION_SENSOR.GYRO_XYZ,
      0,
    ],
  );

  await new Promise(resolve => setTimeout(() => resolve(), 4000));

  const data = await ble.read(
    sensorId,
    SONG_BURST_SERVICE.SERVICE_UUID,
    SONG_BURST_SERVICE.DATA_UUID,
  );

  await ble.write(
    sensorId,
    SONG_BURST_SERVICE.SERVICE_UUID,
    SONG_BURST_SERVICE.CTRL_UUID,
    [0, 0],
  );

  console.log(data);

  const songData = new SongData();

  // 12 bytes * 30 of gyroscope and accelerometer data
  for (let i = 0; i < 360; i += 12) {
    songData.gyroX.push(
      (data[i] + (data[i + 1] << 8)) * MOTION_SENSOR.GYRO_SCALE,
    );
    songData.gyroY.push(
      (data[i + 2] + (data[i + 3] << 8)) * MOTION_SENSOR.GYRO_SCALE,
    );
    songData.gyroZ.push(
      (data[i + 4] + (data[i + 5] << 8)) * MOTION_SENSOR.GYRO_SCALE,
    );
    songData.accelX.push(
      (data[i + 6] + (data[i + 7] << 8)) * MOTION_SENSOR.ACCEL_SCALE,
    );
    songData.accelY.push(
      (data[i + 8] + (data[i + 9] << 8)) * MOTION_SENSOR.ACCEL_SCALE,
    );
    songData.accelZ.push(
      (data[i + 10] + (data[i + 11] << 8)) * MOTION_SENSOR.ACCEL_SCALE,
    );
  }

  // 2 bytes * 3 of optical data
  for (let i = 360; i < 366; i += 2) {
    const rawOpticalValue = data[i] + (data[i + 1] << 8);

    const mantissa = rawOpticalValue & 0xfff;
    const exponent = (rawOpticalValue & 0xf000) >> 12;
    songData.opticalVals.push(0.01 * (mantissa << exponent));
  }

  // 4 bytes * 3 of temperature and humidity data
  for (let i = 366; i < 378; i += 4) {
    const rawTempValue = data[i] + (data[i + 1] << 8);
    const rawHumidtyValue = data[i + 2] + (data[i + 3] << 8);

    songData.tempVals.push(-40 + 165 * (rawTempValue / 65536));
    songData.humidityVals.push(100 * (rawHumidtyValue / 65536));
  }

  return songData;
}
