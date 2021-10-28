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
    uuid = db.Column(db.String(50))

    def __init__(self, date, gyro, accel, activity, uuid):
        self.date = date
        self.gyroX = gyro[0]
        self.gyroY = gyro[1]
        self.gyroZ = gyro[2]
        self.accelX = accel[0]
        self.accelY = accel[1]
        self.accelZ = accel[2]
        self.activity = activity
        self.uuid = uuid

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
    moods = db.Column(JSON)
    isSkipped = db.Column(db.Boolean)
    uuid = db.Column(db.String(50))

    def __init__(self, gyro, accel, opt, temp, humidity, moods, isSkipped, uuid):
        self.gyroX = gyro[0]
        self.gyroY = gyro[1]
        self.gyroZ = gyro[2]
        self.accelX = accel[0]
        self.accelY = accel[1]
        self.accelZ = accel[2]
        self.optical = opt
        self.temp = temp
        self.humidity = humidity
        self.moods = moods
        self.isSkipped = isSkipped
        self.uuid = uuid


class PlayerSongData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    moods = db.Column(JSON)
    uuid = db.Column(db.String(50))

    def __init__(self, title, moods, uuid):
        self.title = title
        self.moods = moods
        self.uuid = uuid


class MotionDataSchema(ma.Schema):
    class Meta:
        fields = ('id','date','gyroX','gyroY','gyroZ','accelX','accelY','accelZ','activity', 'uuid')


class SongDataSchema(ma.Schema):
    class Meta:
        fields = ('id','gyroX','gyroY','gyroZ','accelX','accelY','accelZ','optical','temp','humidity','moods','isSkipped', 'uuid')


class PlayerSongSchema(ma.Schema):
    class Meta:
        fields = ('id', 'title', 'moods', 'uuid')


motion_data_schema = MotionDataSchema(many=True)
song_data_schema = SongDataSchema(many=True)
player_song_schema = PlayerSongSchema(many=True, exclude=['id', 'uuid'])


@app.route("/", methods=['GET'])
def home():
    return "<h2>CS3237 Project Team 18</h2><p>IoT Song Recommender</p><p><a href='/get-motion-data'>View motion data</a></p><p><a href='/get-song-data'>View song data</a></p>"

@app.route("/get-motion-data", methods=['GET'])
def get_motion_data():
    all_data = MotionData.query.all()
    results = motion_data_schema.dump(all_data)
    return render_motion_data(results)

def render_motion_data(results):
    content = "<h2>Motion Data</h2><p>Total entries: %d</p><p>ID of last entry: %d</p><p>Samples from latest to oldest:</p>" % (len(results), results[-1]['id'])
    for i in range(len(results),0,-1):
        res = results[i - 1]
        content += "<p style='line-height: 1'>{"
        for field in sorted(res):
            content += "<p style='line-height: 1'>&nbsp;&nbsp;&nbsp;&nbsp;" + field + ": "
            if field not in ['id','date','activity','uuid']:
                content += str(res[field][:2])[:-1] + "..." + str(res[field][-2:])[1:]
                content += " (%d samples)" % len(res[field])
            else:
                content += str(res[field])
            content += "</p>"
        content += "}</p>"
    return content

@app.route("/get-song-data", methods=['GET'])
def get_song_data():
    all_data = SongData.query.all()
    results = song_data_schema.dump(all_data)
    return render_song_data(results)

def render_song_data(results):
    content = "<h2>Song Data</h2><p>Total entries: %d</p><p>ID of last entry: %d</p><p>Samples from latest to oldest:</p>" % (len(results), results[-1]['id'])
    for i in range(len(results),0,-1):
        res = results[i - 1]
        content += "<p style='line-height:1'>{"
        for field in sorted(res):
            content += "<p style='line-height:1'>&nbsp;&nbsp;&nbsp;&nbsp;" + field + ": "
            if field not in ['id','moods','isSkipped','uuid']:
                content += str(res[field][:2])[:-1] + "..." + str(res[field][-2:])[1:]
                content += " (%d samples)" % len(res[field])
            elif field == 'moods' and type(res[field]) is list:
                content += str(res[field])
            else:
                content += str(res[field])
            content += "</p>"
        content += "}</p>"
    return content

@app.route("/add-motion-data", methods=['POST'])
def add_motion_data():
    gyro, accel = [], []

    date = request.json['id'] # single value
    gyro.append(request.json['gyroX']) # JSON
    gyro.append(request.json['gyroY'])
    gyro.append(request.json['gyroZ'])
    accel.append(request.json['accelX'])
    accel.append(request.json['accelY'])
    accel.append(request.json['accelZ'])
    activity = request.json['activity']
    uuid = request.json['uuid']

    results = {
        'date': date,
        'gyroX': gyro[0],
        'gyroY': gyro[1],
        'gyroZ': gyro[2],
        'accelX': accel[0],
        'accelY': accel[1],
        'accelZ': accel[2],
        'activity': activity,
        'uuid': uuid
    }

    data = MotionData(date, gyro, accel, activity, uuid)
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
    moods = request.json['moods']
    isSkipped = request.json['isSkipped']
    uuid = request.json['uuid']

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
        'moods': moods,
        'isSkipped': isSkipped,
        'uuid': uuid
    }

    data = SongData(gyro, accel, opt, temp, humidity, moods, isSkipped, uuid)
    db.session.add(data)
    db.session.commit()

    return jsonify(results)


@app.route("/get-player-song-data/<uuid>", methods=['GET'])
def get_player_song_data(uuid):
    all_data = PlayerSongData.query.filter(PlayerSongData.uuid == uuid).all()
    results = player_song_schema.dump(all_data)
    return jsonify(results)


@app.route("/post-player-song-data", methods=['POST'])
def post_player_song_data():
    title = request.json['title']
    moods = request.json['moods']
    uuid = request.json['uuid']

    existing = PlayerSongData.query.filter(PlayerSongData.title == title and PlayerSongData.uuid == uuid).first()
    if existing is None:
        data = PlayerSongData(title, moods, uuid)
        db.session.add(data)
    else:
        existing.moods = moods
    db.session.commit()

    return jsonify(success=True)


@app.route("/predict-song", methods=['POST'])
def post_player_song_data():
    gyroX = request.json['gyroX']
    gyroY = request.json['gyroY']
    gyroZ = request.json['gyroZ']
    accelX = request.json['accelX']
    accelY = request.json['accelY']
    accelZ = request.json['accelZ']
    opticalVals = request.json['opticalVals']
    tempVals = request.json['tempVals']
    humidityVals = request.json['humidityVals']
    uuid = request.json['uuid']

    # ---------------------------
    # Prediction code

    # ---------------------------

    dummyResponse = {
        'moods': ['Aggressive', 'Athletic', 'Atmospheric', 'Celebratory', 'Depressive', 'Elegant', 'Passionate', 'Warm']
    }

    return jsonify(dummyResponse)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)