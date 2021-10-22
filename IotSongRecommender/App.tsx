import {Platform, StatusBar} from 'react-native';
import React from 'react';

import {Colors} from 'react-native/Libraries/NewAppScreen';

import Spinner from 'react-native-loading-spinner-overlay';

import Ionicons from 'react-native-vector-icons/Ionicons';

import VIForegroundService from '@voximplant/react-native-foreground-service';

import {ble, bleEmitter, EVENTS, peripheralId} from './utils/Ble';

import {Subscription} from 'rxjs/dist/types';
import {NavigationContainer} from '@react-navigation/native';
import Training from './screens/Training';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Player from './screens/Player';
import ConnectButton from './components/ConnectButton';

class App extends React.Component<
  {},
  {
    id?: string;
    showSpinner: boolean;

    isTraining: boolean;
  }
> {
  isDarkMode = false;

  backgroundStyle = {
    backgroundColor: Colors.lighter,
  };

  peripheralIdSubscription?: Subscription;

  constructor(props: any) {
    super(props);
    this.state = {
      id: undefined,
      showSpinner: true,

      isTraining: false,
    };
  }

  componentDidMount() {
    this.peripheralIdSubscription = peripheralId.subscribe(
      (id: string | undefined) => {
        this.setState({
          id,
          showSpinner: false,
        });
      },
    );

    setTimeout(this.hideSpinner, 300);
  }

  componentWillUnmount() {
    this.peripheralIdSubscription?.unsubscribe();
    console.log('App unmounting');
  }

  // Following two methods are adapted from the library itself
  // https://github.com/voximplant/react-native-foreground-service-demo/blob/master/App.js
  // See android official documentation https://developer.android.com/guide/components/services
  // for details on foreground services
  // This is to keep BLE running while we train on motion data
  async startService() {
    if (Platform.OS !== 'android') {
      console.log('Only Android platform is supported');
      return;
    }
    if (Platform.Version >= 26) {
      const channelConfig = {
        id: 'ForegroundServiceChannel',
        name: 'Notification Channel',
        description: 'Notification Channel for Foreground Service',
        enableVibration: false,
        importance: 2,
      };
      await VIForegroundService.createNotificationChannel(channelConfig);
    }
    const notificationConfig = {
      id: 3456,
      title: 'Foreground Service',
      text: 'Foreground service is running',
      icon: 'ic_notification',
      priority: 0,
    };
    if (Platform.Version >= 26) {
      (notificationConfig as any).channelId = 'ForegroundServiceChannel';
    }
    await VIForegroundService.startService(notificationConfig);
  }

  async stopService() {
    await VIForegroundService.stopService();
  }

  showSpinner = (cb: any = () => {}) => {
    this.setState({showSpinner: true}, cb);
  };

  hideSpinner = (cb: any = () => {}) => {
    this.setState({showSpinner: false}, cb);
    console.log('hiding spinner...');
  };

  render() {
    return (
      <NavigationContainer>
        <StatusBar barStyle={'light-content'} backgroundColor={'#000000'} />
        <Spinner
          visible={this.state.showSpinner}
          textContent={'Loading...'}
          color={'#ffffff'}
          textStyle={{color: '#ffffff'}}
        />
        <Tab.Navigator
          screenOptions={({route}) => ({
            tabBarIcon: ({focused, color, size}) => {
              let iconName;

              if (route.name === 'Training') {
                iconName = focused ? 'ios-analytics' : 'ios-analytics-outline';
              } else if (route.name === 'Player') {
                iconName = focused
                  ? 'ios-musical-notes'
                  : 'ios-musical-notes-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: 'tomato',
            tabBarInactiveTintColor: 'gray',
            tabBarLabelStyle: {marginBottom: 10},
            tabBarStyle: {height: 60},
          })}>
          <Tab.Screen name={'Training'}>
            {() => (
              <React.Fragment>
                <ConnectButton
                  id={this.state.id}
                  showLoader={this.showSpinner}
                  hideLoader={this.hideSpinner}
                />
                <Training
                  style={this.backgroundStyle}
                  id={this.state.id}
                  startService={this.startService}
                  stopService={this.stopService}
                  showLoader={this.showSpinner}
                  hideLoader={this.hideSpinner}
                />
              </React.Fragment>
            )}
          </Tab.Screen>
          <Tab.Screen name={'Player'}>
            {() => (
              <Player
                style={this.backgroundStyle}
                id={this.state.id}
                isTraining={this.state.isTraining}
                showLoader={this.showSpinner}
                hideLoader={this.hideSpinner}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    );
  }
}

const Tab = createBottomTabNavigator();

export default App;
