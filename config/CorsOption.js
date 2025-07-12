import AllowedOrigin from './AllowedOrigin.js';

class CorsHandler {
  constructor(allowedOrigins) {
    this.allowedOrigins = allowedOrigins;
  }

  validateOrigin(origin, callback) {
    if (this.allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }

  getCorsOptions() {
    return {
      origin: this.validateOrigin.bind(this), // use custom validation function
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
      exposedHeaders: ['Set-Cookie'],
      optionsSuccessStatus: 204,
      methods: 'GET,PUT,POST,DELETE,OPTIONS',
      maxAge: 86400 // 24 hours in seconds
    };
  }
}

const corsHandler = new CorsHandler(AllowedOrigin);
const corsOptions = corsHandler.getCorsOptions();

export default corsOptions;
