const CoinbasePro = require('coinbase-pro');
const fs = require('fs');
const { get } = require('http');
const { log, error } = console;
const got = require('got');
const events = require('events');
const Websocket = require('ws');
const { sort } = require('fast-sort');
const { exit } = require('process');
const { isPrimitive } = require('util');

var raw_params = fs.readFileSync('params.json');
var params = JSON.parse(raw_params);
var auth = params.auth;
const authedClient = new CoinbasePro.AuthenticatedClient(auth.apiKey, auth.apiSecret, auth.passphrase, auth.apiURI);

const eventEmitter = new events();

let pairs = [], symValJ = {};

const coins = ['ADA', 'BTC', 'ETH', 'EUR', 'USDT'];

const getPairs = () => {
    authedClient.getProducts()
    .then(data => {
        // work with data

        const eInfo = data;
        const symbols = [
            ...new Set(
                eInfo
                .filter((d) => d.status === 'online')
                .map((d) => [d.base_currency, d.quote_currency])
                .flat()
            ),
        ];

        const validPairs = eInfo
            .filter((d) => d.status === 'online')
            .map((d) => d.id);

        validPairs.forEach((symbol) => {
            symValJ[symbol] = { bidPrice: 0, askPrice: 0 };
        });
        
        let s1, s2, s3;
        s1 = s2 = s3 = coins;

        s1.forEach((d1) => {
            s2.forEach((d2) => {
                s3.forEach((d3) => {
                    if (!(d1 == d2 || d2 == d3 || d3 == d1)) {
                    let lv1 = [],
                    lv2 = [],
                    lv3 = [],
                    l1 = '',
                    l2 = '',
                    l3 = '';
                    
                    if (symValJ[d1 + '-' + d2]) {
                        lv1.push(d1 + '-' + d2);
                        l1 = 'num';
                    }
                    if (symValJ[d2 + '-' + d1]) {
                        lv1.push(d2 + '-' + d1);
                        l1 = 'den';
                    }
                    if (symValJ[d2 + '-' + d3]) {
                        lv2.push(d2 + '-' + d3);
                        l2 = 'num';
                    }
                    if (symValJ[d3 + '-' + d2]) {
                        lv2.push(d3 + '-' + d2);
                        l2 = 'den';
                    }
                    if (symValJ[d3 + '-' + d1]) {
                        lv3.push(d3 + '-' + d1);
                        l3 = 'num';
                    }
                    if (symValJ[d1 + '-' + d3]) {
                        lv3.push(d1 + '-' + d3);
                        l3 = 'den';
                    }

                    if (lv1.length && lv2.length && lv3.length) {
                        pairs.push({
                            l1: l1,
                            l2: l2,
                            l3: l3,
                            d1: d1,
                            d2: d2,
                            d3: d3,
                            lv1: lv1[0],
                            lv2: lv2[0],
                            lv3: lv3[0],
                            value: -100,
                            tpath: '',
                        });
                    }
                }
            });
        });
    });
    log(`Finished identifying Arbitrage Paths. Total paths = ${pairs.length}`);

    wsconnect(validPairs);
})
.catch(error => {   
    // handle the error
});
}

var isProcessing = false;

const processData = async (data) => {
    if(!isProcessing) {
        try {

            if (data['result'] === null) return;
            
            if(data.type == 'ticker') {
                
                symValJ[data.product_id].bidPrice = parseFloat(data.best_bid);
                symValJ[data.product_id].askPrice = parseFloat(data.best_ask);
                
                //Perform calculation and send alerts
                pairs.forEach((d) => {
                    //continue if price is not updated for any symbol
                    if (
                        symValJ[d.lv1]['bidPrice'] &&
                        symValJ[d.lv2]['bidPrice'] &&
                        symValJ[d.lv3]['bidPrice']
                    ) {
                    //Level 1 calculation
                    let lv_calc, lv_str;
                    if (d.l1 === 'num') {
                        lv_calc = symValJ[d.lv1]['bidPrice'];
                        lv_str =
                        d.d1 +
                        '->' +
                        d.lv1 +
                        "['bidP']['" +
                        symValJ[d.lv1]['bidPrice'] +
                        "']" +
                        '->' +
                        d.d2 +
                        '<br/>';
                    } else {
                        lv_calc = 1 / symValJ[d.lv1]['askPrice'];
                        lv_str =
                        d.d1 +
                        '->' +
                        d.lv1 +
                        "['askP']['" +
                        symValJ[d.lv1]['askPrice'] +
                        "']" +
                        '->' +
                        d.d2 +
                        '<br/>';
                    }

                    //Level 2 calculation
                    if (d.l2 === 'num') {
                        lv_calc *= symValJ[d.lv2]['bidPrice'];
                        lv_str +=
                        d.d2 +
                        '->' +
                        d.lv2 +
                        "['bidP']['" +
                        symValJ[d.lv2]['bidPrice'] +
                        "']" +
                        '->' +
                        d.d3 +
                        '<br/>';
                    } else {
                        lv_calc *= 1 / symValJ[d.lv2]['askPrice'];
                        lv_str +=
                        d.d2 +
                        '->' +
                        d.lv2 +
                        "['askP']['" +
                        symValJ[d.lv2]['askPrice'] +
                        "']" +
                        '->' +
                        d.d3 +
                        '<br/>';
                    }

                    //Level 3 calculation
                    if (d.l3 === 'num') {
                        lv_calc *= symValJ[d.lv3]['bidPrice'];
                        lv_str +=
                        d.d3 +
                        '->' +
                        d.lv3 +
                        "['bidP']['" +
                        symValJ[d.lv3]['bidPrice'] +
                        "']" +
                        '->' +
                        d.d1;
                    } else {
                        lv_calc *= 1 / symValJ[d.lv3]['askPrice'];
                        lv_str +=
                        d.d3 +
                        '->' +
                        d.lv3 +
                        "['askP']['" +
                        symValJ[d.lv3]['askPrice'] +
                        "']" +
                        '->' +
                        d.d1;
                    }

                    d.tpath = lv_str;
                    d.value = parseFloat(parseFloat((lv_calc - 1) * 100).toFixed(3));
                    }
                });
            }

            //Send Socket
            eventEmitter.emit(
            'ARBITRAGE',
                sort(pairs.filter(d.d1 == 'EUR')).desc((u) => u.value)
            );

            pairs.forEach(async (pair) => {
                if(pair.value > 0.2) {
                    //console.log(pair);
                    isProcessing = true;

                    let balances = authedClient.getAccounts((error, response, data) => {
                        let baseBalance = parseFloat(data.filter(el => { return el.currency == pair.d1 })[0].balance);
                        
                        let params = {
                            side: 'sell',
                            price: symValJ[pair.lv1]['bidPrice'],
                            size: parseFloat(baseBalance),
                            product_id: pair.lv1,
                            type: 'limit',
                        };
                        console.log("base balance", baseBalance);
                        console.log(`
                        ${params.side} ${Math.floor(parseFloat(baseBalance) / parseFloat(symValJ[pair.lv1]['bidPrice']))} of ${pair.lv1} @ ${symValJ[pair.lv1]['askPrice']} ${pair.d2}
                        `);

                        // authedClient.placeOrder(params, (error, response, order) => {
                        //     if(error) {
                        //         console.log(error.data.message);
                        //     } else {
                        //         console.log(order);
                        //     }
                        //     // let params = {
                        //     //     side: 'buy',
                        //     //     price: symValJ[pair.lv2]['bidPrice'], // USD
                        //     //     size: order.size,
                        //     //     product_id: pair.lv1,
                        //     // };
                        //     // console.log(`
                        //     // Buy ${pair.lv2} @ ${symValJ[pair.lv2]['bidPrice']}.
                        //     // 2- Buy ${pair.lv3} @ ${symValJ[pair.lv3]['bidPrice']}.
                        //     // `);



                        //     // console.log(`
                        //     // Buy ${pair.lv3} @ ${symValJ[pair.lv3]['bidPrice']}.
                        //     // `);

                        //     isProcessing = false;

                        //     process.exit();
                        // });
                    });
                }
            });

        } catch (err) {
            error(err);
        }
    }
};

const wsconnect = (products) => {
    const websocket = new CoinbasePro.WebsocketClient(products,'wss://ws-feed.pro.coinbase.com',null, {channels: ["ticker"]});

    websocket.on('message', processData);
    websocket.on('error', err => {
        /* handle error */
    });
    websocket.on('close', () => {
        /* ... */
    });
}

module.exports = { getPairs, eventEmitter };