import {ble} from './Ble';

import constants from '../constants';
const {MOTION_SENSOR} = constants;

import AsyncStorage from '@react-native-async-storage/async-storage';

/*
 Data collected for motion training
 */
export class TrainMotionData {
  gyroX: number[] = [];
  gyroY: number[] = [];
  gyroZ: number[] = [];
  accelX: number[] = [];
  accelY: number[] = [];
  accelZ: number[] = [];

  id = new Date().toDateString();

  // Likely unneeded
  // Originally thought of sending motion training data in batches of 100 in case of memory-constraints
  // 9.7 bytes (average double in javascript) * 6 sensors * 10 numbers per second * 60 seconds * 10 minutes = 349200 bytes = 349kb
  // Should be fine.
  async sendIntermediate() {
    const body = {
      id: this.id,
      gyroX: this.gyroX,
      gyroY: this.gyroY,
      gyroZ: this.gyroZ,
      accelX: this.accelX,
      accelY: this.accelY,
      accelZ: this.accelZ,
    };

    this.gyroX = [];
    this.gyroY = [];
    this.gyroZ = [];
    this.accelX = [];
    this.accelY = [];
    this.accelZ = [];

    console.log(JSON.stringify(body, null, 4));
    /*fetch('TODO API', {
      method: 'POST',
      body: JSON.stringify(body),
    });*/
  }

  async send(activity: string, uuid: string) {
    // console.log(JSON.stringify(body, null, 4));
    const body = JSON.stringify({
      id: this.id,
      gyroX: this.gyroX,
      gyroY: this.gyroY,
      gyroZ: this.gyroZ,
      accelX: this.accelX,
      accelY: this.accelY,
      accelZ: this.accelZ,
      activity: activity,
      isFinal: true,
      uuid,
    });
    /*AsyncStorage.getAllKeys((err, keys) => {
      console.log(keys);
      AsyncStorage.getItem('...fill in...', (err, result) => {
        console.log(result);
      });
    });*/
    try {
      await AsyncStorage.setItem('motion' + new Date().toISOString(), body); // backup
    } catch (ex) {
      console.log('backup failed');
    }
    return fetch('http://54.251.141.237:8080/add-motion-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    }).catch(err => {
      console.log('Error sending motion data', err);
      return AsyncStorage.setItem('motion' + new Date().toISOString(), body);
    });
  }
}

let numUsages = 0;

export async function configureMotionSensors(sensorId: string) {
  numUsages += 1;
  if (numUsages > 1) {
    return;
  }

  // Set listeners
  await ble.write(
    sensorId,
    MOTION_SENSOR.SERVICE_UUID,
    MOTION_SENSOR.CTRL_UUID,
    [
      MOTION_SENSOR.ACCEL_XYZ |
        MOTION_SENSOR.ACCEL_RANGE_4G |
        MOTION_SENSOR.GYRO_XYZ,
      0,
    ],
  );

  // Set period
  await ble.write(
    sensorId,
    MOTION_SENSOR.SERVICE_UUID,
    MOTION_SENSOR.PERIOD_UUID,
    [
      10, // 100ms
    ],
  );

  await ble.startNotificationUseBuffer(
    sensorId,
    MOTION_SENSOR.SERVICE_UUID,
    MOTION_SENSOR.DATA_UUID,
    10, // batch 10 rows into one to reduce JS bridge crossing (10 x 100ms -> 1s)
  );

  console.log('Wrote gatt to enable motionSensor and set its motion period!');
}

export async function stopMotionSensors(sensorId: string) {
  if (!sensorId) {
    return;
  }

  numUsages -= 1;
  if (numUsages > 0) {
    return;
  }

  await ble.stopNotification(
    sensorId,
    MOTION_SENSOR.SERVICE_UUID,
    MOTION_SENSOR.DATA_UUID,
  );

  // this.setState({motionSensor: undefined});
}
