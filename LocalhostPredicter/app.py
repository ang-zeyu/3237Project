from flask import Flask, jsonify, request
import numpy as np
from sklearn.metrics import pairwise
import pickle
from tensorflow.keras.models import load_model

app = Flask(__name__)

# Get prediction function
from predict_mood import get_mood_prediction

# Load models
print('[INFO] Loading motion model...')
motion_model = load_model('savedModel_stackedLSTM') #replace with motion_model = pickle.load(open('model.sav', 'rb'))
print('[INFO] Motion model loaded.')
print('[INFO] Loading song model...')
song_model = pickle.load(open('RandomForest', 'rb'))
print('[INFO] Song model loaded.')

NUM_MOODS = 8
MOODS_TO_IDX_MAP = {
    'Aggressive': 0,
    'Athletic': 1,
    'Atmospheric': 2,
    'Celebratory': 3,
    'Melancholic': 4,
    'Elegant': 5,
    'Passionate': 6,
    'Warm': 7
}

def moodToIdx(mood):
    return MOODS_TO_IDX_MAP[mood]

@app.route("/test", methods=['GET'])
def home():
    return "<h2>CS3237 Project Team 18</h2><p>Prediction server up and running.</p>"


from pprint import pprint


@app.route("/predict-song", methods=['POST'])
def predict_song():
    gyroX = request.json['gyroX']
    gyroY = request.json['gyroY']
    gyroZ = request.json['gyroZ']
    accelX = request.json['accelX']
    accelY = request.json['accelY']
    accelZ = request.json['accelZ']
    opticalVals = request.json['opticalVals']
    tempVals = request.json['tempVals']
    humidityVals = request.json['humidityVals']
    # uuid = request.json['uuid']
    userAllSongs = request.json['songsAndMoods']
    print(userAllSongs)

    data = {
        'gyroX': gyroX,
        'gyroY': gyroY,
        'gyroZ': gyroZ,
        'accelX': accelX,
        'accelY': accelY,
        'accelZ': accelZ,
        'optical': opticalVals,
        'temp': tempVals,
        'humidity': humidityVals,
    }
    print(data)

    activity, moodPred = get_mood_prediction(data, motion_model, song_model, prob=True)
    print('8 dimensional mood scores')
    pprint(moodPred)
    moodArr = np.array([k for k in moodPred.values()]).reshape(1,-1) # reshape for pairwise (X.shape[1]==8)

    userSongsMoods = np.zeros((len(userAllSongs), NUM_MOODS))
    currRow = 0
    for song in userAllSongs:
        songMoods = list(map(moodToIdx, song['moods']))
        userSongsMoods[currRow, songMoods] = 1
        currRow += 1

    similarities = pairwise.cosine_similarity(moodArr, Y=userSongsMoods, dense_output=True)
    closestIdx = np.argmax(similarities)
    print('Cosine measure scores with user songs:')
    print(similarities)
    print('Closest user song:')
    print(closestIdx)
    closestSongTitleAndDuration = userAllSongs[closestIdx]['songTitleAndDuration'].rsplit(sep='--', maxsplit=1)

    return jsonify({
        'title': closestSongTitleAndDuration[0],
        'duration': closestSongTitleAndDuration[1],
        'activity': activity,
        'moods': moodPred
    })

# change server
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
