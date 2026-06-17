const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/events?month=6&year=2026',
  method: 'GET',
  headers: {
    'Origin': 'http://localhost:8081'
  }
};

const req = http.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
});

req.on('error', (error) => {
  console.error(error);
});

req.end();
