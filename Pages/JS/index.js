const socket = io.connect('/');
let runFlag = 'X';
let mimPL = 0;

const runToggle = () => {
  if (runFlag) {
    runFlag = '';
    document.getElementById('runDiv').innerHTML =
      '<button onclick="runToggle();" type="button" class="btn btn-danger" id="runFlag">Toggle</button>';
  } else {
    runFlag = 'X';
    document.getElementById('runDiv').innerHTML =
      '<button onclick="runToggle();" type="button" class="btn btn-success" id="runFlag">Toggle</button>';
  }
};

const minLimit = (ml) => {
  mimPL = parseFloat(ml);
};

socket.on('ARBITRAGE', (pl) => {
  if(pl.length > 0) console.log(pl);
  if (runFlag) {
    let markup = '';
    pl.filter((p) => p.value >= mimPL).forEach((d, i) => {
      if(parseFloat(d.value) > 0.2) {
        markup += "<tr class='table-success'>";
      } else {
        markup += "<tr class='table-normal'>";
      }
      markup += 
        "<td>" +
        (i + 1) +
        '</td><td>'+
        d.d1 + ' - ' + d.d2 + ' - ' + d.d3 +
        '</td><td>' +
        d.tpath +
        '</td><td>' +
        d.value +
        '</td></tr>';
    });
    document.getElementById('tartbitBody').innerHTML = markup;
  }
});
