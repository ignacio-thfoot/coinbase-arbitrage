const { log, error } = console;
const socket = require('socket.io');
const express = require('express');
const cors = require('cors');
const path = require('path');
const open = require('open');

const app = express();
const server = app.listen(3000, () =>
  log('Arbitrage Bot has just started on port 3000. Please wait.....')
);

app.use(cors());
app.use('/JS', express.static(path.join(__dirname, './Pages/JS')));
app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, './Pages/index.html'));
});

const io = socket(server);

const arbitrage = require('./arbitrage');
const arbitrage_coinbase = require('./arbitrage_coinbase');

const initialize = async () => {
  await arbitrage_coinbase.getPairs();
};

arbitrage_coinbase.eventEmitter.on('ARBITRAGE', (pl) => {
  io.sockets.emit('ARBITRAGE', pl);
});

initialize();

//start server
open('http://localhost:3000');
