import pandas as pd
import numpy as np 
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import timedelta 
from sklearn.preprocessing import StandardScaler
import json
from scipy import stats
import os
from sklearn.preprocessing import OneHotEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import pickle

dataset = pd.read_csv("Motion data.csv", header=0)

#drop data that are anomalous or lying down (id 13, 15, 17, 26, 30, 39)

def checkIfInList(lst, value):
    for item in lst:
        if item == value:
            return True 
    return False 

anomaly_index = [13, 26, 30, 39]
anomaly_lst_index = dataset[(dataset['id'] == 13) | (dataset['id'] == 15) | (dataset['id'] == 17) | (dataset['id'] == 26) | (dataset['id'] == 30) | (dataset['id'] == 39)].index
dataset_cleaned = dataset.drop(anomaly_lst_index)
dataset_cleaned

#function to break data to 30 timesteps 
X = []
y = []

def breakIntoChunks(lst, size, label):
    lst = lst.tolist()
    global X
    global y
    numChunks = int(len(lst) / size)
    for i in range(0, numChunks):
        firstIndex = 30 * i
        secondIndex = 30 * (i+1)
        chunk = lst[firstIndex: secondIndex]
        chunk = np.array(chunk)
        chunk = np.reshape(chunk, (-1, 6))
        X.append(chunk)
        y.append(label)
    return

#convert data into 30 timesteps (3s)
for index, row in dataset_cleaned.iterrows():
    
    #convert to list 
    gyroX_set = json.loads(row['gyroX'])
    gyroY_set = json.loads(row['gyroY'])
    gyroZ_set = json.loads(row['gyroZ'])
    accelX_set = json.loads(row['accelX'])
    accelY_set = json.loads(row['accelY'])
    accelZ_set = json.loads(row['accelZ'])
    
    #stack into an array
    row_data = np.vstack((gyroX_set, gyroY_set, gyroZ_set, accelX_set, accelY_set, accelZ_set)).transpose()
    
    breakIntoChunks(row_data, 30, row['activity'])

#to numpy
X_arr = np.array(X)
y_arr = np.array(y)

#split with train test split 
trainvalX, testX, trainvalY, testY = train_test_split(X_arr, y_arr, test_size=0.1, random_state = 42)
trainX, valX, trainY, valY = train_test_split(trainvalX, trainvalY, test_size=0.15, random_state=42)

#one hot encoder 

#reshape array
reshape_trainY = trainY.reshape(len(trainY), 1)
reshape_valY = valY.reshape(len(valY), 1)
reshape_testY = testY.reshape(len(testY), 1)

encoder = OneHotEncoder(sparse=False).fit(reshape_trainY)
onehot_trainY = encoder.transform(reshape_trainY)
onehot_valY = encoder.transform(reshape_valY)
onehot_testY = encoder.transform(reshape_testY)

def mapResultsToOneHot(results):
    output = []
    for vector in results:
        vector_lst = vector.tolist()
        max_Index = vector_lst.index(max(vector_lst))
        onehot_vector = []
        for i in range(0, len(vector_lst)):
            if i == max_Index:
                onehot_vector.append(1)
            else:
                onehot_vector.append(0)
        output.append(onehot_vector)
    return output

filename = 'model.sav'
mw2 = pickle.load(open(filename, 'rb'))

#evaluate performance 

#training set 
trainPredict2 = mw2().predict(trainX)
trainPredict2 = mapResultsToOneHot(trainPredict2)
trainPredict2 = encoder.inverse_transform(trainPredict2)
trainPredict2 = trainPredict2.reshape(-1,)
trainAccuracy2 = accuracy_score(trainY, trainPredict2)
print("Accuracy of training set %f" % trainAccuracy2)

#validation set 
valPredict2 = mw2().predict(valX)
valPredict2 = mapResultsToOneHot(valPredict2)
valPredict2 = encoder.inverse_transform(valPredict2)
valPredict2 = valPredict2.reshape(-1,)
valAccuracy2 = accuracy_score(valY, valPredict2)
print("Accuracy of validation set %f" % valAccuracy2)

#test set 
testPredict2 = mw2().predict(testX)
testPredict2 = mapResultsToOneHot(testPredict2)
testPredict2 = encoder.inverse_transform(testPredict2)
testPredict2 = testPredict2.reshape(-1,)
testAccuracy2 = accuracy_score(testY, testPredict2)
print("Accuracy of test set %f" % testAccuracy2)