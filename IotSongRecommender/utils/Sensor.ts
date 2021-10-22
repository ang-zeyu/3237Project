import constants from '../constants';
import {bleEmitter, EVENTS} from './Ble';
import { EmitterSubscription } from "react-native";
const {OPTICAL_SENSOR, HUMIDITY_SENSOR, MOTION_SENSOR} = constants;

const motionDataSubscribers: ((
  gyroX: number,
  gyroY: number,
  gyroZ: number,
  accelX: number,
  accelY: number,
  accelZ: number,
) => void)[] = [];
const opticalDataSubscribers: ((val: number) => void)[] = [];
const humidityDataSubscribers: ((temp: number, humidity: number) => void)[] = [];


function handleCharacteristicUpdate(data: {
  value: any;
  peripheral: string;
  characteristic: string;
  service: string;
}) {
  console.log('For', data);

  switch (data.characteristic) {
    case MOTION_SENSOR.DATA_UUID: {
      // motion sensor message is 18 bytes, so + 18
      // startNotificationUseBuffer strangely appends 20 bytes (MTU) of zeros to the back; discard it
      // Refer to the .py provided by prof for other details
      const end = data.value.length - 20;
      for (let i = 0; i < end; i += 18) {
        const gyroX =
          (data.value[i] + (data.value[i + 1] << 8)) *
          MOTION_SENSOR.GYRO_SCALE;
        const gyroY =
          (data.value[i + 2] + (data.value[i + 3] << 8)) *
          MOTION_SENSOR.GYRO_SCALE;
        const gyroZ =
          (data.value[i + 4] + (data.value[i + 5] << 8)) *
          MOTION_SENSOR.GYRO_SCALE;
        const accelX =
          (data.value[i + 6] + (data.value[i + 7] << 8)) *
          MOTION_SENSOR.ACCEL_SCALE;
        const accelY =
          (data.value[i + 8] + (data.value[i + 9] << 8)) *
          MOTION_SENSOR.ACCEL_SCALE;
        const accelZ =
          (data.value[i + 10] + (data.value[i + 11] << 8)) *
          MOTION_SENSOR.ACCEL_SCALE;

        for (const subscriber of motionDataSubscribers) {
          subscriber(gyroX, gyroY, gyroZ, accelX, accelY, accelZ);
        }
      }
      break;
    }
    case OPTICAL_SENSOR.DATA_UUID: {
      // Refer to the .py provided by prof
      const rawValue = data.value[0] + (data.value[1] << 8);

      const mantissa = rawValue & 0xfff;
      const exponent = (rawValue & 0xf000) >> 12;
      const opticalVal = 0.01 * (mantissa << exponent);

      for (const subscriber of opticalDataSubscribers) {
        subscriber(opticalVal);
      }
      break;
    }
    case HUMIDITY_SENSOR.DATA_UUID: {
      // Refer to the .py provided by prof
      const rawTempValue = data.value[0] + (data.value[1] << 8);
      const rawHumidtyValue = data.value[2] + (data.value[3] << 8);

      const temp = -40 + 165 * (rawTempValue / 65536);
      const humidity = 100 * (rawHumidtyValue / 65536);

      for (const subscriber of humidityDataSubscribers) {
        subscriber(temp, humidity);
      }
      break;
    }
  }
}

let subscriberCount = 0;

export function createCharacteristicUpdateListener(
  processMotionData: (
    gyroX: number,
    gyroY: number,
    gyroZ: number,
    accelX: number,
    accelY: number,
    accelZ: number,
  ) => void,
  processOpticalData: (val: number) => void,
  processHumidityData: (temp: number, humidity: number) => void,
): () => void {
  motionDataSubscribers.push(processMotionData);
  opticalDataSubscribers.push(processOpticalData);
  humidityDataSubscribers.push(processHumidityData);

  if (subscriberCount === 0) {
    bleEmitter.addListener(EVENTS.CHAR_UPDATE, handleCharacteristicUpdate);
  }
  subscriberCount += 1;

  return () => {
    motionDataSubscribers.splice(
      motionDataSubscribers.indexOf(processMotionData),
      1,
    );
    opticalDataSubscribers.splice(
      opticalDataSubscribers.indexOf(processOpticalData),
      1,
    );
    humidityDataSubscribers.splice(
      humidityDataSubscribers.indexOf(processHumidityData),
      1,
    );

    subscriberCount -= 1;
    if (subscriberCount === 0) {
      bleEmitter.removeAllListeners(EVENTS.CHAR_UPDATE);
    }
  };
}
