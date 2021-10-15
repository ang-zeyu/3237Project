# 3237Project

## Running the react-native app

1. `cd` into `IotSongRecommender` folder
2. Run `npm install` to install dependencies
3. Connect your android phone in debug mode
4. Run `npm run android` to build and load the debug apk into your phone
5. (Will be automatic prompt later) Go into your phone settings and enable location permissions for IotSongRecommender app

## User Stories?

App
- I should be able to interface with BLE functionalities on CC2650, so that I can gather data for training and prediction
- I should be able to navigate to 2 separate screens for training and prediction (autoplay), so that the separation of functionalities is clear.
- I should be able to initiate and stop **motion** (running, walking, ...) training at any time with a button
  - The activity should be selectable as a dropdown / secondary popup / etc.
  - I should be able to stop training, and call the motion training API
- I should be able to source training **and** autoplay files from a folder on my phone
- I should be able to populate song labels of music files with an API call
- I should be able to initiate **song** training (play randomised songs from folder) at any time with a button
  - I should be able to have the sensor collect data for a while at the beginning of each song playing (3-5s)
  - When I skip a song before it has been completed, I will send a training API call with an "inverted" flag
  - When I let a song play to completion, I will send a normal training API call
- I should be able to initiate song autoplay mode using sensor IoT data on the prediction screen with a button
  - I should be able to have the sensor collect data for a while at the beginning of each song playing (3-5s),
    so that I can call the prediction API to get a song recommendation

Backend
- I should be able to administrate EC2 instances, for serving the backend APIs and training the ML models
- I should support a motion training API that takes sensor inputs over some period + the activity
- I should support a song training API that takes sensor inputs over a short period + the song played, and its labels
- I should support a song prediction API that takes sensor inputs over a short period, and recommend a song based on labels
- I should support a song labels API that takes a list of song titles and artists as inputs (ideally) and returns their corresponding song labels
- I should be able to interface with the millionsongdataset.com, and possibly others, so that I can retrieve song labels
* I should be able to save training data to some local file / database, so that I can tweak and adjust the model anytime during development
  - Correspondingly, I should be able to retrieving said training data and train ML models at any time

CC2650
- We should calibrate our sensors if needed, so that aggregating data is consistent

