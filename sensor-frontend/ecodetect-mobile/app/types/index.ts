// Sensor data interfaces
export interface SensorData {
    temperature?: number | null;
    humidity?: number | null;
    pressure?: number | null;
    altitude?: number | null;
    flow_rate?: number | null;
    imu?: {
      acceleration: number[];
      gyroscope: number[];
      magnetometer: number[];
    };
    timestamp?: string;
    location?: string;
    room_id?: string;
    _id?: string;
  }
  
  // Threshold interfaces
  export interface Thresholds {
    temperature_range: number[];
    humidity_range: number[];
    flow_rate_threshold?: number;
  }
  
  // Vehicle movement data
  export interface VehicleMovementData {
    accel_magnitude: number;
    rotation_rate: number;
    movement_type: string;
    orientation: {
      pitch: number;
      roll: number;
      heading: number;
    };
    timestamp?: string;
    raw_data?: {
      acceleration: number[];
      gyroscope: number[];
      magnetometer: number[];
    };
  }
  
  // Notification preferences
  export interface NotificationPreferences {
    email_enabled: boolean;
    sms_enabled: boolean;
    critical_only: boolean;
  }
  
  // Message interface for AI assistant
  export interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
  }
  
  // Room data interface
  export interface RoomData {
    room_id?: string;
    temperature?: number;
    humidity?: number;
    flow_rate?: number;
    pressure?: number;
    timestamp?: string;
    location?: string;
    _id?: string;
  }// Sensor data interfaces
export interface SensorData {
  temperature?: number | null;
  humidity?: number | null;
  pressure?: number | null;
  altitude?: number | null;
  flow_rate?: number | null;
  imu?: {
    acceleration: number[];
    gyroscope: number[];
    magnetometer: number[];
  };
  timestamp?: string;
  location?: string;
  room_id?: string;
  _id?: string;
}

// Threshold interfaces
export interface Thresholds {
  temperature_range: number[];
  humidity_range: number[];
  flow_rate_threshold?: number;
}

// Vehicle movement data
export interface VehicleMovementData {
  accel_magnitude: number;
  rotation_rate: number;
  movement_type: string;
  orientation: {
    pitch: number;
    roll: number;
    heading: number;
  };
  timestamp?: string;
  raw_data?: {
    acceleration: number[];
    gyroscope: number[];
    magnetometer: number[];
  };
}

// Notification preferences
export interface NotificationPreferences {
  email_enabled: boolean;
  sms_enabled: boolean;
  critical_only: boolean;
}

// Message interface for AI assistant
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

// Room data interface
export interface RoomData {
  room_id?: string;
  temperature?: number;
  humidity?: number;
  flow_rate?: number;
  pressure?: number;
  timestamp?: string;
  location?: string;
  _id?: string;
}

export default {};