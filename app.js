const config = require('./config');
const { logger, expressLogger, expressErrorLogger } = require('./winston');

// If settings present, start New Relic
const env = require('./services/environment.js')();

if (env.NEW_RELIC_APP_NAME && env.NEW_RELIC_LICENSE_KEY) {
  logger.info(`Activating New Relic: ${env.NEW_RELIC_APP_NAME}`);
  require('newrelic'); // eslint-disable-line global-require
} else {
  logger.warn('Skipping New Relic Activation');
}

const express = require('express');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const session = require('express-session');
const PostgresStore = require('connect-session-sequelize')(session.Store);
const nunjucks = require('nunjucks');
const flash = require('connect-flash');
const http = require('http');
const io = require('socket.io');
const redis = require('redis');
const redisAdapter = require('socket.io-redis');
const schedule = require('node-schedule');

const responses = require('./api/responses');
const passport = require('./api/services/passport');
const RateLimit = require('express-rate-limit');
const router = require('./api/routers');
const devMiddleware = require('./api/services/devMiddleware');
const SocketIOSubscriber = require('./api/services/SocketIOSubscriber');
const jwtHelper = require('./api/services/jwtHelper');
const FederalistUsersHelper = require('./api/services/FederalistUsersHelper');
const RepositoryVerifier = require('./api/services/RepositoryVerifier');
const SiteUserAuditor = require('./api/services/SiteUserAuditor');

const app = express();
const sequelize = require('./api/models').sequelize;

config.session.store = new PostgresStore({ db: sequelize });

nunjucks.configure('views', {
  autoescape: true,
  express: app,
});

// When deployed we are behind a proxy, but we want to be
// able to access the requesting user's IP in req.ip, so
// 'trust proxy' must be enabled.
app.enable('trust proxy');
app.use(express.static('public'));
if (process.env.NODE_ENV === 'development') {
  app.use(devMiddleware());
}
app.use(session(config.session));
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  res.locals.user = req.user;
  return next();
});
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: '2mb' }));
app.use(methodOverride());
app.use(flash());
app.use(responses);

app.use((req, res, next) => {
  const host = req.hostname;
  const redirectUrls = [
    'federalist.fr.cloud.gov',
    'federalist-staging.fr.cloud.gov',
  ];

  if (redirectUrls.indexOf(host) !== -1) {
    return res.redirect(301, `https://${host.slice().replace('fr.cloud', '18f')}`);
  }

  return next();
});

// temporary until federalist.18f.gov is launched
app.use((req, res, next) => {
  const host = req.hostname;
  const redirectUrls = [
    'federalist.18f.gov',
    'federalist-staging.18f.gov',
  ];

  if (redirectUrls.indexOf(host) !== -1) {
    return res.redirect(302, `https://${host.slice().replace('federalist', 'federalistapp')}`);
  }

  return next();
});

app.use((req, res, next) => {
  res.set('Cache-Control', 'max-age=0');
  next();
});

if (logger.levels[logger.level] >= 2) {
  app.use(expressLogger);
}

app.use(expressErrorLogger);

const limiter = new RateLimit(config.rateLimiting);
app.use(limiter); // must be set before router is added to app

app.server = http.Server(app);

const socket = io(app.server);
if (config.redis) {
  const redisCreds = { auth_pass: config.redis.password };
  const pub = redis.createClient(config.redis.port, config.redis.hostname, redisCreds);
  const sub = redis.createClient(config.redis.port, config.redis.hostname, redisCreds);
  socket.adapter(redisAdapter({ pubClient: pub, subClient: sub }));
}

app.use((req, res, next) => {
  res.socket = socket;
  next();
});

app.use(router);
// error handler middleware for custom CSRF error responses
// note that error handling middlewares must come last in the stack
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    res.forbidden({ message: 'Invalid CSRF token' });
    return;
  }
  next(err);
});

app.use((req, res) => res.status(404).redirect(302, '/404-not-found/'));

socket.use((_socket, next) => {
   /* eslint-disable no-param-reassign */
  if (_socket.handshake.query && _socket.handshake.query.accessToken) {
    jwtHelper.verify(_socket.handshake.query.accessToken, { expiresIn: 60 * 60 * 24 }) // expire 24h
    .then((decoded) => {
      _socket.user = decoded.user;
    })
    .then(() => next())
    .catch((e) => {
      logger.warn(e);
      next();
    });
  } else {
    next();
  }
})
.on('connection', (_socket) => {
  SocketIOSubscriber.joinRooms(_socket);
});

if (process.env.CF_INSTANCE_INDEX === '0') {
  // verify site's repositories exist
  schedule.scheduleJob('0 0 * * *', () => {
    logger.info('Verifying Repos');
    RepositoryVerifier.verifyRepos()
      .catch(logger.error);
  });

  // audit users and remove sites w/o repo push permissions
  schedule.scheduleJob('0 0 * * *', () => {
    logger.info('Auditing All Sites');
    SiteUserAuditor.auditAllSites()
      .catch(logger.error);
  });

  if (config.app.app_env === 'production') {
    // audit federalist-users 18F teams daily at midnight
    schedule.scheduleJob('0 0 * * *', () => {
      logger.info('Auditing federalist-users 18F Staff & Org Teams');
      FederalistUsersHelper.audit18F({})
        .catch(logger.error);
    });
  }
}

module.exports = app;
