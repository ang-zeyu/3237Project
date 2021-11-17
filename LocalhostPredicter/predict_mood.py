import pandas as pd
import numpy as np

import pprint

# Hardcoded labels for one-hot/label encoding
activity_cats = np.array(['Running', 'Walking', 'Working']) # hardcoded activity categories
moods = ['Aggressive', 'Athletic', 'Atmospheric', 'Celebratory', 'Melancholic', 'Elegant', 'Passionate', 'Warm'] # hardcoded mood categories

## input data as dictionary {'gyroX','gyroY','gyroZ','accelX','accelY','accelZ','opticalVals','tempVals','humidityVals','uuid'}
## returns mood predictions as dictionary {'mood': value }
## returns confidence scores if prob=True else binary values
def get_mood_prediction(data, motion_model, song_model, prob=True):

    # create df
    df_dict = {k:[data[k]] for k in data}
    df = pd.DataFrame(df_dict)

    # take only last 30 samples of gyro/accel data if >30 samples
    for col in df.columns[:6]:
        val = df[col].values
        if len(val) > 30:
            df.at[0,col] = val[-30:]

    # predict activity
    motion_data = [list(k) for k in df.iloc[:,:6].values]
    motion_data = np.array(motion_data)
    motion_data = np.array([k.T for k in motion_data]) # reshape as (1,30,6)
    activity_prob = motion_model.predict(motion_data) #replace with motion_model().predict(motion_data)
    activity = activity_cats[np.argmax(activity_prob, axis=1)][0]

    print('Activity: %s' % activity)

    # one-hot encoding for activity
    for act in activity_cats:
        df[act] = [1] if activity==act else [0]

    print(df)

    # Obtain mean optical, temp and humidity values
    for col in df.columns:
        if col in ['optical','temp','humidity']:
            df[col] = df[col].apply(np.mean)

    print(df[['optical','temp','humidity']])

    # predict song
    x = df[['optical', 'temp', 'humidity','Working', 'Running', 'Walking']] # follow order in ipynb
    res = {k:'' for k in moods}
    if prob:
        pred = np.array(song_model.predict_proba(x.values))
    else:
        pred = np.array(song_model.predict(x.values))

    print('prediction')
    print(pred)

    for i in range(len(moods)):
        mood = moods[i]
        if prob:
            res[mood] = pred[i,:,1][0] - pred[i+len(moods),:,1][0] # predict_proba returns shape (n_features, n_samples, probs)
        else:
            res[mood] = pred[:,i][0] - pred[:,i+len(moods)][0] # predict returns shape (n_samples, n_features)

    return activity, res
    
    
##samp_data = {
##    'gyroX': [499.30572509765625, 499.53460693359375, 0.1983642578125, 0.29754638671875, 499.42779541015625, 0.14495849609375, 0.1220703125, 0.18310546875, 0.0152587890625, 499.5880126953125, 0.244140625, 499.786376953125, 499.8245239257813, 499.5803833007813, 499.73297119140625, 499.9237060546875, 499.755859375, 499.664306640625, 499.71771240234375, 499.6414184570313, 499.48883056640625, 499.5574951171875, 498.69537353515625, 497.344970703125, 499.3362426757813, 497.37548828125, 498.4893798828125, 499.2218017578125, 498.32916259765625, 497.6348876953125],
##    'gyroY': [1.861572265625, 2.49481201171875, 1.0223388671875, 2.15911865234375, 2.37274169921875, 1.495361328125, 2.01416015625, 2.1209716796875, 1.9378662109375, 1.64794921875, 1.57928466796875, 2.2125244140625, 1.10626220703125, 2.11334228515625, 1.15966796875, 1.953125, 1.70135498046875, 1.8463134765625, 1.10626220703125, 1.86920166015625, 2.1514892578125, 1.53350830078125, 2.7313232421875, 4.974365234375, 3.1585693359375, 2.0904541015625, 3.15093994140625, 2.25067138671875, 2.5634765625, 5.3253173828125],
##    'gyroZ': [1.24359130859375, 1.2359619140625, 1.06048583984375, 1.53350830078125, 1.16729736328125, 1.50299072265625, 1.27410888671875, 1.39617919921875, 1.35040283203125, 0.9613037109375, 1.53350830078125, 1.19781494140625, 0.98419189453125, 1.53350830078125, 0.87738037109375, 1.38092041015625, 1.5411376953125, 1.4801025390625, 1.4801025390625, 1.190185546875, 1.18255615234375, 1.46484375, 1.617431640625, 1.6021728515625, 1.65557861328125, 0.95367431640625, 1.9683837890625, 2.0599365234375, 1.190185546875, 2.29644775390625],
##    'accelX': [1.1943359375, 1.201171875, 1.1845703125, 1.1875, 1.1787109375, 1.240234375, 1.185546875, 1.1748046875, 1.1708984375, 1.2158203125, 1.1904296875, 1.2216796875, 1.17578125, 1.2138671875, 1.1787109375, 1.1650390625, 1.203125, 1.20703125, 1.1689453125, 1.1767578125, 1.1904296875, 1.1689453125, 1.1962890625, 1.162109375, 1.1748046875, 1.1484375, 1.1533203125, 1.142578125, 1.130859375, 1.107421875],
##    'accelY': [1.1455078125, 1.1591796875, 1.1630859375, 1.1767578125, 1.162109375, 1.17578125, 1.185546875, 1.162109375, 1.17578125, 1.1728515625, 1.1640625, 1.1611328125, 1.1640625, 1.1943359375, 1.1650390625, 1.17578125, 1.173828125, 1.171875, 1.1875, 1.173828125, 1.169921875, 1.169921875, 1.1875, 1.1474609375, 1.1455078125, 1.1533203125, 1.1328125, 1.115234375, 1.1064453125, 1.0966796875],
##    'accelZ': [3.68359375, 3.654296875, 3.6748046875, 3.6650390625, 3.646484375, 3.6455078125, 3.6806640625, 3.6767578125, 3.703125, 3.65234375, 3.6787109375, 3.6806640625, 3.6962890625, 3.6484375, 3.66015625, 3.65625, 3.6640625, 3.66796875, 3.67578125, 3.673828125, 3.6806640625, 3.6640625, 3.6533203125, 3.724609375, 3.7041015625, 3.74609375, 3.736328125, 3.708984375, 3.71484375, 3.71484375],
##    'optical': [139.64, 138.36, 139.64, 140.28],
##    'temp': [30.50567626953125, 30.50567626953125, 30.50567626953125],
##    'humidity': [71.3134765625, 71.3134765625, 71.3134765625],
##    'uuid': '54:6C:0E:53:36:FC',
##    }
