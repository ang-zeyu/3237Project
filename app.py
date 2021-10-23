from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
import pymysql
pymysql.install_as_MySQLdb()
from sqlalchemy.dialects.postgresql import JSON

app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:3237team18@0.0.0.0:3306/song_recommender_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
ma = Marshmallow(app)

class MotionData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.String(50))
    gyroX = db.Column(JSON)
    gyroY = db.Column(JSON)
    gyroZ = db.Column(JSON)
    accelX = db.Column(JSON)
    accelY = db.Column(JSON)
    accelZ = db.Column(JSON)
    activity = db.Column(db.String(50))

    def __init__(self, date, gyro, accel, activity):
        self.date = date
        self.gyroX = gyro[0]
        self.gyroY = gyro[1]
        self.gyroZ = gyro[2]
        self.accelX = accel[0]
        self.accelY = accel[1]
        self.accelZ = accel[2]
        self.activity = activity

class SongData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    gyroX = db.Column(JSON)
    gyroY = db.Column(JSON)
    gyroZ = db.Column(JSON)
    accelX = db.Column(JSON)
    accelY = db.Column(JSON)
    accelZ = db.Column(JSON)
    optical = db.Column(JSON)
    temp = db.Column(JSON)
    humidity = db.Column(JSON)
    mood = db.Column(db.String(100))
    isSkipped = db.Column(db.Boolean)

    def __init__(self, gyro, accel, opt, temp, humidity, mood, isSkipped):
        self.gyroX = gyro[0]
        self.gyroY = gyro[1]
        self.gyroZ = gyro[2]
        self.accelX = accel[0]
        self.accelY = accel[1]
        self.accelZ = accel[2]
        self.optical = opt
        self.temp = temp
        self.humidity = humidity
        self.mood = mood
        self.isSkipped = isSkipped

class MotionDataSchema(ma.Schema):
    class Meta:
        fields = ('id','date','gyroX','gyroY','gyroZ','accelX','accelY','accelZ','activity')

class SongDataSchema(ma.Schema):
    class Meta:
        fields = ('id','gyroX','gyroY','gyroZ','accelX','accelY','accelZ','opticalVals','tempVals','humidityVals','mood','isSkipped')

motion_data_schema = MotionDataSchema(many=True)
song_data_schema = SongDataSchema(many=True)

@app.route("/", methods=['GET'])
def home():
    return "<h2>CS3237 Project Team 18</h2><p>IoT Song Recommender</p>"

@app.route("/get-motion-data", methods=['GET'])
def get_motion_data():
    all_data = MotionData.query.all()
    results = motion_data_schema.dump(all_data)
    return jsonify(results)

@app.route("/get-song-data", methods=['GET'])
def get_song_data():
    all_data = SongData.query.all()
    results = song_data_schema.dump(all_data)
    return jsonify(results)

@app.route("/add-motion-data", methods=['POST'])
def add_motion_data():
    gyro, accel = [], []

    date = request.json['id'] # single value
    gyro.append(request.json['gyroX'])
    gyro.append(request.json['gyroY'])
    gyro.append(request.json['gyroZ'])
    accel.append(request.json['accelX'])
    accel.append(request.json['accelY'])
    accel.append(request.json['accelZ'])
    activity = request.json['activity']

    results = {
        'date': date,
        'gyroX': gyro[0],
        'gyroY': gyro[1],
        'gyroZ': gyro[2],
        'accelX': accel[0],
        'accelY': accel[1],
        'accelZ': accel[2],
        'activity': activity
    }

    data = MotionData(date, gyro, accel, activity)
    db.session.add(data)
    db.session.commit()

    return jsonify(results)

@app.route("/add-song-data", methods=['POST'])
def add_song_data():
    gyro, accel = [], []

    gyro.append(request.json['gyroX'])
    gyro.append(request.json['gyroY'])
    gyro.append(request.json['gyroZ'])
    accel.append(request.json['accelX'])
    accel.append(request.json['accelY'])
    accel.append(request.json['accelZ'])
    opt = request.json['opticalVals']
    temp = request.json['tempVals']
    humidity = request.json['humidityVals']
    mood = request.json['mood']
    isSkipped = request.json['isSkipped']

    results = {
        'gyroX': gyro[0],
        'gyroY': gyro[1],
        'gyroZ': gyro[2],
        'accelX': accel[0],
        'accelY': accel[1],
        'accelZ': accel[2],
        'opticalVals': opt,
        'tempVals': temp,
        'humidityVals': humidity,
        'mood': mood,
        'isSkipped': isSkipped
    }

    data = SongData(gyro, accel, opt, temp, humidity, mood, isSkipped)
    db.session.add(data)
    db.session.commit()

    return jsonify(results)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
