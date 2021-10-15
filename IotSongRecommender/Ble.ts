import {NativeEventEmitter, NativeModules} from 'react-native';

import BleManager from 'react-native-ble-manager';
import {BehaviorSubject} from 'rxjs';

const BleManagerModule = NativeModules.BleManager;
export const bleEmitter = new NativeEventEmitter(BleManagerModule);
export const ble = BleManager;

export const peripheralId = new BehaviorSubject<string | undefined>(undefined);

async function connectTo(peripheral: any) {
  try {
    await ble.connect(peripheral.id);

    console.log('Connected to CC2650!');
  } catch (ex) {
    console.log('Error connecting to CC2650!');
    await ble.stopScan();
    return;
  }

  try {
    const peripheralData = await ble.retrieveServices(peripheral.id);

    console.log('CC2650 Services retrieved', peripheralData);
  } catch (ex) {
    console.log('Error retrieving CC2650 services');
    await ble.disconnect(peripheral.id);
  }

  await ble.stopScan();
}

let isInitialised = false;
export async function setup() {
  if (isInitialised) {
    return;
  }

  console.log('Initialising BLE...');
  return BleManager.start({})
    .then(async () => {
      isInitialised = true;

      bleEmitter.addListener(EVENTS.CONNECTED, ({peripheral}) => {
        console.log(`Peripheral ${peripheral} connected!`);
        peripheralId.next(peripheral);
      });

      bleEmitter.addListener(EVENTS.DISCONNECTED, ({peripheral}) => {
        console.log(`Peripheral ${peripheral} disconnected!`);
        peripheralId.next(undefined);
      });

      bleEmitter.addListener(EVENTS.DISCOVER, async (p: any) => {
        if (p.name === 'CC2650 SensorTag') {
          await connectTo(p);
        }
      });
      bleEmitter.addListener(EVENTS.STOP_SCAN, async () => {
        console.log('Scan stopped!');
      });

      const connectedDevices = await ble.getConnectedPeripherals([]);
      const connectedCC2650 = connectedDevices.find(
        p => p.name === 'CC2650 SensorTag',
      );
      if (connectedCC2650) {
        console.log('Already connected', connectedCC2650);

        // Reconnect
        try {
          await ble.disconnect(connectedCC2650.id);
        } finally {
          await connectTo(connectedCC2650);
        }
      } else {
        ble.scan([], 3).then(() => console.log('Automatic scan started'));
      }
      console.log('Ble module initialised!');
    })
    .catch(() => {
      console.error('Error setting up BLE!');
    });
}

export const EVENTS = {
  DISCOVER: 'BleManagerDiscoverPeripheral',
  CONNECTED: 'BleManagerConnectPeripheral',
  DISCONNECTED: 'BleManagerDisconnectPeripheral',
  STOP_SCAN: 'BleManagerStopScan',
  CHAR_UPDATE: 'BleManagerDidUpdateValueForCharacteristic',
};
