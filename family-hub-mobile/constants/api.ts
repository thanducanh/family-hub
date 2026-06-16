import { Platform } from 'react-native';

const LAN_IP = '192.168.1.5';

export const API_BASE = Platform.OS === 'web' ? 'http://localhost:3000' : `http://${LAN_IP}:3000`;
