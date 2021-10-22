package com.iotsongrecommender;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.util.Log;

import androidx.documentfile.provider.DocumentFile;

/*
 Custom native module for resolving actual file path from content uri (from document picker).

 This is a deeper rabbit hole than it seems,
 its an open issue here https://github.com/rnmods/react-native-document-picker/issues/70
 with no clear ready made solution.

 Attempted:
 - react-native-fs stat()
 - react-native-get-real-path (deprecated)
 - react-native-android-uri
 */
public class FilePathResolverModule extends  ReactContextBaseJavaModule {
    FilePathResolverModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "FilePathResolverModule";
    }

    private void getMusicFiles(DocumentFile directory, WritableArray music) {
        for (DocumentFile f : directory.listFiles()) {
            /*if (f.isFile() && f.getType() != null) {
                Log.i(this.getName(), f.getUri() + " " + f.getType());
            }*/
            if (f.isDirectory()) {
                getMusicFiles(f, music);
            } else if (f.isFile()
                    && f.getType().contains("audio")
                    && !f.getName().startsWith("._") // metadata
            ){
                Uri uri = f.getUri();
                //Log.i(this.getName(), "Setting " + uri);

                MediaMetadataRetriever m = new MediaMetadataRetriever();
                m.setDataSource(this.getReactApplicationContext(), uri);

                //Log.i(this.getName(), "Successfully set " + uri);

                WritableMap currMusic = Arguments.createMap();
                String title = m.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
                int duration = (int)Math.ceil(
                    ((double)Integer.parseInt(m.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION))) / 1000.0
                    );
                if (title == null) {
                    continue; // must have title
                }
                currMusic.putString("url", uri.toString());
                currMusic.putString("title", title);
                currMusic.putString("artist", m.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST));
                currMusic.putInt("duration", duration);
                m.release();

                music.pushMap(currMusic);
            }
        }
    }

    @ReactMethod
    public void getDirectoryMusicFiles(String uri, Callback callback) {
        DocumentFile docFile = DocumentFile.fromTreeUri(this.getReactApplicationContext(), Uri.parse(uri));
        WritableArray music = Arguments.createArray();
        getMusicFiles(docFile, music);

        callback.invoke(music);
    }
}
