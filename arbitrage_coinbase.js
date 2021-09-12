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

const coins = ['ADA', 'BTC', 'ETH', 'DOT', 'SOL','MATIC', 'USDT'];

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

                //console.log(data);

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

            //console.log(pairs);
            

            //Send Socket
            eventEmitter.emit(
            'ARBITRAGE',
                sort(pairs.filter((d) => d.value > 0.01)).desc((u) => u.value)
            );

            pairs.forEach(async (pair) => {
                if(pair.d1 == 'ADA' && pair.value > .2) {
                    isProcessing = true;

                    authedClient.getAccounts((error, response, data) => {
                        let baseBalance = parseFloat(data.filter(el => { return el.currency == pair.d1 })[0].balance);
                        
                        let size = (parseFloat(parseFloat(baseBalance) / parseFloat(symValJ[pair.lv1]['askPrice'])).toFixed(4)) * 0.95;
                        let params = {
                            side: 'buy',
                            price: symValJ[pair.lv1]['askPrice'],
                            size: size,
                            product_id: pair.lv1,
                            type: 'limit',
                        };
                        console.log(`
                        Buy ${size} ${pair.d2} of ${pair.lv1} @ ${symValJ[pair.lv1]['askPrice']} ${pair.d1}
                        `);

                        //place order for LV1
                        authedClient.placeOrder(params, (error, response, order) => {
                            if(error) {
                                console.log(error.data.message);
                                process.exit();
                            } else {
                                console.log(order);
                            }

                            let size = (parseFloat(parseFloat(order.size) / parseFloat(symValJ[pair.lv2]['askPrice'])) * 0.95).toFixed(4);
                            let params2 = {
                                side: 'buy',
                                price: symValJ[pair.lv2]['askPrice'], // EUR
                                size: size,
                                product_id: pair.lv2,
                                type: 'limit',
                            };
                            console.log(`
                                Buy ${size} ${pair.lv2} @ ${symValJ[pair.lv2]['askPrice']}.
                            `);

                            //place order for LV2
                            authedClient.placeOrder(params2, (error2, response2, order2) => {
                                if(error2) {
                                    console.log(error2.data.message);
                                    process.exit();
                                } else {
                                    console.log(order2);
                                }

                                let size = (parseFloat(parseFloat(order2.size) / parseFloat(symValJ[pair.lv3]['bidPrice'])) * 0.95).toFixed(4);
                                let params3 = {
                                    side: 'buy',
                                    price: symValJ[pair.lv3]['bidPrice'],
                                    size: size,
                                    product_id: pair.lv3,
                                    type: 'limit',
                                };


                                console.log(`
                                Buy ${size} ${pair.lv3} @ ${symValJ[pair.lv3]['bidPrice']}.
                                `);

                                //Place order for LV3
                                authedClient.placeOrder(params3, (error3, response3, order3) => {
                                    if(error3) {
                                        console.log(error3.data.message);
                                        process.exit();
                                    } else {
                                        console.log(order3);
                                    }

                                    isProcessing = false;

                                    process.exit();

                                });
                                
                            });
                            
                        });
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