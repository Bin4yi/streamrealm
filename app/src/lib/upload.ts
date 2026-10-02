import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/** Ask for a photo. Camera on phones; on web the browser shows a file picker (or webcam on mobile web). */
export async function pickPhoto(source: 'camera' | 'library'): Promise<string | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, exif: true };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera' && Platform.OS !== 'web') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission is needed to take a photo.');
    result = await ImagePicker.launchCameraAsync(opts);
  } else if (source === 'camera') {
    result = await ImagePicker.launchCameraAsync(opts);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(opts);
  }
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

/** Add a picked photo to a multipart form (web needs a Blob, native takes {uri, name, type}). */
export async function appendPhoto(form: FormData, field: string, uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append(field, blob, `${field}.jpg`);
  } else {
    form.append(field, { uri, name: `${field}.jpg`, type: 'image/jpeg' } as unknown as Blob);
  }
}
