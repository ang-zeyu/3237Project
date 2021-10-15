import constants from './constants';
import BleManager from 'react-native-ble-manager';
import {ble, bleEmitter, EVENTS} from './Ble';
const {OPTICAL_SENSOR, HUMIDITY_SENSOR, MOTION_SENSOR} = constants;

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
) {
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

          processMotionData(gyroX, gyroY, gyroZ, accelX, accelY, accelZ);
        }
        break;
      }
      case OPTICAL_SENSOR.DATA_UUID: {
        // Refer to the .py
        const rawValue = data.value[0] + (data.value[1] << 8);

        const mantissa = rawValue & 0xfff;
        const exponent = (rawValue & 0xf000) >> 12;
        const opticalVal = 0.01 * (mantissa << exponent);

        processOpticalData(opticalVal);
        break;
      }
      case HUMIDITY_SENSOR.DATA_UUID: {
        // Refer to the .py
        const rawTempValue = data.value[0] + (data.value[1] << 8);
        const rawHumidtyValue = data.value[2] + (data.value[3] << 8);

        const temp = -40 + 165 * (rawTempValue / 65536);
        const humidity = 100 * (rawHumidtyValue / 65536);

        processHumidityData(temp, humidity);
        break;
      }
    }
  }

  bleEmitter.addListener(EVENTS.CHAR_UPDATE, handleCharacteristicUpdate);
}
