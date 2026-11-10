import * as Linking from 'expo-linking';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.4:8000';
export const REDIRECT_URI = Linking.createURL('callback');
